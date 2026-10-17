import * as Keychain from 'react-native-keychain';
import Purchases from 'react-native-purchases';
import {config} from './config';
import {entitlementFor,type Entitlement} from '../../src/plans';
type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};
const service='io.guitario.mobile.react-native.account';
export class MobileAccount {
 private purchasesConfigured=false;private purchasesUser?:string;
 session?:Session;entitlement:Entitlement=entitlementFor();generation=0;
 async restore(){const saved=await Keychain.getGenericPassword({service});if(saved){try{const data=JSON.parse(saved.password);if(data.url!==config.url)throw Error('Service changed');this.session=data.session;this.entitlement=data.entitlement||entitlementFor();}catch{await Keychain.resetGenericPassword({service});}}}
 async restoreLegacy(raw:string){const saved=JSON.parse(raw);if(saved.url!==config.url||!saved.session?.access_token||!saved.session?.refresh_token||!/^[a-f0-9-]{36}$/i.test(saved.session.user?.id||''))return;this.session=saved.session;this.entitlement=saved.entitlement||entitlementFor();await this.persist();}
 private async persist(){await Keychain.setGenericPassword('cloud-session',JSON.stringify({url:config.url,session:this.session,entitlement:this.entitlement}),{service,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
 async auth(path:string,body:any){if(!/^https:\/\/[a-z0-9.-]+$/.test(config.url)||!config.key)throw Error('Configure your Supabase project before signing in.');const r=await fetch(config.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.msg||data.error_description||'Account request failed.');return data;}
 async signIn(email:string,password:string){const generation=++this.generation,data=await this.auth('token?grant_type=password',{email,password});if(this.generation!==generation)throw Error('Account changed.');this.session={...data,expires_at:data.expires_at||Date.now()/1000+data.expires_in};await this.refresh();await this.persist();}
 async signUp(email:string,password:string){await this.auth('signup',{email,password});}
 async token(){if(!this.session)throw Error('Sign in first.');const generation=this.generation;if(this.session.expires_at<Date.now()/1000+60){const data=await this.auth('token?grant_type=refresh_token',{refresh_token:this.session.refresh_token});if(generation!==this.generation)throw Error('Account changed.');this.session={...data,expires_at:data.expires_at||Date.now()/1000+data.expires_in};await this.persist();}if(generation!==this.generation||!this.session)throw Error('Account changed.');return this.session.access_token;}
 async request<T=any>(route:string,body:any={}):Promise<T>{const generation=this.generation,token=await this.token();const r=await fetch(config.url+'/functions/v1/guitario?route='+encodeURIComponent(route),{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(generation!==this.generation)throw Error('Account changed.');if(!r.ok)throw Error(data.error||'Service unavailable.');return data;}
 async refresh(){const data=await this.request('account');this.entitlement=data.entitlement;await this.persist();await this.bindPurchases();}
 private async bindPurchases(){if(!config.revenueCatAppleKey||!this.session)return;const id=this.session.user.id;if(!this.purchasesConfigured){Purchases.configure({apiKey:config.revenueCatAppleKey,appUserID:id});this.purchasesConfigured=true;}else if(this.purchasesUser!==id)await Purchases.logIn(id);this.purchasesUser=id;}
 async signOut(){this.generation++;this.session=undefined;this.entitlement=entitlementFor();await Keychain.resetGenericPassword({service});this.purchasesUser=undefined;if(this.purchasesConfigured)await Purchases.logOut().catch(()=>{});}
 async purchase(cadence:'monthly'|'yearly'){await this.refresh();if(this.entitlement.plan==='pro')throw Error('Premium is already active. Manage the existing subscription or grant.');if(!config.revenueCatAppleKey)throw Error('Apple purchases need their RevenueCat public key.');const offerings=await Purchases.getOfferings(),pack=cadence==='monthly'?offerings.current?.monthly:offerings.current?.annual;if(!pack)throw Error('Apple subscription products are not configured.');await Purchases.purchasePackage(pack);await this.refresh();}
 async restorePurchases(){if(!this.session||!config.revenueCatAppleKey)throw Error('Sign in and configure Apple purchases first.');await this.refresh();await Purchases.restorePurchases();await this.refresh();}
}
export const mobileAccount=new MobileAccount();
