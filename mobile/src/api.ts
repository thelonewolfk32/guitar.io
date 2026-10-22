import * as Keychain from 'react-native-keychain';
import Purchases from 'react-native-purchases';
import {NativeModules} from 'react-native';
import {config} from './config';
import {entitlementFor,type Entitlement} from '../../src/plans';
import {AccountAuth,mobileCallback,type AccountSession,type Provider,type ProviderCredential} from '../../shared/auth';
import {capabilities} from './capabilities';
type Session=AccountSession;
const service='io.guitario.mobile.react-native.account';
const authStore={async getItem(key:string){const value=await Keychain.getGenericPassword({service:service+'.sdk.'+key});return value?value.password:null;},async setItem(key:string,value:string){await Keychain.setGenericPassword('auth',value,{service:service+'.sdk.'+key,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},async removeItem(key:string){await Keychain.resetGenericPassword({service:service+'.sdk.'+key});}};
export class MobileAccount {
 private purchasesConfigured=false;private purchasesUser?:string;
 private authClient=new AccountAuth(config.url,config.key,authStore,mobileCallback);private hydrated=false;private refreshing?:Promise<void>;
 private async legacyConsumed(mark=false){const marker=service+'.legacy-import',value=await Keychain.getGenericPassword({service:marker});let urls:string[]=[];try{const data=value?JSON.parse(value.password):[];if(Array.isArray(data))urls=data.filter(v=>typeof v==='string');}catch{}const used=urls.includes(config.url);if(mark&&!used)await Keychain.setGenericPassword('imported',JSON.stringify([...urls,config.url].slice(-32)),{service:marker,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});return used;}
 session?:Session;entitlement:Entitlement=entitlementFor();generation=0;
 async restore(){const saved=await Keychain.getGenericPassword({service});if(saved){try{const data=JSON.parse(saved.password);if(data.url!==config.url)throw Error('Service changed');this.session=data.session;this.entitlement=data.entitlement||entitlementFor();}catch{await Keychain.resetGenericPassword({service});}}}
 async restoreLegacy(raw:string){if(await this.legacyConsumed())return;const saved=JSON.parse(raw);if(saved.url!==config.url||!saved.session?.access_token||!saved.session?.refresh_token||!/^[a-f0-9-]{36}$/i.test(saved.session.user?.id||''))return;this.session=saved.session;this.entitlement=saved.entitlement||entitlementFor();await this.persist();await this.legacyConsumed(true);}
 private async persist(){await Keychain.setGenericPassword('cloud-session',JSON.stringify({url:config.url,session:this.session,entitlement:this.entitlement}),{service,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
 private async adopt(session:Session,generation:number){if(this.generation!==generation){await this.authClient.signOut();throw Error('Account changed.');}this.hydrated=true;this.session=session;this.entitlement=entitlementFor();await this.persist();await this.refresh();}
 private async hydrate(){if(!this.hydrated&&this.session){await this.authClient.setSession(this.session);this.hydrated=true;}}
 async signIn(email:string,password:string){const generation=++this.generation;await this.adopt(await this.authClient.signIn(email,password),generation);}
 async signUp(email:string,password:string){await this.authClient.signUp(email,password);}
 async resetPassword(email:string){await this.authClient.recover(email);}
 async callback(url:string){const generation=++this.generation,value=await this.authClient.callbackSession(url);await this.adopt(value.session,generation);return value.recovery;}
 async updatePassword(password:string){await this.hydrate();await this.authClient.updatePassword(password);}
 async provider(provider:Provider,link=false){
  if(provider==='apple'?!capabilities.appleSignIn:!capabilities.googleSignIn)throw Error('This sign-in provider is not configured for this build.');
  const old=this.session?.user.id,generation=link?this.generation:++this.generation;
  if(link){if(!old)throw Error('Sign in before linking another provider.');await this.hydrate();}
  const credential=await NativeModules.GuitarAuth.signIn(provider) as ProviderCredential;
  const session=await this.authClient.credential(credential,link);
  if(link&&session.user.id!==old)throw Error('Account identity changed. No libraries were merged.');
  await this.adopt(session,generation);
 }
 async token(){if(!this.session)throw Error('Sign in first.');const generation=this.generation;
  if(this.session.expires_at<Date.now()/1000+60){this.refreshing ||= (async()=>{await this.hydrate();const session=await this.authClient.refresh();if(generation!==this.generation)throw Error('Account changed.');this.session=session;await this.persist();})().finally(()=>{this.refreshing=undefined;});await this.refreshing;}
  if(generation!==this.generation||!this.session)throw Error('Account changed.');return this.session.access_token;
 }
 async request<T=any>(route:string,body:any={}):Promise<T>{const generation=this.generation,token=await this.token();const r=await fetch(config.url+'/functions/v1/guitario?route='+encodeURIComponent(route),{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(generation!==this.generation)throw Error('Account changed.');if(!r.ok)throw Error(data.error||'Service unavailable.');return data;}
 async refresh(){const data=await this.request('account');this.entitlement=data.entitlement;await this.persist();await this.bindPurchases();}
 private async bindPurchases(){if(!capabilities.purchases||!config.revenueCatAppleKey||!this.session)return;const id=this.session.user.id;if(!this.purchasesConfigured){Purchases.configure({apiKey:config.revenueCatAppleKey,appUserID:id});this.purchasesConfigured=true;}else if(this.purchasesUser!==id)await Purchases.logIn(id);this.purchasesUser=id;}
 async signOut(){this.generation++;this.session=undefined;this.hydrated=false;this.entitlement=entitlementFor();await this.legacyConsumed(true);await Keychain.resetGenericPassword({service});await this.authClient.signOut().catch(()=>{});await NativeModules.GuitarAuth?.signOut();this.purchasesUser=undefined;if(this.purchasesConfigured)await Purchases.logOut().catch(()=>{});}
 async deleteAccount(password:string){
  if(!this.session)throw Error('Sign in first.');const id=this.session.user.id;await this.hydrate();const {data,error}=await this.authClient.client.auth.getUser();if(error)throw error;
  const prepared=await this.request('prepare-account-deletion',{confirmation:'DELETE'});
  try{
  const providers=data.user.identities?.map(i=>i.provider)||[],body:Record<string,string>={confirmation:'DELETE',nonce:prepared.nonce};
  for(const provider of providers.filter((p):p is Provider=>p==='google'||p==='apple')){
   const credential=await NativeModules.GuitarAuth.signIn(provider) as ProviderCredential;
   if(provider==='google')body.googleAccessToken=credential.accessToken||'';else body.appleCode=credential.authorizationCode||'';
   const session=await this.authClient.credential(credential);if(session.user.id!==id){this.hydrated=false;throw Error('Choose the provider account linked to this Guitar.io account.');}this.session=session;
  }
  if(!providers.some(p=>p==='google'||p==='apple')){const session=await this.authClient.signIn(this.session.user.email||'',password);if(session.user.id!==id)throw Error('Account changed.');this.session=session;}
  await this.persist();const result=await this.request('delete-account',body);await this.signOut();return result;
  }catch(error){await this.request('cancel-account-deletion',{nonce:prepared.nonce}).catch(()=>{});throw error;}
 }
 async purchase(cadence:'monthly'|'yearly'){if(!capabilities.purchases)throw Error('Apple purchases need the full build profile.');await this.refresh();if(this.entitlement.plan==='pro')throw Error('Premium is already active. Manage the existing subscription or grant.');if(!config.revenueCatAppleKey)throw Error('Apple purchases need their RevenueCat public key.');const offerings=await Purchases.getOfferings(),pack=cadence==='monthly'?offerings.current?.monthly:offerings.current?.annual;if(!pack)throw Error('Apple subscription products are not configured.');await Purchases.purchasePackage(pack);await this.refresh();}
 async restorePurchases(){if(!this.session||!config.revenueCatAppleKey)throw Error('Sign in and configure Apple purchases first.');await this.refresh();await Purchases.restorePurchases();await this.refresh();}
}
export const mobileAccount=new MobileAccount();
