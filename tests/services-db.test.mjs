import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',hash='a'.repeat(64);
test('cloud SQL: paid enforcement, account isolation, CAS cursors, billing replay and quota',async()=>{
 const db=new PGlite();try{
  await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(await fs.readFile('supabase/migrations/202610140001_services.sql','utf8'));
  const grant=(user,provider,event,active,until='2099-01-01T00:00:00Z',at=100)=>db.query('select public.apply_billing_grant($1,$2,$3,$4,$5,$6,$7) as accepted',[user,provider,provider+'-sub',event,at,until,active]);
  assert.equal((await grant(a,'stripe','buy',true)).rows[0].accepted,true);assert.equal((await grant(a,'stripe','buy',false)).rows[0].accepted,false);
  await assert.rejects(db.query('select public.cloud_commit($1,$2,$3,$4)',[b,'song/one',0,{}]),/Paid cloud subscription/);
  assert.equal((await db.query('select public.cloud_commit($1,$2,$3,$4) as ok',[a,'song/one',0,{key:'song/one'}])).rows[0].ok,true);
  assert.equal((await db.query('select public.cloud_commit($1,$2,$3,$4) as ok',[a,'song/one',0,{key:'song/stale'}])).rows[0].ok,false);
  assert.equal((await db.query('select revision from public.cloud_heads where user_id=$1',[a])).rows[0].revision,1);
  await db.query('select public.cloud_reserve_file($1,$2,$3,$4,$5)',[a,'source','one',hash,10]);await db.exec(`update public.cloud_files set ready=true;insert into storage.objects values('library','${a}/blobs/${hash}');`);
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);set role authenticated;`);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await assert.rejects(db.query('select * from public.billing_grants'),/permission denied/);
  await assert.rejects(db.query('select public.cloud_commit($1,$2,$3,$4)',[a,'song/fake',0,{}]),/permission denied/);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${b}',false);set role authenticated;`);assert.equal((await db.query('select * from storage.objects')).rows.length,0);await assert.rejects(db.exec(`insert into storage.objects values('library','${a}/blobs/${hash}')`),/row-level security/);await db.exec('reset role');
  await grant(a,'revenuecat','apple',true);await grant(a,'stripe','cancel',false,'2099-01-01',200);await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);set role authenticated;`);assert.equal((await db.query('select public.cloud_has_access() as paid')).rows[0].paid,true);await db.exec('reset role');
  await grant(a,'revenuecat','expire',false,'2020-01-01',200);await grant(a,'stripe','late-renew',true,'2099-01-01',150);await db.exec(`set role authenticated;`);assert.equal((await db.query('select public.cloud_has_access() as paid')).rows[0].paid,false);assert.equal((await db.query('select * from storage.objects')).rows.length,0);await db.exec('reset role');
  await grant(a,'stripe','renew',true,'2099-01-01',300);await db.exec('delete from public.cloud_files');for(let i=0;i<34;i++)await db.query('select public.cloud_reserve_file($1,$2,$3,$4,$5)',[a,'asset','quota-'+i,hash,30*1024*1024]);await assert.rejects(db.query('select public.cloud_reserve_file($1,$2,$3,$4,$5)',[a,'asset','too-much',hash,30*1024*1024]),/storage limit/);
 }finally{await db.close();}
});
