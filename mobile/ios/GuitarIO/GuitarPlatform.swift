import Foundation
import React
import WebKit
import Security
import CryptoKit
import AVFoundation

private final class LegacyScheme: NSObject, WKURLSchemeHandler {
 func webView(_ webView: WKWebView, start task: WKURLSchemeTask){let data=Data("<!doctype html><meta charset=\"utf-8\"><title>Library migration</title>".utf8);task.didReceive(URLResponse(url:task.request.url!,mimeType:"text/html",expectedContentLength:data.count,textEncodingName:"utf-8"));task.didReceive(data);task.didFinish()}
 func webView(_ webView: WKWebView, stop task: WKURLSchemeTask){}
}
@objc(GuitarPlatform)
final class GuitarPlatform:NSObject,WKNavigationDelegate,WKScriptMessageHandler {
 @objc static func requiresMainQueueSetup()->Bool{true}
 @objc func constantsToExport()->[AnyHashable:Any]{[
  "profile":Bundle.main.object(forInfoDictionaryKey:"GuitarBuildProfile") as? String ?? "local",
  "shareInboxEnabled":Bundle.main.object(forInfoDictionaryKey:"GuitarShareInboxEnabled") as? Bool ?? false,
  "appleSignIn":Bundle.main.object(forInfoDictionaryKey:"GuitarAppleSignInEnabled") as? Bool ?? false,
  "purchases":Bundle.main.object(forInfoDictionaryKey:"GuitarPurchasesEnabled") as? Bool ?? false,
  "googleSignIn":!(Bundle.main.object(forInfoDictionaryKey:"GIDClientID") as? String ?? "").isEmpty
 ]}
 private var migrationScope=""
 private let group="group.io.guitario.mobile"
 @objc func prepareAudio(_ resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){do{let audio=AVAudioSession.sharedInstance();try audio.setCategory(.playback,mode:.default,options:[.mixWithOthers]);try audio.setActive(true);resolve(nil)}catch{reject("AUDIO_SESSION","Could not prepare audio output.",error)}}
 @objc func releaseAudio(_ resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){do{try AVAudioSession.sharedInstance().setActive(false,options:[.notifyOthersOnDeactivation]);resolve(nil)}catch{reject("AUDIO_SESSION","Could not release audio output.",error)}}
 private var web:WKWebView?,resolve:RCTPromiseResolveBlock?,reject:RCTPromiseRejectBlock?,folder:URL?,records:FileHandle?
 private var files:[String:(FileHandle,SHA256,Int)]=[:],manifest:[String:[String:Any]]=[:],count=0,totalBytes=0
 private func inbox()throws->URL{guard let base=FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:group) else{throw NSError(domain:"GuitarIO",code:1,userInfo:[NSLocalizedDescriptionKey:"Configure the shared App Group."])};let dir=base.appendingPathComponent("ShareInbox");try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true);return dir}
 @objc func shareInbox(_ resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){if !(Bundle.main.object(forInfoDictionaryKey:"GuitarShareInboxEnabled") as? Bool ?? false){resolve([]);return};do{let directory=try inbox();let items=try FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil).filter{$0.pathExtension=="json"}.prefix(100);resolve(try items.map{try JSONSerialization.jsonObject(with:Data(contentsOf:$0))})}catch{reject("SHARE_INBOX",error.localizedDescription,error)}}
 @objc func ackShare(_ identifier:String,resolver resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){do{guard UUID(uuidString:identifier) != nil else{throw NSError(domain:"GuitarIO",code:2)};let path=try inbox().appendingPathComponent(identifier+".json");try FileManager.default.removeItem(at:path);resolve(nil)}catch{reject("SHARE_INBOX",error.localizedDescription,error)}}
 @objc func legacySession(_ resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){var query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"io.guitario.mobile.account",kSecAttrAccount as String:"cloud-session"];query[kSecReturnData as String]=true;var result:CFTypeRef?;let status=SecItemCopyMatching(query as CFDictionary,&result);if status==errSecItemNotFound{resolve(nil);return};guard status==errSecSuccess,let data=result as? Data else{reject("KEYCHAIN","Unlock the device before migrating credentials.",nil);return};resolve(String(data:data,encoding:.utf8))}
 @objc func legacySnapshot(_ scope:String,resolver resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){
 DispatchQueue.main.async{do{
  guard self.web==nil else{throw NSError(domain:"GuitarIO",code:3,userInfo:[NSLocalizedDescriptionKey:"Migration already running."])}
  guard scope.isEmpty || UUID(uuidString:scope) != nil else{throw NSError(domain:"GuitarIO",code:10,userInfo:[NSLocalizedDescriptionKey:"Invalid library scope."])}
  self.migrationScope=scope;self.resolve=resolve;self.reject=reject;self.count=0;self.totalBytes=0;self.manifest=[:]
  let base=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0].appendingPathComponent("LegacyMigration").appendingPathComponent(UUID().uuidString);try FileManager.default.createDirectory(at:base,withIntermediateDirectories:true);self.folder=base
  let path=base.appendingPathComponent("records.ndjson");FileManager.default.createFile(atPath:path.path,contents:nil);self.records=try FileHandle(forWritingTo:path)
  let config=WKWebViewConfiguration();config.websiteDataStore = .default();config.setURLSchemeHandler(LegacyScheme(),forURLScheme:"capacitor");config.userContentController.add(self,name:"legacy")
  self.web=WKWebView(frame:.zero,configuration:config);self.web?.navigationDelegate=self;self.web?.load(URLRequest(url:URL(string:"capacitor://localhost/migration")!))
 }catch{reject("MIGRATION",error.localizedDescription,error);self.close()}}
 }
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){do{guard let path=Bundle.main.url(forResource:"legacy-migrate",withExtension:"js") else{throw NSError(domain:"GuitarIO",code:4,userInfo:[NSLocalizedDescriptionKey:"Migration script is missing."])};webView.evaluateJavaScript("window.__guitarioLegacyScope=\"\(migrationScope)\";\n" + (try String(contentsOf:path,encoding:.utf8))){_,error in if let error=error{self.reject?("MIGRATION",error.localizedDescription,error);self.close()}}}catch{reject?("MIGRATION",error.localizedDescription,error);close()}}
 func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){
  guard message.frameInfo.isMainFrame,message.frameInfo.request.url?.scheme=="capacitor",message.frameInfo.request.url?.host=="localhost",let body=message.body as? [String:Any],let type=body["type"] as? String else{return}
  do{
   if type=="file-start"{guard let id=body["id"] as? String,UUID(uuidString:id) != nil else{throw NSError(domain:"GuitarIO",code:5)};let path=folder!.appendingPathComponent(id);FileManager.default.createFile(atPath:path.path,contents:nil);files[id]=(try FileHandle(forWritingTo:path),SHA256(),0)}
   else if type=="file-chunk"{guard let id=body["id"] as? String,var state=files[id],let encoded=body["data"] as? String,encoded.count<=90000,let data=Data(base64Encoded:encoded) else{throw NSError(domain:"GuitarIO",code:6)};try state.0.write(contentsOf:data);state.1.update(data:data);state.2+=data.count;files[id]=state}
   else if type=="file-end"{guard let id=body["id"] as? String,let state=files.removeValue(forKey:id),let size=body["size"] as? Int,size==state.2 else{throw NSError(domain:"GuitarIO",code:7)};try state.0.close();let hash=state.1.finalize().map{String(format:"%02x",$0)}.joined();manifest[id]=["path":folder!.appendingPathComponent(id).path,"hash":hash,"size":size];totalBytes+=size}
   else if type=="record"{let line=try JSONSerialization.data(withJSONObject:body);try records?.write(contentsOf:line+Data([10]));count+=1}
   else if type=="done"{guard files.isEmpty,(body["records"] as? Int)==count,(body["totalBytes"] as? Int)==totalBytes else{throw NSError(domain:"GuitarIO",code:8)};try records?.close();resolve?(["scope":migrationScope,"recordsPath":folder!.appendingPathComponent("records.ndjson").path,"files":manifest,"records":count,"totalBytes":totalBytes]);close();return}
   else if type=="error"{throw NSError(domain:"GuitarIO",code:9,userInfo:[NSLocalizedDescriptionKey:body["message"] as? String ?? "Migration failed"])}
   if let sequence=body["sequence"] as? Int{web?.evaluateJavaScript("window.legacyAck(\(sequence))")}
  }catch{reject?("MIGRATION",error.localizedDescription,error);close()}
 }
 private func close(){for state in files.values{try? state.0.close()};files.removeAll();try? records?.close();records=nil;web?.configuration.userContentController.removeScriptMessageHandler(forName:"legacy");web=nil;resolve=nil;reject=nil}
}
