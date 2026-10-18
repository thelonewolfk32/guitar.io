import {createClient,type SupabaseClient,type SupportedStorage} from '@supabase/supabase-js';
export type Provider='google'|'apple';
export type ProviderCredential={provider:Provider;token:string;nonce:string;accessToken?:string;authorizationCode?:string;fullName?:string};
export type AccountSession={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string;identities?:{provider:string;identity_data?:Record<string,unknown>}[]}};
export const mobileCallback='io.guitario.mobile.auth://callback';
/** Exact callback matching. No implicit-flow bearer tokens are accepted in URLs. */
export function authCallback(value:string,expected:string){
 const u=new URL(value),target=new URL(expected);
 if(u.protocol!==target.protocol||u.host!==target.host||u.pathname!==target.pathname||u.username||u.password||u.hash)throw Error('Unrecognised sign-in callback.');
 if(u.searchParams.has('error'))throw Error('Sign-in was cancelled or the link expired.');
 const code=u.searchParams.get('code'),hash=u.searchParams.get('token_hash'),type=u.searchParams.get('type'),flowId=u.searchParams.get('sb_flow_id');
 if(flowId&&!/^[a-zA-Z0-9_-]{8,64}$/.test(flowId))throw Error('Invalid sign-in flow.');
 if(code&&code.length<4096&&!hash)return {code,...(flowId?{flowId}:{})};
 if(hash&&hash.length<4096&&['signup','recovery','email'].includes(type||'')&&!code)return {hash,type:type as 'signup'|'recovery'|'email'};
 throw Error('This sign-in link is incomplete. Request a new email.');
}
export class AccountAuth {
 private sdk?:SupabaseClient;
 constructor(private url:string,private key:string,private storage:SupportedStorage,readonly callback:string){}
 private get storageKey(){return 'guitario-auth-'+new URL(this.url).host;}
 get client(){
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(this.url)||!this.key)throw Error('Configure your Supabase project before signing in.');
  return this.sdk ||= createClient(this.url,this.key,{global:{fetch:async(input,init)=>{const controller=new AbortController(),abort=()=>controller.abort();if(init?.signal?.aborted)abort();init?.signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,15000);try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);init?.signal?.removeEventListener('abort',abort);}}},auth:{storage:this.storage,storageKey:this.storageKey,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'}});
 }
 async setSession(session:AccountSession){const {error}=await this.client.auth.setSession(session);if(error)throw error;}
 async current(){const {data,error}=await this.client.auth.getSession();if(error)throw error;return data.session as AccountSession|null;}
 async signIn(email:string,password:string){const {data,error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;return data.session as AccountSession;}
 async signUp(email:string,password:string){const {error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:this.callback}});if(error)throw error;}
 async recover(email:string){const {error}=await this.client.auth.resetPasswordForEmail(email,{redirectTo:this.callback});if(error)throw error;}
 async credential(value:ProviderCredential,link=false){
  const credentials={provider:value.provider,token:value.token,nonce:value.nonce,access_token:value.accessToken};
  const {data,error}=link?await this.client.auth.linkIdentity(credentials):await this.client.auth.signInWithIdToken(credentials);
  if(error)throw error;
  if(value.provider==='apple'&&value.fullName){const updated=await this.client.auth.updateUser({data:{full_name:value.fullName}});if(updated.error)throw updated.error;}
  if(!('session' in data)||!data.session)throw Error('Provider did not return a session.');return data.session as AccountSession;
 }
 async callbackSession(value:string){const parsed=authCallback(value,this.callback);
  const {data,error}='code' in parsed?await this.client.auth.exchangeCodeForSession(parsed.code!,parsed.flowId?{flowId:parsed.flowId}:undefined):await this.client.auth.verifyOtp({token_hash:parsed.hash!,type:parsed.type!});
  if(error)throw error;if(!data.session)throw Error('The link has expired. Request a new email.');
  return {session:data.session as AccountSession,recovery:('type' in parsed&&parsed.type==='recovery')||('redirectType' in data&&data.redirectType==='recovery')};
 }
 async updatePassword(password:string){if(password.length<12)throw Error('Use at least 12 characters.');const {error}=await this.client.auth.updateUser({password});if(error)throw error;}
 async refresh(){const {data,error}=await this.client.auth.refreshSession();if(error)throw error;return data.session as AccountSession;}
 async signOut(){try{if(this.sdk){const {error}=await this.sdk.auth.signOut({scope:'local'});if(error)throw error;}}finally{
  this.sdk=undefined;if(this.url&&this.key){const key=this.storageKey;let flows:string[]=[];try{const values=JSON.parse(await this.storage.getItem(key+'-flows-code-verifier')||'[]');if(Array.isArray(values))flows=values.filter(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,64}$/.test(id));}catch{}
   for(const name of [key,key+'-user',key+'-code-verifier',key+'-flows-code-verifier',...flows.map(id=>key+'-flow-'+id+'-code-verifier')])await this.storage.removeItem(name);
  }
 }}
}
