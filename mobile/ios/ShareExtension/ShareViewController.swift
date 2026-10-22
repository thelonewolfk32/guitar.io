import UIKit
import UniformTypeIdentifiers
final class ShareViewController:UIViewController {
 private var processing=false
 override func viewDidAppear(_ animated:Bool){super.viewDidAppear(animated);guard !processing else{return};processing=true;capture()}
 private func capture(){
  let items=extensionContext?.inputItems as? [NSExtensionItem] ?? []
  let providers=items.flatMap{$0.attachments ?? []}
  guard let provider=providers.first(where:{$0.hasItemConformingToTypeIdentifier(UTType.url.identifier)||$0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)}) else{finish("Share a Spotify, YouTube or Apple Music song link.");return}
  let type=provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) ? UTType.url.identifier:UTType.plainText.identifier
  provider.loadItem(forTypeIdentifier:type,options:nil){item,error in
   let text=(item as? URL)?.absoluteString ?? (item as? String) ?? ""
   do{
    let detector=try NSDataDetector(types:NSTextCheckingResult.CheckingType.link.rawValue),range=NSRange(text.startIndex...,in:text)
    guard let match=detector.firstMatch(in:text,range:range),let url=match.url,url.scheme=="https",url.user==nil,url.password==nil,let host=url.host,["open.spotify.com","youtube.com","www.youtube.com","m.youtube.com","youtu.be","music.apple.com"].contains(host),let base=FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:"group.io.guitario.mobile") else{throw NSError(domain:"GuitarIO",code:1)}
    let directory=base.appendingPathComponent("ShareInbox");try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
    if try FileManager.default.contentsOfDirectory(atPath:directory.path).count>=100{throw NSError(domain:"GuitarIO",code:2,userInfo:[NSLocalizedDescriptionKey:"Open Guitar.io to process earlier shares."])}
    let id=UUID().uuidString.lowercased(),record:[String:Any]=["id":id,"url":url.absoluteString,"title":String(text.prefix(200)),"createdAt":ISO8601DateFormatter().string(from:Date())]
    try JSONSerialization.data(withJSONObject:record).write(to:directory.appendingPathComponent(id+".json"),options:.atomic)
    self.finish("Saved. Open Guitar.io to add this song.")
   }catch{self.finish(error.localizedDescription)}
  }
 }
 private func finish(_ message:String){DispatchQueue.main.async{let alert=UIAlertController(title:"Guitar.io",message:message,preferredStyle:.alert);alert.addAction(UIAlertAction(title:"Done",style:.default){_ in self.extensionContext?.completeRequest(returningItems:nil)});self.present(alert,animated:true)}}
}
