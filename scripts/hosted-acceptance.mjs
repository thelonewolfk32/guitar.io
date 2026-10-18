// Destructive only to the explicitly designated, empty staging fixture account.
import {createHash,randomUUID} from 'node:crypto';
try{process.loadEnvFile('.env.acceptance.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const url=new URL(process.env.SUPABASE_URL||''),ref=url.hostname.split('.')[0],key=process.env.SUPABASE_PUBLISHABLE_KEY,token=process.env.STAGING_TEST_ACCESS_TOKEN;
if(url.protocol!=='https:'||!/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)||process.env.HOSTED_ACCEPTANCE_ALLOW!==ref||!key||!token)throw Error('Configure an explicit staging project and isolated fixture-account token.');
const headers={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},id='acceptance-'+randomUUID(),hash=createHash('sha256').update('hosted upload size fixture').digest('hex'),bytes=Buffer.from('hosted upload size fixture');
async function request(route,body){const r=await fetch(url.origin+'/functions/v1/guitario?route='+route,{method:'POST',headers,body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Hosted acceptance failed.');return data;}
const user=await (await fetch(url.origin+'/auth/v1/user',{headers})).json();if(!user.id)throw Error('Fixture session expired.');
const initial=await request('entries',{});if(initial.entries.some(e=>!e.deleted))throw Error('Use an empty, disposable staging account.');
const wire=(entity,entityId,operation,patch={})=>({key:entity+'/'+entityId,entity,entityId,operation,deviceId:randomUUID(),timestamp:new Date().toISOString(),fields:Object.keys(patch),patch,revision:1,complete:true});
const ids=[];try{
 await request('reserve-entries',{entries:[{id,kind:'score'}]});ids.push(id);
 await request('cloud-push',{rows:[wire('source',id,'upsert',{hash,byteLength:bytes.length})]});const reservation=await request('cloud-reserve',{kind:'source',id,hash,size:bytes.length});
 for(const size of [bytes.length-1,bytes.length+1]){const r=await fetch(url.origin+'/storage/v1/object/library/'+reservation.path,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:Buffer.alloc(size)});if(r.ok)throw Error('Storage API accepted bytes outside the reservation.');}
 const upload=await fetch(url.origin+'/storage/v1/object/library/'+reservation.path,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes});if(!upload.ok)throw Error('Valid reserved upload failed.');await request('cloud-finish',{kind:'source',id});
 const download=await request('cloud-file',{kind:'source',id}),actual=Buffer.from(await (await fetch(url.origin+'/storage/v1/object/authenticated/library/'+download.path,{headers})).arrayBuffer());if(!actual.equals(bytes))throw Error('Hosted round trip changed the original bytes.');
 const slots=Array.from({length:3},()=>({id:'acceptance-'+randomUUID(),kind:'pending',details:{link:{url:'https://youtu.be/abcdefghijk'},title:'Fixture'}}));await request('reserve-entries',{entries:slots});ids.push(...slots.map(e=>e.id));
 const one={id:'acceptance-'+randomUUID(),kind:'score'},two={id:'acceptance-'+randomUUID(),kind:'score'};ids.push(one.id,two.id);const raced=await Promise.allSettled([request('reserve-entries',{entries:[one]}),request('reserve-entries',{entries:[two]})]);if(raced.filter(r=>r.status==='fulfilled').length!==1)throw Error('Five-entry race enforcement failed. Use a Free account without grants.');
 console.log('PASS hosted actual-size enforcement, verified original bytes and simultaneous five-entry reservations.');
}finally{for(const entry of ids){try{const current=(await request('entries',{})).entries.find(e=>e.id===entry&&!e.deleted);if(current?.kind==='pending')await request('delete-entry',{id:entry});else if(current)await request('cloud-push',{rows:[wire('song',entry,'delete'),wire('source',entry,'delete')]});}catch{console.error('Fixture cleanup needs an owner check.');}}}
