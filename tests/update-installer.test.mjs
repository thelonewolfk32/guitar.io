import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import installer from '../electron/update-installer.cjs';
import {zip,asar} from './update-fixtures.mjs';
const run=promisify(execFile),folder='Guitar-io-1.4.5-Windows-x64',entries=[{name:folder+'/Guitar.io.exe',data:'runtime'},{name:folder+'/resources/app.asar',data:asar('1.4.5')}];
async function temp(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'guitario-update-test-'));try{await fn(root);}finally{assert(root.startsWith(path.join(os.tmpdir(),'guitario-update-test-')));await fs.rm(root,{recursive:true,force:true});}}
test('update archives reject traversal, duplicate paths, Windows links and missing runtime files',async()=>temp(async root=>{
 const file=path.join(root,'release.zip');await fs.writeFile(file,zip(entries));assert.deepEqual(await installer.validateArchive(file,folder,'win32'),['Guitar.io.exe','resources/app.asar']);
 for(const extras of [[{name:folder+'/../outside',data:'bad'}],[{name:folder+'/GUITAR.IO.EXE',data:'bad'}],[{name:folder+'/link',data:'../outside',mode:0o120777}]]){await fs.writeFile(file,zip([...entries,...extras]));await assert.rejects(installer.validateArchive(file,folder,'win32'));}
 await fs.writeFile(file,zip(entries.slice(1)));await assert.rejects(installer.validateArchive(file,folder,'win32'));
 const mf='Guitar-io-1.4.5-macOS-arm64';await fs.writeFile(file,zip([{name:mf+'/Guitar.io.app/Contents/MacOS/Guitar.io',data:'runtime'},{name:mf+'/Guitar.io.app/Contents/Resources/app.asar',data:'app'},{name:mf+'/Guitar.io.app/Contents/link',data:'../../../../../outside',mode:0o120777}]));await assert.rejects(installer.validateArchive(file,mf,'darwin'));
}));
test('failed update verification leaves the installed app untouched and removes the partial download',async()=>temp(async root=>{
 const bytes=zip(entries),events=[],target=path.join(root,'installed');await fs.mkdir(target);await fs.writeFile(path.join(target,'Guitar.io.exe'),'old');
 const i=new installer.UpdateInstaller({directory:root,platform:'win32',execPath:path.join(target,'Guitar.io.exe'),packaged:true,fetcher:async()=>new Response(bytes),notify:s=>events.push(s)});
 await assert.rejects(i.prepare({latestVersion:'1.4.5',assetName:folder+'.zip',downloadUrl:'https://github.com/example',size:bytes.length,digest:'sha256:'+'0'.repeat(64)}),/verification/);
 assert.equal(await fs.readFile(path.join(target,'Guitar.io.exe'),'utf8'),'old');assert.deepEqual(await fs.readdir(path.join(root,'app-updates')),[]);assert(events.some(s=>s.status==='downloading'));
}));
test('verified Windows download extracts once, checks app identity/version and stages without replacing files',{skip:process.platform!=='win32'},async()=>temp(async root=>{
 const bytes=zip(entries),release={latestVersion:'1.4.5',assetName:folder+'.zip',downloadUrl:'https://github.com/example',size:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex')};let calls=0;
 const i=new installer.UpdateInstaller({directory:root,platform:'win32',packaged:true,fetcher:async()=>{calls++;return new Response(bytes);}});const ready=await i.prepare(release);assert.equal(await installer.asarVersion(path.join(ready.source,'resources/app.asar')),'1.4.5');await i.prepare(release);assert.equal(calls,1);assert(i.ready);
 const wrong=new installer.UpdateInstaller({directory:root,platform:'win32',packaged:true,fetcher:async()=>new Response(bytes)});await assert.rejects(wrong.prepare({...release,latestVersion:'1.4.6'}),/version/);
}));
test('Windows install replaces packaged files, preserves unrelated data, and rolls back a partial failure',{skip:process.platform!=='win32'},async()=>{
 for(const failure of [false,true])await temp(async root=>{
  const profile=path.join(root,'profile'),stage=path.join(profile,'app-updates','download-test'),source=path.join(stage,'extracted',folder),target=path.join(root,'installed');await fs.mkdir(source,{recursive:true});await fs.mkdir(target);await fs.writeFile(path.join(target,'Guitar.io.exe'),'old-exe');await fs.writeFile(path.join(target,'my-notes.txt'),'private-notes');await fs.writeFile(path.join(source,'Guitar.io.exe'),'new-exe');await fs.writeFile(path.join(source,'new-file.txt'),'new');
  const files=['Guitar.io.exe','new-file.txt'];if(failure){await fs.writeFile(path.join(target,'occupied'),'keep');await fs.mkdir(path.join(source,'occupied'));await fs.writeFile(path.join(source,'occupied','file.txt'),'fail');files.push('occupied/file.txt');}
  const plan=path.join(stage,'install.json');await fs.writeFile(plan,JSON.stringify({target,source,stage,profile,files,parentPid:2147483647,restart:false,version:'1.4.5',token:'test'}));await fs.mkdir(path.join(source,'resources'));await fs.writeFile(path.join(source,'resources/app.asar'),'app');
  const command=run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('electron/update-windows.ps1'),'-Plan',plan],{windowsHide:true,timeout:20000});if(failure)await assert.rejects(command);else await command;
  assert.equal(await fs.readFile(path.join(target,'my-notes.txt'),'utf8'),'private-notes');assert.equal(await fs.readFile(path.join(target,'Guitar.io.exe'),'utf8'),failure?'old-exe':'new-exe');
  const result=JSON.parse((await fs.readFile(path.join(profile,'update-result.json'),'utf8')).replace(/^\uFEFF/,''));assert.equal(result.status,failure?'failed':'installed');if(failure)assert.equal(await fs.access(path.join(target,'new-file.txt')).then(()=>true).catch(()=>false),false);
 });
});
