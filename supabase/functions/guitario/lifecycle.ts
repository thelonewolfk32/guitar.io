type Context={rest:(route:string,method?:string,body?:unknown)=>Promise<any>;env:(name:string)=>string|undefined;fetcher:typeof fetch};
const encode=encodeURIComponent;
const decode=(value:string)=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));
export function recentAuthentication(token:string,now=Date.now()){
 try{const claims=decode(token.replace(/^Bearer /,'').split('.')[1]);return Array.isArray(claims.amr)&&claims.amr.some((a:any)=>['password','oauth','otp','totp','id_token'].includes(a.method)&&Number.isFinite(a.timestamp)&&a.timestamp*1000<=now+30000&&now-a.timestamp*1000<300000);}catch{return false;}
}
export function lifecycleRoutes({rest,env,fetcher}:Context){
 const required=(name:string)=>{const value=env(name);if(!value)throw Error('Configure account operations: '+name);return value;};
 const headers=()=>({apikey:required('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+required('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'});
 async function storage(route:string,method:string,body?:unknown){const r=await fetcher(required('SUPABASE_URL')+'/storage/v1/'+route,{method,headers:headers(),body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Storage operation did not complete. It will be retried.');return r.status===204?null:r.json();}
 async function objectPaths(bucket:string,prefix:string):Promise<string[]>{let result:string[]=[];for(let offset=0;;offset+=100){const page=await storage('object/list/'+bucket,'POST',{prefix,limit:100,offset,sortBy:{column:'name',order:'asc'}});for(const item of page){const path=prefix+'/'+item.name;if(item.id===null)result.push(...await objectPaths(bucket,path));else result.push(path);}if(page.length<100)break;}return result;}
 async function eraseFiles(id:string){for(const bucket of ['library','feedback-attachments']){const paths=await objectPaths(bucket,id);for(let i=0;i<paths.length;i+=100)await storage('object/'+bucket,'DELETE',{prefixes:paths.slice(i,i+100)});}}
 async function appleSecret(){
  const enc=(value:Uint8Array|string)=>btoa(typeof value==='string'?value:String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const now=Math.floor(Date.now()/1000),head=enc(JSON.stringify({alg:'ES256',kid:required('APPLE_SIGN_IN_KEY_ID')})),payload=enc(JSON.stringify({iss:required('APPLE_SIGN_IN_TEAM_ID'),iat:now,exp:now+300,aud:'https://appleid.apple.com',sub:required('APPLE_NATIVE_CLIENT_ID')}));
  const pem=required('APPLE_SIGN_IN_PRIVATE_KEY').replaceAll('\\n','\n').replace(/-----[^-]+-----|\s/g,''),key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  return head+'.'+payload+'.'+enc(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(head+'.'+payload))));
 }
 async function revokeApple(user:any,code:string){
  if(!code||code.length>4096)throw Error('Confirm Apple sign-in again to delete this account.');const secret=await appleSecret();
  const r=await fetcher('https://appleid.apple.com/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:required('APPLE_NATIVE_CLIENT_ID'),client_secret:secret,code,grant_type:'authorization_code'})});
  if(!r.ok)throw Error('Apple verification expired. Confirm Apple sign-in again.');const tokens=await r.json(),sub=decode(tokens.id_token.split('.')[1]).sub;
  if(!user.identities?.some((i:any)=>i.provider==='apple'&&i.identity_data?.sub===sub))throw Error('Choose the Apple account linked to this Guitar.io account.');
  const result=await fetcher('https://appleid.apple.com/auth/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:required('APPLE_NATIVE_CLIENT_ID'),client_secret:secret,token:tokens.refresh_token||tokens.access_token,token_type_hint:tokens.refresh_token?'refresh_token':'access_token'})});if(!result.ok)throw Error('Apple revocation did not complete. Try again.');
 }
 async function revokeGoogle(user:any,token:string){
  if(!token||token.length>8192)throw Error('Confirm Google sign-in again to delete this account.');const r=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Google verification expired. Confirm Google sign-in again.');const info=await r.json();
  if(!user.identities?.some((i:any)=>i.provider==='google'&&i.identity_data?.sub===info.sub))throw Error('Choose the Google account linked to this Guitar.io account.');
  const revoked=await fetcher('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})});if(!revoked.ok)throw Error('Google revocation did not complete. Try again.');
 }
 async function completeDeletion(id:string){
  if((await rest('backup_lease?expires_at=gt.'+encode(new Date().toISOString()))).length)throw Error('A backup is finishing. Account deletion is queued.');
  const jobs=await rest('account_deletions?user_id=eq.'+id);if(!jobs.length||!['requested','files'].includes(jobs[0].status))return;
  const identity=await fetcher(required('SUPABASE_URL')+'/auth/v1/admin/users/'+id,{headers:headers()});if(!identity.ok&&identity.status!==404)throw Error('Account cleanup will retry.');const user=identity.status===404?{}:await identity.json();
  for(const provider of ['apple','google'])if(user.identities?.some((i:any)=>i.provider===provider)&&!jobs[0][provider+'_revoked'])throw Error('Confirm linked providers to finish account deletion.');
  await eraseFiles(id);await rest('rpc/purge_account_relations','POST',{p_user:id});await rest('account_deletions?user_id=eq.'+id,'PATCH',{status:'files'});
  const removed=await fetcher(required('SUPABASE_URL')+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:headers(),body:JSON.stringify({should_soft_delete:false})});if(!removed.ok&&removed.status!==404)throw Error('Account cleanup will retry.');
  await rest('account_deletions?user_id=eq.'+id,'PATCH',{status:'complete'});
 }
 async function deleteAccount(user:any,token:string,body:any){
  if(body.confirmation!=='DELETE'||!recentAuthentication(token))throw Error('Sign in again within five minutes to confirm account deletion.');
  if((await rest('owner_roles?user_id=eq.'+user.id)).length)throw Error('Transfer the owner role before deleting this account.');
  // Validate and revoke providers before suspending the account. Failed steps are retryable.
  const jobs=await rest('account_deletions?user_id=eq.'+user.id),prior=jobs[0];if(!prior||prior.nonce!==body.nonce||prior.status!=='providers')throw Error('Start account deletion again.');
  for(const provider of ['google','apple'])if(user.identities?.some((i:any)=>i.provider===provider)){
   if(provider==='apple')await revokeApple(user,String(body.appleCode||''));else await revokeGoogle(user,String(body.googleAccessToken||''));
   await rest('account_deletions?user_id=eq.'+user.id+'&nonce=eq.'+encode(body.nonce),'PATCH',{[provider+'_revoked']:true});
  }
  await rest('rpc/begin_account_deletion','POST',{p_user:user.id,p_nonce:body.nonce});try{await completeDeletion(user.id);return {deleted:true};}catch{return {queued:true};}
 }
 async function maintenance(){
  await rest('rpc/storage_scan','POST',{});const candidates=await rest('storage_orphans?first_seen=lt.'+encode(new Date(Date.now()-7*86400000).toISOString())+'&order=first_seen.asc&limit=100');let removed=0;
  for(const item of candidates)if(await rest('rpc/storage_claim','POST',{p_bucket:item.bucket,p_path:item.path})){await storage('object/'+item.bucket,'DELETE',{prefixes:[item.path]});await rest('storage_orphans?bucket=eq.'+encode(item.bucket)+'&path=eq.'+encode(item.path),'DELETE');removed++;}
  const jobs=await rest('account_deletions?status=in.(requested,files)&limit=50');let deletions=0;for(const job of jobs){try{await completeDeletion(job.user_id);deletions++;}catch{/* Durable queue remains for the next run; no tokens are logged. */}}
  const metrics=await rest('rpc/ops_snapshot','POST',{}),values={storageBytes:Number(metrics.storageBytes),downloadBytes:Number(metrics.usage.download_descriptor_bytes||0),invocations:Number(metrics.usage.invocations||0),estimatedCostUsd:0};
  values.estimatedCostUsd=Number(env('OPS_BASE_COST_USD')||0)+values.storageBytes/1024**3*Number(env('OPS_STORAGE_GIB_USD')||0)+values.downloadBytes/1024**3*Number(env('OPS_DOWNLOAD_GIB_USD')||0)+values.invocations/1000000*Number(env('OPS_MILLION_FUNCTIONS_USD')||0);
  const limits={storageBytes:Number(env('OPS_STORAGE_LIMIT_BYTES')),downloadBytes:Number(env('OPS_DOWNLOAD_LIMIT_BYTES')),invocations:Number(env('OPS_FUNCTION_LIMIT')),estimatedCostUsd:Number(env('OPS_COST_LIMIT_USD'))};
  for(const name of Object.keys(values) as (keyof typeof values)[])for(const threshold of [50,80,95])if(limits[name]>0&&values[name]>=limits[name]*threshold/100)await rest('ops_alerts?on_conflict=period,metric,threshold','POST',{period:new Date().toISOString().slice(0,7)+'-01',metric:name,threshold,value:values[name],limit_value:limits[name]});
  return {removed,deletions,values,limits,trafficBasis:'Download descriptors are an estimate. Reconcile against Supabase billing usage, including retries and non-app requests.'};
 }
 return {deleteAccount,maintenance,async cancelDelete(user:any,body:any){if(!/^[a-f0-9-]{36}$/i.test(body.nonce||''))throw Error('Invalid deletion confirmation.');return {cancelled:await rest('rpc/cancel_account_deletion','POST',{p_user:user.id,p_nonce:body.nonce})};},async prepareDelete(user:any,body:any){if(body.confirmation!=='DELETE')throw Error('Confirm account deletion.');return {nonce:await rest('rpc/prepare_account_deletion','POST',{p_user:user.id})};}};
}
