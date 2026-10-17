import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {entitlementFor,featureAccess,canAddEntries} from '../src/plans.ts';import {parseSongLink} from '../src/share-model.ts';import {PracticeTimer} from '../src/education.ts';import {createHandler} from '../supabase/functions/guitario/service.ts';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
test('free capabilities and independent owner grants expire without granting cloud billing privileges',()=>{
 const free=featureAccess();assert(free.cloudSync&&free.learning);assert(!free.autoSections&&!free.youtubeSync&&!free.onlineImport);assert.equal(free.limits.songs,5);assert.equal(free.limits.bytes,150*1024**2);
 const now=Date.parse('2026-10-17'),grants=[{id:'gift',source:'owner',kind:'premium',expiresAt:'2026-10-18'},{id:'goodwill',source:'owner',kind:'limits',extraSongs:3}];
 assert.equal(featureAccess(entitlementFor(grants,now),now).limits.songs,null);assert.equal(featureAccess(entitlementFor(grants,now+2*86400000),now+2*86400000).limits.songs,8);assert.equal(canAddEntries(5,1),false);
});
test('sharing canonicalises song identity and rejects credentials, playlists and unrelated URLs',()=>{
 assert.equal(parseSongLink('Song https://open.spotify.com/track/1234567890123456789012?si=tracking').url,'https://open.spotify.com/track/1234567890123456789012');
 assert.equal(parseSongLink('https://youtu.be/abcdefghijk?t=3').id,'abcdefghijk');assert.equal(parseSongLink('https://music.apple.com/au/album/song/123?i=456').id,'456');
 for(const url of ['https://open.spotify.com/playlist/123','https://music.apple.com/au/album/123','https://evil.example/x','https://name:secret@youtube.com/watch?v=abcdefghijk'])assert.throws(()=>parseSongLink(url));
});
test('practice counts playback intervals, not paused time, and checkpoints do not double count',()=>{let time=0,total=0;const t=new PracticeTimer(n=>total+=n,()=>time);t.setPlaying(true);time=1000;t.checkpoint();time=3000;t.setPlaying(false);time=8000;t.setPlaying(true);time=9000;t.setPlaying(false);assert.equal(total,4);});
test('v1.6 PostgreSQL: free cloud, five slots, upgrades in place, storage retention, independent grants and RLS',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key,email text);insert into auth.users values('${a}','owner@example.test'),('${b}','student@example.test');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const file of ['202610140001_services.sql','202610170001_free_cloud.sql','202610170002_service_budgets.sql','202610170003_checkout.sql'])await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 const rpc=async(name,args)=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',args)).rows[0].result;
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);set role authenticated;`);assert.equal(await rpc('cloud_has_access',[]),true);await assert.rejects(rpc('reserve_entries',[b,[]]),/permission denied/);await db.exec('reset role');
 await rpc('reserve_entries',[b,Array.from({length:5},(_,i)=>({id:'song'+i,kind:i===0?'pending':'score'}))]);await assert.rejects(rpc('reserve_entries',[b,[{id:'six',kind:'score'}]]),/Song limit/);
 await rpc('reserve_entries',[b,[{id:'song0',kind:'score'}]]);assert.equal((await db.query('select count(*) as n from public.library_entries where user_id=$1',[b])).rows[0].n,5);
 for(let i=0;i<5;i++)await rpc('cloud_reserve_file',[b,'source','song'+i,'a'.repeat(64),30*1024**2]);
 await assert.rejects(rpc('cloud_reserve_file',[b,'asset','over','b'.repeat(64),1]),/storage limit/);
 await assert.rejects(rpc('owner_change',[b,b,'grant',{kind:'premium'}]),/Owner access/);
 await db.query('insert into public.owner_roles values($1)',[a]);await rpc('owner_change',[a,b,'grant',{kind:'premium'}]);assert.equal((await rpc('account_limits',[b])).songs,null);
 await rpc('reserve_entries',[b,[{id:'six',kind:'score'}]]);await rpc('cloud_reserve_file',[b,'source','six','b'.repeat(64),10]);
 const gift=(await db.query('select id from public.owner_grants where user_id=$1',[b])).rows[0].id;await rpc('owner_change',[a,b,'revoke',{id:gift}]);assert.equal((await rpc('account_limits',[b])).songs,5);
 await rpc('cloud_reserve_file',[b,'source','six','b'.repeat(64),10]);await assert.rejects(rpc('cloud_reserve_file',[b,'asset','new','c'.repeat(64),1]),/storage limit/);
 await assert.rejects(rpc('set_active_entries',[b,['song0','song1','song2','song3','song4','six']]),/allowance/);await rpc('set_active_entries',[b,['song0','song1','song2','song3','song4']]);
 await assert.rejects(rpc('cloud_commit',[b,'song/six',0,{entity:'song',entityId:'six',operation:'upsert'}]),/active songs/);
 await rpc('owner_change',[a,b,'grant',{kind:'limits',extraSongs:2}]);assert.equal((await rpc('account_limits',[b])).songs,7);
 await rpc('apply_billing_grant',[b,'stripe','subscription','event',100,'2099-01-01',true]);await rpc('owner_change',[a,b,'grant',{kind:'premium'}]);const gifts=(await db.query("select id from public.owner_grants where user_id=$1 and kind='premium' and revoked_at is null",[b])).rows;await rpc('owner_change',[a,b,'revoke',{id:gifts[0].id}]);assert.equal((await rpc('account_limits',[b])).paid,true);
 await rpc('reserve_entries',[a,Array.from({length:4},(_,i)=>({id:'parallel'+i,kind:'score'}))]);const raced=await Promise.allSettled([rpc('reserve_entries',[a,[{id:'device-one',kind:'score'}]]),rpc('reserve_entries',[a,[{id:'device-two',kind:'score'}]])]);assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal((await db.query('select count(*) as n from public.library_entries where user_id=$1',[a])).rows[0].n,5);
 const checkout=await rpc('checkout_claim',[a,'monthly','monthly-price']);assert.equal((await rpc('checkout_claim',[a,'monthly','monthly-price'])).id,checkout.id);await assert.rejects(rpc('checkout_claim',[a,'yearly','yearly-price']),/Existing checkout/);
 const batch='00000000-0000-4000-8000-000000000003';await assert.rejects(rpc('record_usage',[b,batch,{score_open:1}]),/consent/);await db.query('insert into public.usage_consent values($1,true)',[b]);await rpc('record_usage',[b,batch,{score_open:1}]);await rpc('record_usage',[b,batch,{score_open:1}]);assert.equal((await db.query('select count from public.usage_daily')).rows[0].count,1);await assert.rejects(rpc('record_usage',[b,crypto.randomUUID(),{song_title:1}]),/Invalid usage/);
 await rpc('owner_change',[a,b,'status',{suspended:true}]);await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);set role authenticated;`);assert.equal(await rpc('cloud_has_access',[]),false);await db.exec('reset role');
 assert((await db.query('select count(*) as n from public.owner_audit')).rows[0].n>=5);
 }finally{await db.close();}
});
test('owner endpoints reject valid authenticated sessions without MFA',async()=>{
 const token='x.'+Buffer.from(JSON.stringify({aal:'aal1'})).toString('base64url')+'.x';
 const handler=createHandler({env:n=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server'})[n],fetcher:async url=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:a});if(url.endsWith('/rpc/account_enabled'))return Response.json(true);if(url.endsWith('/rpc/service_budget'))return Response.json(null);throw Error('Unexpected '+url);}});
 const r=await handler(new Request('https://example.supabase.co/functions/v1/guitario?route=owner-accounts',{method:'POST',headers:{Authorization:'Bearer '+token},body:'{}'}));assert.equal(r.status,400);assert.match((await r.json()).error,/MFA/);
});
