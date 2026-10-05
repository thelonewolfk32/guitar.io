import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('Mac installer waits for verified readiness and keeps the app open on a signing failure',async()=>{
 for(const failure of [true,false]){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'guitario-mac-controller-'));
  try{
   const profile=path.join(root,'profile'),target=path.join(root,'Guitar.io.app'),stage=path.join(profile,'app-updates','download-test'),source=path.join(stage,'extracted');
   await fs.mkdir(path.join(target,'Contents/MacOS'),{recursive:true});await fs.mkdir(source,{recursive:true});await fs.writeFile(path.join(target,'keep'),'old app');
   const module={exports:{}},order=[];let launch;
   const child=new EventEmitter();child.unref=()=>{};
   const spawn=(exe,args,options)=>{
    launch={exe,args,options};order.push('launch');
    void fs.readFile(path.join(stage,'install.json'),'utf8').then(async text=>{
     const plan=JSON.parse(text);await fs.writeFile(path.join(stage,'handshake.json'),JSON.stringify({token:plan.token,status:failure?'failed':'ready',message:failure?'macOS could not sign the update. See update-install.log for details.':''}));
     if(failure)child.emit('exit',1);
    });return child;
   };
   vm.runInNewContext(await fs.readFile('electron/update-installer.cjs','utf8'),{require:name=>name==='node:child_process'?{...require(name),spawn}:require(name),module,__dirname:path.resolve('electron'),process,setTimeout,Buffer,fetch,AbortSignal});
   const updater=new module.exports.UpdateInstaller({directory:profile,platform:'darwin',execPath:path.join(target,'Contents/MacOS/Guitar.io'),packaged:true,beforeInstall:async()=>order.push('flush'),quit:()=>order.push('quit')});
   updater.ready={stage,source,files:[],version:'1.4.42'};
   if(failure)await assert.rejects(updater.install(false),/macOS could not sign/);else await updater.install(false);
   assert.deepEqual(order,failure?['flush','launch']:['flush','launch','quit']);
   assert.equal(launch.exe,'/bin/bash');assert.equal(launch.options.detached,true);assert.equal(launch.options.stdio[0],'ignore');assert.equal(launch.args[0],path.join(stage,'Install Guitar.io.command'));
   assert.equal(await fs.readFile(path.join(target,'keep'),'utf8'),'old app');
   assert.deepEqual(await fs.readFile(path.join(stage,'entitlements.plist')),await fs.readFile('scripts/mac-entitlements.plist'));
   assert.equal((await fs.stat(path.join(profile,'update-install.log'))).isFile(),true);
   if(failure)assert.equal(updater.installing,false);
  }finally{assert(root.startsWith(path.join(os.tmpdir(),'guitario-mac-controller-')));await fs.rm(root,{recursive:true,force:true});}
 }
});
