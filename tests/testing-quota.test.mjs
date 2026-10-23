import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {featureRoutes} from '../supabase/functions/guitario/features.ts';
test('account entries are available without file reads and paginate beyond one thousand retained rows',async()=>{
 const id='00000000-0000-4000-8000-000000000041',all=Array.from({length:1002},(_,i)=>({id:'entry-'+i,kind:'score',active:i<1000,deleted:i>=1000})),calls=[];
 const features=featureRoutes({env:()=>undefined,fetcher:()=>{throw Error('No file fetch is allowed');},rest:async route=>{calls.push(route);assert(route.startsWith('library_entries?user_id=eq.'+id));const offset=Number(new URL('https://fixture/'+route).searchParams.get('offset'));return all.slice(offset,offset+1000);}});
 const result=await features.handle('account-entries',id,'',{});assert.equal(result.entries.length,1002);assert.equal(calls.length,2);assert.equal(result.entries[1001].deleted,true);
});
test('backend testing migration reactivates 50 entries, enforces 1000 atomically and retains byte quotas and RLS',async()=>{
 const db=new PGlite(),id='00000000-0000-4000-8000-000000000041';try{
  await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key,email text);insert into auth.users values('${id}','tester@example.test');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  const migrations=(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();for(const file of migrations.filter(f=>f!=='202610230001_testing_song_limit.sql'))await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
  await db.query("insert into public.library_entries(user_id,id,kind,active) select $1,'legacy-'||g,'score',g<5 from generate_series(0,49) g",[id]);
  await db.exec(await fs.readFile('supabase/migrations/202610230001_testing_song_limit.sql','utf8'));
  const rpc=async(name,args=[])=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
  const limits=await rpc('account_limits',[id]);assert.equal(limits.songs,1000);assert.equal(limits.bytes,150*1024**2);assert.equal(limits.fileBytes,30*1024**2);assert.equal((await db.query('select count(*) n from public.library_entries where active')).rows[0].n,50);
  await rpc('reserve_import',[id,Array.from({length:949},(_,i)=>({id:'new-'+i,kind:'score'}))]);
  const race=await Promise.allSettled([rpc('reserve_entries',[id,[{id:'last-a',kind:'score'}]]),rpc('reserve_entries',[id,[{id:'last-b',kind:'score'}]])]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await db.query('select count(*) n from public.library_entries')).rows[0].n,1000);
  await rpc('reserve_entries',[id,[{id:'new-0',kind:'score'}]]);assert.equal((await db.query('select count(*) n from public.library_entries')).rows[0].n,1000);
  await db.exec(`select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);await assert.rejects(rpc('reserve_entries',[id,[]]),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
