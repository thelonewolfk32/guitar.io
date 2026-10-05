import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import updater from '../electron/update-service.cjs';
const repo='thelonewolfk32/guitar.io';
const release=(version='1.5.0')=>({tag_name:'v'+version,draft:false,prerelease:false,assets:['Windows-x64','macOS-arm64'].map(platform=>({name:`Guitar-io-${version}-${platform}.zip`,browser_download_url:`https://github.com/${repo}/releases/download/v${version}/Guitar-io-${version}-${platform}.zip`}))});
test('release checks compare stable numeric versions and choose the exact desktop build',()=>{
 assert(updater.newer('1.4.42','1.4.41'));assert(updater.newer('1.4.42','1.4.4'));assert(!updater.newer('1.4.5','1.4.41'));assert(updater.newer('1.4.41','1.4.4'));assert(updater.newer('v1.10.0','1.9.0'));assert(!updater.newer('1.4.3','1.4.3'));assert(!updater.newer('1.4.4-beta.1','1.4.3'));
 assert.equal(updater.releaseInfo(release(),'1.4.3','darwin','arm64',repo).assetName,'Guitar-io-1.5.0-macOS-arm64.zip');
 assert.equal(updater.releaseInfo(release(),'1.4.3','win32','x64',repo).status,'available');
 assert.equal(updater.releaseInfo(release(),'1.4.3','darwin','x64',repo).status,'missing-build');
 for(const url of ['http://github.com/user/repo','https://github.com.evil.test/user/repo','https://user@github.com/user/repo','https://github.com/user/repo?token=bad'])assert.throws(()=>updater.repositorySlug(url));
 const bad=release();bad.assets[0].browser_download_url='https://example.com/app.zip';assert.throws(()=>updater.releaseInfo(bad,'1.4.3','win32','x64',repo));
 assert.equal(updater.repositorySlug('https://github.com/'+repo+'.git'),repo);
});
test('launch checks coalesce, reuse ETags, stay usable offline, and never open downloads automatically',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'guitario-updates-'));let calls=0,opened=[];
 const service=new updater.UpdateService({directory:dir,currentVersion:'1.4.3',platform:'win32',arch:'x64',openExternal:url=>opened.push(url),fetcher:async(url,options)=>{assert.equal(url,`https://api.github.com/repos/${repo}/releases/latest`);calls++;if(calls===2){assert.equal(options.headers['If-None-Match'],'test-etag');return new Response(null,{status:304});}return new Response(JSON.stringify(release()),{headers:{etag:'test-etag'}});}});
 try{await service.load();await Promise.all([service.check(),service.check()]);assert.equal(calls,1);assert.equal(service.status().status,'available');assert.equal(opened.length,0);await service.check();assert.equal(calls,2);await service.open('download');assert(opened[0].endsWith('Windows-x64.zip'));const saved=JSON.parse(await fs.readFile(path.join(dir,'updates.json'),'utf8'));assert(!('token' in saved));service.fetcher=async()=>{throw Error('Offline');};await service.check();assert.equal(service.status().status,'error');await service.settings({repository:repo,checkOnLaunch:false});assert.equal(service.status().checkOnLaunch,false);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('a repository without public releases is reported without blocking the app',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'guitario-no-release-'));
 try{const service=new updater.UpdateService({directory:dir,currentVersion:'1.4.3',fetcher:async()=>new Response(null,{status:404})});assert.equal((await service.check()).status,'no-release');}finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('replacement is acknowledged only after the renderer loads, for the installed version',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'guitario-activation-')),file=path.join(dir,'update-result.json');
 try{
  await fs.writeFile(file,JSON.stringify({status:'installed',version:'1.5.0',token:'test',activated:false}));
  const old=new updater.UpdateService({directory:dir,currentVersion:'1.4.4'});await old.load();await old.activate();assert.equal(JSON.parse(await fs.readFile(file)).activated,false);
  const next=new updater.UpdateService({directory:dir,currentVersion:'1.5.0'});await next.load();assert.equal(JSON.parse(await fs.readFile(file)).activated,false,'metadata load alone is not a healthy startup');
  await next.activate();const result=JSON.parse(await fs.readFile(file));assert.equal(result.activated,true);assert.equal(result.pid,process.pid);assert.equal(result.token,'test');
  await fs.writeFile(file,JSON.stringify({status:'failed',version:'1.5.0',message:'Startup failed'}));await old.load();assert.equal(old.status().autoInstallPaused,true,'rollback must not automatically loop the failed update');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
