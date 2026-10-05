// Exercise bundled Electron/ASAR staging and the detached installer, not just
// a source script. Interactive Gatekeeper/relaunch still needs a user session.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import service from '../electron/update-service.cjs';
const run=promisify(execFile),version=JSON.parse(await fs.readFile('package.json','utf8')).version;
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
const archive=path.resolve(process.argv[2]),root=await fs.mkdtemp(path.join(os.tmpdir(),'guitario-mac-update-'));
try{
 const profile=path.join(root,'profile'),stage=path.join(profile,'app-updates','download-native'),extracted=path.join(stage,'extracted'),target=path.join(root,'Guitar.io.app'),token=randomUUID();
 await fs.mkdir(extracted,{recursive:true});await run('/usr/bin/ditto',['-x','-k',archive,extracted]);
 const packageFolder=path.join(extracted,`Guitar-io-${version}-macOS-arm64`),incoming=path.join(packageFolder,'Guitar.io.app');
 // Record whether the old compact XML reproduces the reported failure on this
 // macOS version. General plist validity alone does not establish AMFI validity.
 const legacy=path.join(root,'legacy.plist');await fs.writeFile(legacy,'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n  <key>com.apple.security.cs.allow-jit</key><true/>\n  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>\n</dict></plist>\n');
 try{await run('/usr/bin/codesign',['--force','--deep','--sign','-','--entitlements',legacy,incoming]);console.log('Legacy compact entitlement signing passed on this runner; the reported MacBook failure was not reproduced by source XML alone.');}catch(error){console.log('Legacy signing failure reproduced:',error.stderr);}
 await run('/bin/bash',[path.join(packageFolder,'Prepare and open Guitar.io.command')],{env:{...process.env,GUITARIO_PREPARE_NO_OPEN:'1'},timeout:180000});
 await run('/usr/bin/ditto',[incoming,target]);await fs.writeFile(path.join(profile,'library-marker'),'Keep library');
 // Distinguish the old app from the replacement without changing its identity.
 const oldMarker='Contents/Resources/old-only-marker';await fs.writeFile(path.join(target,oldMarker),'old');
 const canonical=path.join(root,'canonical.plist');await run('/usr/bin/plutil',['-convert','xml1','-o',canonical,path.join(packageFolder,'local-signing-entitlements.plist')]);
 await run('/usr/bin/codesign',['--force','--deep','--sign','-','--generate-entitlement-der','--entitlements',canonical,target]);
 const driver=path.join(root,'drive-update.cjs'),execPath=path.join(target,'Contents/MacOS/Guitar.io');
 await fs.writeFile(driver,`const fs=require('node:fs/promises'),path=require('node:path');(async()=>{const p=JSON.parse(process.argv[2]),{UpdateInstaller}=require(path.join(p.target,'Contents/Resources/app.asar/electron/update-installer.cjs'));const i=new UpdateInstaller({directory:p.profile,platform:'darwin',execPath:process.execPath,packaged:true,beforeInstall:async()=>fs.writeFile(path.join(p.profile,'flushed'),'yes'),quit:()=>process.exit(0)});i.ready={stage:p.stage,source:p.source,files:[],version:p.version};await i.install(false);throw Error('Installer did not request exit');})().catch(e=>{console.error(e);process.exitCode=1;});`);
 await run(execPath,[driver,JSON.stringify({target,profile,stage,source:packageFolder,version})],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},timeout:180000});
 let outcome;for(let n=0;n<200;n++){outcome=await fs.readFile(path.join(profile,'update-result.json'),'utf8').then(JSON.parse).catch(()=>undefined);if(outcome)break;await new Promise(r=>setTimeout(r,100));}
 if(outcome?.status!=='installed')console.log(await fs.readFile(path.join(profile,'update-install.log'),'utf8').catch(()=>''));
 assert.equal(outcome?.status,'installed');assert.equal(await fs.readFile(path.join(profile,'flushed'),'utf8'),'yes');
 await run('/usr/bin/codesign',['--verify','--deep','--strict',target]);
 assert.equal(await fs.readFile(path.join(profile,'library-marker'),'utf8'),'Keep library');assert.equal(await fs.access(path.join(target,oldMarker)).then(()=>true).catch(()=>false),false);
 const backup=path.join(root,`.Guitar.io-rollback-${outcome.rollbackToken}.app`);assert.equal(await fs.readFile(path.join(backup,oldMarker),'utf8'),'old');
 for(let n=0;n<100&&await fs.access(stage).then(()=>true).catch(()=>false);n++)await new Promise(r=>setTimeout(r,100));
 assert.equal(await fs.access(stage).then(()=>true).catch(()=>false),false,'Staging folder was not removed');
 // Execute the signed replacement under AMFI, including its bundled JS.
 const executed=await run(execPath,['-e',"console.log(require(process.argv[1]).version)",path.join(target,'Contents/Resources/app.asar/package.json')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});assert.equal(executed.stdout.trim(),version);
 const updates=new service.UpdateService({directory:profile,currentVersion:version,platform:'darwin',arch:'arm64',installerOptions:{execPath:path.join(target,'Contents/MacOS/Guitar.io'),packaged:true}});await updates.load();
 assert.equal(JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8')).activated,true);assert.equal(await fs.access(backup).then(()=>true).catch(()=>false),false);
 // An unreadable permission file must fail before readiness/exit/replacement.
 const failedStage=path.join(profile,'app-updates','download-bad'),badApp=path.join(failedStage,'extracted/Guitar.io.app');await fs.mkdir(path.dirname(badApp),{recursive:true});await run('/usr/bin/ditto',[target,badApp]);
 const quote=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
 await fs.writeFile(path.join(failedStage,'plan.sh'),Object.entries({TARGET:target,NEW_APP:badApp,STAGE:failedStage,PARENT_PID:process.pid,VERSION:version,PROFILE:profile,RESTART:'0',TOKEN:token}).map(([k,v])=>`${k}=${quote(v)}`).join('\n')+'\n');
 const unchanged=await fs.readFile(path.join(target,'Contents/Resources/app.asar'));
 await fs.writeFile(path.join(failedStage,'entitlements.plist'),'not an XML property list');await fs.copyFile('electron/update-mac.command',path.join(failedStage,'Install Guitar.io.command'));
 await assert.rejects(run('/bin/bash',[path.join(failedStage,'Install Guitar.io.command')],{timeout:180000}));
 const failed=JSON.parse(await fs.readFile(path.join(failedStage,'handshake.json'),'utf8'));assert.equal(failed.status,'failed');assert.equal(failed.step,'entitlements');assert.match(failed.message,/signing permissions/);assert.deepEqual(await fs.readFile(path.join(target,'Contents/Resources/app.asar')),unchanged);process.kill(process.pid,0);
 await run('/usr/bin/codesign',['--verify','--deep','--strict',target]);
 assert.equal(await fs.access(path.join(root,`.Guitar.io-update-${token}.app`)).then(()=>true).catch(()=>false),false);
 console.log('PASS native Apple Silicon updater: standalone preparation, actual packaged Electron/ASAR staging, detached signing/verification and replacement, executable AMFI acceptance, preserved profile, rollback/cleanup, and corrupt entitlement rejection before replacement. Interactive restart/Gatekeeper UI requires MacBook testing.');
}finally{assert(root.startsWith(path.join(os.tmpdir(),'guitario-mac-update-')));await fs.rm(root,{recursive:true,force:true});}
