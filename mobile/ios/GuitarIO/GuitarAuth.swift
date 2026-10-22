import Foundation
import UIKit
import React
import CryptoKit
import AuthenticationServices
import Security
import GoogleSignIn

/// Credentials stay on the native/React Native side, never in the score WebView.
@objc(GuitarAuth)
final class GuitarAuth:NSObject,ASAuthorizationControllerDelegate,ASAuthorizationControllerPresentationContextProviding {
 @objc static func requiresMainQueueSetup()->Bool{true}
 private var resolve:RCTPromiseResolveBlock?,reject:RCTPromiseRejectBlock?,nonce:String?
 private var controller:ASAuthorizationController?
 private func window()->UIWindow?{UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap{$0.windows}.first{$0.isKeyWindow}}
 private func presenter()->UIViewController?{var view=window()?.rootViewController;while let next=view?.presentedViewController{view=next};return view}
 private func finish(_ value:[String:Any]?,_ error:Error?=nil){if let error=error{let code=(error as NSError).code;reject?(code == ASAuthorizationError.canceled.rawValue || code == -5 ? "AUTH_CANCELLED" : "AUTH_FAILED","Authentication did not complete. Try again.",error)}else{resolve?(value)};resolve=nil;reject=nil;controller=nil;nonce=nil}
 @objc func signIn(_ provider:String,resolver resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){DispatchQueue.main.async{
  guard self.resolve==nil,let view=self.presenter() else{reject("AUTH_BUSY","Close the current sign-in window and try again.",nil);return}
  self.resolve=resolve;self.reject=reject
  var bytes=[UInt8](repeating:0,count:32)
  guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else{self.finish(nil,NSError(domain:"GuitarIO.Auth",code:1));return}
  let raw=Data(bytes).base64EncodedString(),hashed=SHA256.hash(data:Data(raw.utf8)).map{String(format:"%02x",$0)}.joined();self.nonce=raw
  if provider=="google"{
   guard let client=Bundle.main.object(forInfoDictionaryKey:"GIDClientID") as? String,let server=Bundle.main.object(forInfoDictionaryKey:"GIDServerClientID") as? String else{self.finish(nil,NSError(domain:"GuitarIO.Auth",code:2));return}
   GIDSignIn.sharedInstance.configuration=GIDConfiguration(clientID:client,serverClientID:server)
   GIDSignIn.sharedInstance.signIn(withPresenting:view,hint:nil,additionalScopes:nil,nonce:hashed){result,error in
    guard let user=result?.user,let token=user.idToken?.tokenString,error==nil else{self.finish(nil,error ?? NSError(domain:"GuitarIO.Auth",code:3));return}
    self.finish(["provider":"google","token":token,"accessToken":user.accessToken.tokenString,"nonce":raw])
   }
  }else if provider=="apple",Bundle.main.object(forInfoDictionaryKey:"GuitarAppleSignInEnabled") as? Bool == true{
   let request=ASAuthorizationAppleIDProvider().createRequest();request.requestedScopes=[.fullName,.email];request.nonce=hashed
   let controller=ASAuthorizationController(authorizationRequests:[request]);self.controller=controller;controller.delegate=self;controller.presentationContextProvider=self;controller.performRequests()
  }else{self.finish(nil,NSError(domain:"GuitarIO.Auth",code:4))}
 }}
 func presentationAnchor(for controller:ASAuthorizationController)->ASPresentationAnchor{window()!}
 func authorizationController(controller:ASAuthorizationController,didCompleteWithError error:Error){finish(nil,error)}
 func authorizationController(controller:ASAuthorizationController,didCompleteWithAuthorization authorization:ASAuthorization){
  guard let credential=authorization.credential as? ASAuthorizationAppleIDCredential,let data=credential.identityToken,let token=String(data:data,encoding:.utf8),let nonce=nonce else{finish(nil,NSError(domain:"GuitarIO.Auth",code:5));return}
  var result:[String:Any]=["provider":"apple","token":token,"nonce":nonce]
  if let data=credential.authorizationCode{result["authorizationCode"]=String(data:data,encoding:.utf8)}
  if let name=credential.fullName{let text=PersonNameComponentsFormatter().string(from:name);if !text.isEmpty{result["fullName"]=text}}
  finish(result)
 }
 @objc func signOut(_ resolve:@escaping RCTPromiseResolveBlock,rejecter reject:@escaping RCTPromiseRejectBlock){DispatchQueue.main.async{GIDSignIn.sharedInstance.signOut();resolve(nil)}}
}
