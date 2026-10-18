import {entitlementFor,featureAccess,type Grant} from '../../../src/plans.ts';
import {parseSongLink} from '../../../src/share-model.ts';
type REST=(route:string,method?:string,body?:unknown)=>Promise<any>;
type Context={rest:REST;env:(name:string)=>string|undefined;fetcher:typeof fetch};
const encode=encodeURIComponent;
export function featureRoutes({rest,env,fetcher}:Context){
 async function snapshot(id:string){
  const [billing,owner]=await Promise.all([rest('billing_grants?user_id=eq.'+id+'&active=eq.true&expires_at=gt.'+encode(new Date().toISOString())),rest('owner_grants?user_id=eq.'+id+'&revoked_at=is.null')]);
  const grants:Grant[]=[...billing.map((g:any)=>({id:g.subscription_id,source:g.provider,kind:'premium',expiresAt:g.expires_at})),...owner.map((g:any)=>({id:g.id,source:'owner',kind:g.kind,expiresAt:g.expires_at,extraSongs:g.extra_songs,extraBytes:Number(g.extra_bytes)}))];
  return entitlementFor(grants);
 }
 async function owner(id:string,token:string){
  const claims=JSON.parse(atob(token.slice(7).split('.')[1].replaceAll('-','+').replaceAll('_','/')));
  if(claims.aal!=='aal2'||!(await rest('owner_roles?user_id=eq.'+id)).length)throw Error('Owner access with MFA is required.');
 }
 async function premium(id:string){if(!featureAccess(await snapshot(id)).onlineImport)throw Error('Premium includes online import automation.');}
 async function resolve(link:ReturnType<typeof parseSongLink>){
  let metadata:any={title:'',artist:'',url:link.url};
  if(link.provider==='spotify'||link.provider==='youtube'){
   const endpoint=link.provider==='spotify'?'https://open.spotify.com/oembed?url=':'https://www.youtube.com/oembed?format=json&url=';
   const r=await fetcher(endpoint+encode(link.url),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Music metadata is unavailable. You can enter the details manually.');
   const data=await r.json();metadata.title=String(data.title||'').slice(0,200);metadata.attribution=link.provider==='spotify'?'Spotify':'YouTube';
  }else{
   const token=env('APPLE_MUSIC_DEVELOPER_TOKEN');if(!token)throw Error('Apple Music metadata needs its developer token. The shared link is saved.');
   const r=await fetcher('https://api.music.apple.com/v1/catalog/'+link.url.split('/')[3]+'/songs/'+link.id,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Apple Music metadata is unavailable.');
   const data=(await r.json()).data?.[0]?.attributes;if(!data)throw Error('This Apple Music song was not found.');metadata={...metadata,title:data.name,artist:data.artistName,album:data.albumName,attribution:'Apple Music'};
  }return metadata;
 }
 return {snapshot,owner,async handle(route:string,id:string,token:string,body:any){
  if(route==='entries')return {entries:await rest('library_entries?user_id=eq.'+id)};
  if(route==='reserve-entries'){
   if(!Array.isArray(body.entries)||body.entries.length>100)throw Error('Invalid song reservations.');
   for(const e of body.entries){if(typeof e.id!=='string'||e.id.length>200||!['pending','score'].includes(e.kind))throw Error('Invalid entry.');if(e.kind==='pending'){const link=parseSongLink(e.details?.link?.url||'');e.details={title:String(e.details.title||'Shared song').slice(0,200),artist:String(e.details.artist||'').slice(0,200),link,createdAt:new Date().toISOString()};}}
   return rest('rpc/reserve_entries','POST',{p_user:id,p_entries:body.entries});
  }
  if(route==='active-entries'){if(!Array.isArray(body.ids)||body.ids.some((x:any)=>typeof x!=='string'))throw Error('Invalid active entries.');await rest('rpc/set_active_entries','POST',{p_user:id,p_ids:body.ids});return {saved:true};}
  if(route==='delete-entry'){if(typeof body.id!=='string')throw Error('Invalid entry.');const current=await rest('library_entries?user_id=eq.'+id+'&id=eq.'+encode(body.id));if(current[0]?.kind!=='pending')throw Error('Delete playable songs through library sync.');await rest('library_entries?user_id=eq.'+id+'&id=eq.'+encode(body.id),'PATCH',{deleted:true,active:false});return {saved:true};}
  if(route==='share-resolve'){await premium(id);return {metadata:await resolve(parseSongLink(body.url||''))};}
  if(route==='gp-search'){
   await premium(id);const title=String(body.title||'').trim().slice(0,200),artist=String(body.artist||'').trim().slice(0,200);if(!title)throw Error('Enter a song title before searching.');
   const key=env('BRAVE_SEARCH_API_KEY');if(!key)throw Error('GP search needs the Brave Search API configuration.');
   const q=[artist,title,'Guitar Pro tab (site:songsterr.com OR site:ultimate-guitar.com OR site:sheethappenspublishing.com OR site:guitar-pro.com)'].join(' ');
   const r=await fetcher('https://api.search.brave.com/res/v1/web/search?q='+encode(q)+'&count=8',{headers:{'X-Subscription-Token':key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('GP search is temporarily unavailable.');
   const results=(await r.json()).web?.results||[];return {matches:results.filter((x:any)=>{try{const u=new URL(x.url);return u.protocol==='https:'&&['songsterr.com','ultimate-guitar.com','sheethappenspublishing.com','guitar-pro.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}).map((x:any)=>({title:String(x.title).slice(0,300),url:x.url,description:String(x.description||'').slice(0,500)})),automaticDownload:false};
  }
  if(route==='feedback'){
   if(!['bug','idea'].includes(body.category)||typeof body.message!=='string'||!body.message.trim()||body.message.length>5000)throw Error('Choose a category and enter up to 5,000 characters.');
   const diagnostics=body.diagnostics?{version:String(body.diagnostics.version||'').slice(0,30),platform:String(body.diagnostics.platform||'').slice(0,30)}:null;
   if((body.attachments||[]).length)throw Error('Use the feedback attachment upload route after saving feedback.');
   const row=await rest('feedback','POST',{user_id:id,category:body.category,message:body.message.trim(),contact_allowed:body.contactAllowed===true,diagnostics});return {id:row[0].id};
  }
  if(route==='feedback-attachment'){
   if(!/^[a-f0-9-]{36}$/i.test(body.id||'')||typeof body.data!=='string'||body.data.length>1400000||!['image/png','image/jpeg','text/plain'].includes(body.mime))throw Error('Choose a PNG, JPEG or text file up to 1 MB.');
   const rows=await rest('feedback?id=eq.'+body.id+'&user_id=eq.'+id);if(!rows.length||rows[0].attachments.length>=2)throw Error('Feedback not found or attachment limit reached.');
   const bytes=Uint8Array.from(atob(body.data),c=>c.charCodeAt(0));if(bytes.length>1048576)throw Error('Attachment exceeds 1 MB.');if(body.mime==='image/png'&&!(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)||body.mime==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216))throw Error('Image format does not match.');
   const path=id+'/'+body.id+'/'+crypto.randomUUID(),r=await fetcher(env('SUPABASE_URL')+'/storage/v1/object/feedback-attachments/'+path,{method:'POST',headers:{Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),apikey:env('SUPABASE_SERVICE_ROLE_KEY')!,'Content-Type':body.mime},body:bytes});if(!r.ok)throw Error('Attachment upload failed.');
   await rest('feedback?id=eq.'+body.id+'&user_id=eq.'+id,'PATCH',{attachments:[...rows[0].attachments,{name:String(body.name||'Attachment').slice(0,200),mime:body.mime,path}]});return {saved:true};
  }
  if(route==='usage-consent'){if(typeof body.enabled!=='boolean')throw Error('Choose a usage preference.');await rest('usage_consent?on_conflict=user_id','POST',{user_id:id,enabled:body.enabled});return {saved:true};}
  if(route==='usage'){await rest('rpc/record_usage','POST',{p_user:id,p_batch:body.batchId,p_counts:body.counts});return {saved:true};}
  if(route==='practice'){
   const events=body.events;if(!Array.isArray(events)||events.length>100)throw Error('Invalid practice events.');
   for(const e of events){if(!/^[a-f0-9-]{36}$/i.test(e.id)||e.version!==1||!['session','progress'].includes(e.kind)||typeof e.songId!=='string'||JSON.stringify(e.data).length>10000)throw Error('Invalid practice event.');await rest('rpc/save_practice','POST',{p_user:id,p_event:e});}return {saved:true};
  }
  if(route.startsWith('owner-')){
   await owner(id,token);
   if(route==='owner-accounts')return {accounts:await rest('rpc/owner_accounts','POST',{p_search:String(body.search||'').slice(0,200)})};
   if(route==='owner-change'){if(!/^[a-f0-9-]{36}$/i.test(body.target||'')||!['grant','revoke','status'].includes(body.action))throw Error('Invalid owner change.');await rest('rpc/owner_change','POST',{p_actor:id,p_target:body.target,p_action:body.action,p_details:body.details||{}});return {saved:true};}
   if(route==='owner-feedback'){const feedback=await rest('feedback?order=created_at.desc&limit=100');for(const f of feedback)for(const a of f.attachments){const r=await fetcher(env('SUPABASE_URL')+'/storage/v1/object/sign/feedback-attachments/'+a.path,{method:'POST',headers:{Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),apikey:env('SUPABASE_SERVICE_ROLE_KEY')!,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});if(r.ok)a.url=env('SUPABASE_URL')+'/storage/v1'+(await r.json()).signedURL;}return {feedback};}
   if(route==='owner-feedback-status'){if(!['new','reviewing','planned','closed'].includes(body.status)||!/^[a-f0-9-]{36}$/i.test(body.id||''))throw Error('Invalid feedback status.');await rest('feedback?id=eq.'+body.id,'PATCH',{status:body.status});await rest('owner_audit','POST',{actor:id,action:'feedback-status',details:{id:body.id,status:body.status}});return {saved:true};}
   if(route==='owner-usage')return {counts:await rest('usage_daily?order=day.desc&limit=365'),audit:await rest('owner_audit?order=created_at.desc&limit=100'),operations:await rest('rpc/ops_snapshot','POST',{})};
  }
  return undefined;
 }};
}
