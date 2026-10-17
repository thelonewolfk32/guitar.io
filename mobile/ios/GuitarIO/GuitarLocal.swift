import Foundation
import React
import Network
import Darwin
import zlib

private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

@objc(GuitarLocal)
public class GuitarLocal: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
    @objc static func requiresMainQueueSetup() -> Bool { true }
    @objc func configure(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) { configureCall(LocalCall(options, resolve, reject)) }
    @objc func status(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) { statusCall(LocalCall(options, resolve, reject)) }
    @objc func request(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) { requestCall(LocalCall(options, resolve, reject)) }
    @objc func fetchJSON(_ options: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) { fetchJSONCall(LocalCall(options, resolve, reject)) }
    private let browser = NetServiceBrowser()
    private var services: [NetService] = []
    private var peers: [String: [String: Any]] = [:]
    private let monitor = NWPathMonitor()
    private var lanAvailable = false
    private var enabled = false
    private var deviceName = "iPhone"
    private var networkError = ""
    private let redirectDelegate = NoRedirect()

    public override init() {
        super.init()
        browser.delegate = self
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async { self?.lanAvailable = path.status == .satisfied && (path.usesInterfaceType(.wifi) || path.usesInterfaceType(.wiredEthernet)) && !path.isConstrained }
        }
        monitor.start(queue: DispatchQueue(label: "io.guitario.network"))
    }
    private func state() -> [String: Any] { ["available": true, "enabled": enabled, "name": deviceName, "endpoints": [], "discovered": Array(peers.values), "wifi": lanAvailable, "error": networkError] }
    private func configureCall(_ call: LocalCall) {
        DispatchQueue.main.async {
            self.enabled = call.getBool("enabled") ?? false
            self.deviceName = call.getString("name") ?? "iPhone"
            self.browser.stop(); self.services.removeAll(); self.peers.removeAll(); self.networkError = ""
            if self.enabled { self.browser.searchForServices(ofType: "_guitario._tcp.", inDomain: "local.") }
            call.resolve(self.state())
        }
    }
    private func statusCall(_ call: LocalCall) { DispatchQueue.main.async { call.resolve(self.state()) } }
    private func privateAddress(_ host: String) -> Bool {
        let values = host.split(separator: ".").compactMap { Int($0) }
        guard values.count == 4, values.allSatisfy({ $0 >= 0 && $0 <= 255 }) else { return false }
        let a = values[0], b = values[1]
        return a == 10 || a == 127 || (a == 192 && b == 168) || (a == 172 && b >= 16 && b <= 31) || (a == 169 && b == 254)
    }
    private func requestCall(_ call: LocalCall) {
        guard enabled, lanAvailable else { call.reject("Connect to Wi-Fi or Ethernet and enable local sync."); return }
        guard let text = call.getString("endpoint"), let url = URL(string: text), url.scheme == "http", let host = url.host, privateAddress(host), url.port != nil, url.path == "/sync", url.query == nil, url.fragment == nil, url.user == nil, url.password == nil, let body = call.getString("body"), body.utf8.count <= 48 * 1024 * 1024 else { call.reject("Invalid local sync request."); return }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.httpBody = body.data(using: .utf8); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        perform(request, call: call, local: true, limit: 64 * 1024 * 1024)
    }
    private func fetchJSONCall(_ call: LocalCall) {
        let hosts = ["www.songsterr.com", "songsterr.com", "dqsljvtekg760.cloudfront.net", "d34shlm8p2ums2.cloudfront.net", "d3cqchs6g3b5ew.cloudfront.net", "d3d3l6a6rcgkaf.cloudfront.net", "d3rrfvx08uyjp1.cloudfront.net", "dodkcbujl0ebx.cloudfront.net", "dj1usja78sinh.cloudfront.net"]
        guard let text = call.getString("url"), let url = URL(string: text), url.scheme == "https", let host = url.host, hosts.contains(host), url.user == nil, url.password == nil, url.port == nil else { call.reject("Unsupported download address."); return }
        var request = URLRequest(url: url); request.setValue("application/json", forHTTPHeaderField: "Accept")
        perform(request, call: call, local: false, limit: 30 * 1024 * 1024)
    }
    private func perform(_ request: URLRequest, call: LocalCall, local: Bool, limit: Int) {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 25; config.timeoutIntervalForResource = 30
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.httpCookieStorage = nil; config.urlCache = nil
        config.allowsCellularAccess = !local
        config.allowsExpensiveNetworkAccess = !local
        config.allowsConstrainedNetworkAccess = !local
        let session = URLSession(configuration: config, delegate: redirectDelegate, delegateQueue: nil)
        session.dataTask(with: request) { data, response, error in
            defer { session.finishTasksAndInvalidate() }
            if let error = error { call.reject(error.localizedDescription); return }
            guard let response = response as? HTTPURLResponse, response.statusCode == 200, let data = data, data.count <= limit else { call.reject("Download failed or exceeds the file limit."); return }
            do {
                let decoded = try self.decode(data, limit: limit)
                guard let text = String(data: decoded, encoding: .utf8) else { call.reject("Invalid UTF-8 response."); return }
                call.resolve(["body": text])
            } catch { call.reject("Compressed tab could not be read.") }
        }.resume()
    }
    private func decode(_ data: Data, limit: Int) throws -> Data {
        guard data.count > 2, data[0] == 0x1f, data[1] == 0x8b else { return data }
        var stream = z_stream(), result = Data(), buffer = [UInt8](repeating: 0, count: 65536)
        let ok: Bool = data.withUnsafeBytes { raw in
            stream.next_in = UnsafeMutablePointer(mutating: raw.bindMemory(to: UInt8.self).baseAddress)
            stream.avail_in = uInt(data.count)
            guard inflateInit2_(&stream, 47, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size)) == Z_OK else { return false }
            defer { inflateEnd(&stream) }
            while true {
                let status = buffer.withUnsafeMutableBytes { out -> Int32 in
                    stream.next_out = out.bindMemory(to: UInt8.self).baseAddress; stream.avail_out = uInt(out.count)
                    return inflate(&stream, Z_NO_FLUSH)
                }
                result.append(contentsOf: buffer.prefix(buffer.count - Int(stream.avail_out)))
                if result.count > limit { return false }
                if status == Z_STREAM_END { return true }
                if status != Z_OK { return false }
            }
        }
        if !ok { throw NSError(domain: "Guitar.io", code: 1) }; return result
    }
    public func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) { services.append(service); service.delegate = self; service.resolve(withTimeout: 5) }
    public func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) { if let data = service.txtRecordData(), let id = NetService.dictionary(fromTXTRecord: data)["id"], let key = String(data: id, encoding: .utf8) { peers.removeValue(forKey: key) }; services.removeAll { $0 == service } }
    public func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) { networkError = "Local network discovery is unavailable. Allow Local Network access in iPhone Settings, or use the pairing address." }
    public func netServiceDidResolveAddress(_ sender: NetService) {
        guard let data = sender.txtRecordData(), let idData = NetService.dictionary(fromTXTRecord: data)["id"], let id = String(data: idData, encoding: .utf8) else { return }
        let txt = NetService.dictionary(fromTXTRecord: data), name = txt["name"].flatMap { String(data: $0, encoding: .utf8) } ?? "Guitar.io"
        var endpoints: [String] = []
        for address in sender.addresses ?? [] {
            address.withUnsafeBytes { raw in
                guard let pointer = raw.baseAddress?.assumingMemoryBound(to: sockaddr.self), pointer.pointee.sa_family == sa_family_t(AF_INET) else { return }
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                if getnameinfo(pointer, socklen_t(pointer.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                    let text = String(cString: host); if privateAddress(text) { endpoints.append("http://\(text):\(sender.port)/sync") }
                }
            }
        }
        if !endpoints.isEmpty { peers[id] = ["id": id, "name": name, "code": txt["code"].flatMap { String(data: $0, encoding: .utf8) } ?? (peers[id]?["code"] as? String ?? ""), "endpoints": endpoints] }
    }
}

private final class LocalCall {
 let values:NSDictionary;let resolver:RCTPromiseResolveBlock;let rejecter:RCTPromiseRejectBlock
 init(_ values:NSDictionary,_ resolve:@escaping RCTPromiseResolveBlock,_ reject:@escaping RCTPromiseRejectBlock){self.values=values;resolver=resolve;rejecter=reject}
 func getBool(_ key:String)->Bool?{values[key] as? Bool}
 func getString(_ key:String)->String?{values[key] as? String}
 func resolve(_ value:[String:Any]){resolver(value)}
 func reject(_ message:String){rejecter("LAN_ERROR",message,nil)}
}
