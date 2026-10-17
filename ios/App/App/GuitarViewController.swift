import Capacitor
import Foundation
import Security

class GuitarViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GuitarLocalPlugin())
        bridge?.registerPluginInstance(GuitarAccountPlugin())
    }
}

@objc(GuitarAccountPlugin)
public class GuitarAccountPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GuitarAccountPlugin"
    public let jsName = "GuitarAccount"
    public let pluginMethods = [CAPPluginMethod(name: "loadSession", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "saveSession", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "clearSession", returnType: CAPPluginReturnPromise)]
    private var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "io.guitario.mobile.account", kSecAttrAccount as String: "cloud-session"] }
    @objc func loadSession(_ call: CAPPluginCall) {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?; let status = SecItemCopyMatching(q as CFDictionary, &item)
        if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
        guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else { call.reject("Secure account storage is unavailable."); return }
        call.resolve(["value": value])
    }
    @objc func saveSession(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= 32768 else { call.reject("Invalid account session."); return }
        let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound { var q = query; attributes.forEach { q[$0.key] = $0.value }; status = SecItemAdd(q as CFDictionary, nil) }
        guard status == errSecSuccess else { call.reject("Could not save the account securely."); return }; call.resolve()
    }
    @objc func clearSession(_ call: CAPPluginCall) {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { call.reject("Could not clear the saved account."); return }; call.resolve()
    }
}
