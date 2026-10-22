import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';import feed from '../electron/update-feed.cjs';import {createHandler} from '../supabase/functions/guitario/service.ts';
import fs from 'node:fs/promises';import path from 'node:path';import updater from '../electron/update-service.cjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519'),config={provider:'https',manifestUrl:'https://example.supabase.co/functions/v1/guitario?route=updates',publicKey:publicKey.export({type:'spki',format:'pem'}),allowedDownloadOrigins:['https://example.supabase.co']};
const payload=()=>({schema:1,version:'1.5.2',issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),assets:['Windows-x64','macOS-arm64'].map(suffix=>({name:`Guitar-io-1.5.2-${suffix}.zip`,size:100,digest:'sha256:'+'a'.repeat(64),downloadUrl:`https://example.supabase.co/1.5.2/Guitar-io-1.5.2-${suffix}.zip?token=test-only`}))});
const envelope=data=>{const bytes=Buffer.from(JSON.stringify(data));return {payload:bytes.toString('base64url'),signature:sign(null,bytes,privateKey).toString('base64url')};};
test('signed manifests select verified Windows/Mac downloads and reject tampering, expiry and other hosts',()=>{
 for(const [platform,arch] of [['win32','x64'],['darwin','arm64']])assert.equal(feed.signedReleaseInfo(envelope(payload()),'1.5.1',platform,arch,config).status,'available');
 const tampered=envelope(payload());tampered.payload=Buffer.from(JSON.stringify({...payload(),version:'9.9.9'})).toString('base64url');assert.throws(()=>feed.signedReleaseInfo(tampered,'1.5.1','win32','x64',config),/signature/);
 assert.throws(()=>feed.signedReleaseInfo(envelope({...payload(),expiresAt:'2000-01-01'}),'1.5.1','win32','x64',config),/expired/);
 const other=payload();other.assets[0].downloadUrl='https://attacker.example/'+other.assets[0].name;assert.throws(()=>feed.signedReleaseInfo(envelope(other),'1.5.1','win32','x64',config),/download/);
 assert.equal(feed.signedReleaseInfo(envelope(payload()),'1.5.2','win32','x64',config).status,'current');
});
test('managed update endpoint generates manifests usable by the desktop verifier; does not require paid login',async()=>{
 const descriptor={version:'1.5.2',assets:payload().assets.map(a=>({...a,path:'1.5.2/'+a.name}))},env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',UPDATE_DESCRIPTOR:JSON.stringify(descriptor),UPDATE_SIGNING_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'der'}).toString('base64')};
 const handler=createHandler({env:name=>env[name],fetcher:async(url,options)=>{assert(url.includes('/object/sign/app-updates/1.5.2/'));assert.equal(JSON.parse(options.body).expiresIn,900);return Response.json({signedURL:'/object/sign/app-updates/1.5.2/'+url.split('/').at(-1)+'?token=fixture'});}});
 const response=await handler(new Request(config.manifestUrl));assert.equal(response.status,200);assert.equal(feed.signedReleaseInfo(await response.json(),'1.5.1','win32','x64',config).status,'available');
});
test('update service coalesces signed-feed checks and ignores a previous GitHub cache after migration',async()=>{
 const root=path.resolve('test-results');await fs.mkdir(root,{recursive:true});const directory=await fs.mkdtemp(path.join(root,'signed-feed-'));let calls=0;
 try{await fs.writeFile(path.join(directory,'updates.json'),JSON.stringify({autoUpdate:false,cache:{repository:'thelonewolfk32/guitar.io',data:{tag_name:'v9.9.9',assets:[{digest:'sha256:'+'a'.repeat(64)}]}}}));
  const service=new updater.UpdateService({directory,currentVersion:'1.5.1',platform:'win32',arch:'x64',feedConfig:config,fetcher:async url=>{assert.equal(url,config.manifestUrl);calls++;return Response.json(envelope(payload()));}});await service.load();assert.equal(service.status().status,'unchecked');await Promise.all([service.check(),service.check()]);assert.equal(calls,1);assert.equal(service.status().status,'available');assert.equal(service.status().autoUpdate,false);
  service.fetcher=async()=>Response.json({...envelope(payload()),signature:'a'.repeat(86)});await service.check();assert.equal(service.status().status,'error');assert.match(service.status().message,/signature/);
 }finally{assert(directory.startsWith(root+path.sep));await fs.rm(directory,{recursive:true,force:true});}
});
