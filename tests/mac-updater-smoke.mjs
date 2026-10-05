// Native ARM64 CI check of the same unsigned bundle/signing path used by users.
// Restart is deliberately disabled; MacBook UI/Gatekeeper approval still needs
// a real user-session check. All paths stay inside one disposable test root.
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
 const incoming=path.join(extracted,`Guitar-io-${version}-macOS-arm64/Guitar.io.app`);
 await run('/usr/bin/ditto',[incoming,target]);await fs.writeFile(path.join(profile,'library-marker'),'Keep library');
 // Distinguish the old app from the replacement without changing its identity.
 await fs.writeFile(path.join(target,'old-only-marker'),'old');
 const quote=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
 await fs.writeFile(path.join(stage,'plan.sh'),Object.entries({TARGET:target,NEW_APP:incoming,STAGE:stage,PARENT_PID:2147483647,VERSION:version,PROFILE:profile,RESTART:'0',TOKEN:token}).map(([k,v])=>`${k}=${quote(v)}`).join('\n')+'\n');
 await fs.copyFile('scripts/mac-entitlements.plist',path.join(stage,'entitlements.plist'));await fs.copyFile('electron/update-mac.command',path.join(stage,'Install Guitar.io.command'));
 await run('/bin/bash',[path.join(stage,'Install Guitar.io.command')],{timeout:180000});
 const outcome=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));assert.equal(outcome.status,'installed');
 await run('/usr/bin/codesign',['--verify','--deep','--strict',target]);
 assert.equal(await fs.readFile(path.join(profile,'library-marker'),'utf8'),'Keep library');assert.equal(await fs.access(path.join(target,'old-only-marker')).then(()=>true).catch(()=>false),false);
 const backup=path.join(root,`.Guitar.io-rollback-${token}.app`);assert.equal(await fs.readFile(path.join(backup,'old-only-marker'),'utf8'),'old');assert.equal(await fs.access(stage).then(()=>true).catch(()=>false),false);
 const updates=new service.UpdateService({directory:profile,currentVersion:version,platform:'darwin',arch:'arm64',installerOptions:{execPath:path.join(target,'Contents/MacOS/Guitar.io'),packaged:true}});await updates.load();
 assert.equal(JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8')).activated,true);assert.equal(await fs.access(backup).then(()=>true).catch(()=>false),false);
 console.log('PASS native Apple Silicon updater: unsigned release extracts, locally signs/verifies, replaces the bundle, retains profile, preserves rollback until activation, and clears staging/old bundle. Restart/Gatekeeper UI requires MacBook testing.');
}finally{assert(root.startsWith(path.join(os.tmpdir(),'guitario-mac-update-')));await fs.rm(root,{recursive:true,force:true});}
