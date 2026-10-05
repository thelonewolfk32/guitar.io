import {launch} from './standalone-desktop.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {zip} from './update-fixtures.mjs';
import {fixtures,seed} from './library-harness.mjs';
import installer from '../electron/update-installer.cjs';
const run=promisify(execFile),require=createRequire(import.meta.url);let asar;
try{asar=require('@electron/asar');}catch{const p=path.resolve('node_modules/.pnpm'),name=(await fs.readdir(p)).find(n=>n.startsWith('@electron+asar@'));asar=require(path.join(p,name,'node_modules/@electron/asar/lib/asar.js'));}
const version=JSON.parse(await fs.readFile('package.json','utf8')).version,root=path.resolve('test-results');await fs.mkdir(root,{recursive:true});
const packagePath=path.resolve(process.env.GUITARIO_OUTPUT_DIR || 'release/artifacts',`Guitar-io-${version}-Windows-x64`);
const button=(p,name)=>p.getByRole('button',{name,exact:true}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function nativeProcesses(exe){const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${exe.replaceAll("'","''")}' -and $_.CommandLine -notmatch '--type=' } | ForEach-Object { $p=Get-Process -Id $_.ProcessId; [pscustomobject]@{pid=$p.Id;window=$p.MainWindowHandle.ToInt64()} } | ConvertTo-Json -Compress`],{windowsHide:true});const data=stdout.trim()?JSON.parse(stdout):[];return Array.isArray(data)?data:[data];}
for(const scenario of ['manual-and-force','skipped-versions','startup-rollback']){
 const work=await fs.mkdtemp(path.join(root,'v150-update-')),installed=path.join(work,'installed'),profile=path.join(work,'profile'),source=path.join(work,'app-source'),exe=path.join(installed,'Guitar.io.exe');let app;
 const readResult=()=>fs.readFile(path.join(profile,'update-result.json'),'utf8').then(s=>JSON.parse(s.replace(/^\uFEFF/,''))).catch(()=>undefined);
 try{
  await fs.cp(packagePath,installed,{recursive:true});await fs.mkdir(profile);await fs.writeFile(path.join(profile,'updates.json'),JSON.stringify({autoUpdate:false}));
  asar.extractAll(path.join(installed,'resources/app.asar'),source);
  const next=scenario==='skipped-versions'?version:'1.5.1';
  // A real old installer exercises a complete 1.4.4 -> 1.5.0 replacement,
  // including its hidden restart, rather than requiring intermediate releases.
  if(scenario==='skipped-versions'){
   const old=path.join(work,'old-source');await fs.cp(source,old,{recursive:true});
   const p=JSON.parse(await fs.readFile(path.join(old,'package.json'),'utf8'));p.version='1.4.4';await fs.writeFile(path.join(old,'package.json'),JSON.stringify(p));
   for(const name of ['main.cjs','preload.cjs','update-installer.cjs','update-service.cjs','update-windows.ps1','launch-update-windows.ps1']){const {stdout}=await run('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'show',`v1.4.4:electron/${name}`],{maxBuffer:2*1024*1024});await fs.writeFile(path.join(old,'electron',name),stdout);}
   await asar.createPackage(old,path.join(installed,'resources/app.asar'));
  }
  const pkg=JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'));pkg.version=next;await fs.writeFile(path.join(source,'package.json'),JSON.stringify(pkg));
  if(scenario==='startup-rollback')await fs.writeFile(path.join(source,'electron/main.cjs'),"const {app}=require('electron');app.setName('Guitar.io');if(process.env.GUITARIO_TEST_PROFILE)app.setPath('userData',process.env.GUITARIO_TEST_PROFILE);app.whenReady().then(()=>app.exit(1));\n");
  const newAsar=path.join(work,'new.asar');await asar.createPackage(source,newAsar);
  const name=`Guitar-io-${next}-Windows-x64`,bytes=zip([{name:name+'/Guitar.io.exe',data:await fs.readFile(exe)},{name:name+'/resources/app.asar',data:await fs.readFile(newAsar)}]),fixture=path.join(work,'update.zip');await fs.writeFile(fixture,bytes);await fs.writeFile(path.join(installed,'user-notes.txt'),'Keep my file');
  app=await launch(exe,profile);let p=await app.firstWindow();await button(p,'Help').waitFor();await seed(p,'guitario://app/',fixtures(3,8),true,true);await p.reload();await button(p,'Open Synthetic study 000').waitFor();
  // Finish the real launch request before replacing fetch with the fixture.
  // Otherwise a response already in flight can overwrite the controlled release.
  await p.evaluate(()=>window.guitarUpdates.check());
  await p.evaluate(()=>{window.__updateClicks=[];document.addEventListener('mousedown',e=>window.__updateClicks.push({target:e.target.closest('button')?.getAttribute('aria-label')||e.target.closest('button')?.textContent||e.target.className,dialog:document.querySelector('[role=dialog]')?.getAttribute('aria-label')}),true);});
  await app.evaluate(({net},params)=>{const fs=process.mainModule.require('node:fs'),original=net.fetch;net.fetch=async(url,options)=>{if(url.startsWith('https://api.github.com/repos/'))return new Response(JSON.stringify({tag_name:'v'+params.next,draft:false,prerelease:false,assets:[{name:params.name+'.zip',size:params.size,digest:'sha256:'+params.hash,browser_download_url:`https://github.com/thelonewolfk32/guitar.io/releases/download/v${params.next}/${params.name}.zip`}]}));if(url.endsWith(params.name+'.zip'))return new Response(fs.readFileSync(params.fixture));return original(url,options);};},{next,name,fixture,size:bytes.length,hash:createHash('sha256').update(bytes).digest('hex')});
  const previous=await installer.asarVersion(path.join(installed,'resources/app.asar'));
  await button(p,'Help').click();await button(p,'Version and updates').click();await button(p,'Check for updates').waitFor({state:'visible'});
  await button(p,'Check for updates').click();await button(p,'Install update').waitFor({timeout:120000});assert.equal(await installer.asarVersion(path.join(installed,'resources/app.asar')),previous,'download alone must not replace the app');
  await button(p,'Close dialog').click();assert.equal(await button(p,'Update ready').count(),1);assert.equal(await button(p,'Update ready').textContent(),'');
  if(scenario==='manual-and-force')await p.screenshot({path:path.join(root,'v150-download-icon.png')});
  if(scenario==='manual-and-force'){
   await button(p,'Open Synthetic study 000').click();await button(p,'Return to library').waitFor();await button(p,'Update ready').click();await button(p,'Install update').click();await p.getByText('Close the song player before installing.',{exact:true}).waitFor();await button(p,'Force install').click();await p.getByRole('dialog',{name:'Force install update?'}).waitFor();assert.match(await p.getByRole('dialog',{name:'Force install update?'}).textContent(),/Unsaved form changes/);await button(p,'Cancel').click();assert.equal(await installer.asarVersion(path.join(installed,'resources/app.asar')),previous);await button(p,'Force install').click();
   app.disconnectInspector();await p.getByRole('dialog',{name:'Force install update?'}).getByRole('button',{name:'Force install',exact:true}).click();
  }else{await button(p,'Update ready').click();app.disconnectInspector();await button(p,'Install update').click();}
  let outcome;for(let n=0;n<500;n++){outcome=await readResult();if(outcome?.activated||outcome?.status==='failed')break;await sleep(250);}
  assert(outcome,'installer must write a result');
  if(scenario==='startup-rollback'){assert.equal(outcome.status,'failed');assert.match(outcome.message,/exited|library window/);assert.equal(await installer.asarVersion(path.join(installed,'resources/app.asar')),previous);}
  else{assert.equal(outcome.status,'installed',outcome.message);assert.equal(outcome.activated,true);assert.equal(await installer.asarVersion(path.join(installed,'resources/app.asar')),next);}
  assert.equal(await fs.readFile(path.join(installed,'user-notes.txt'),'utf8'),'Keep my file');assert.equal(JSON.parse(await fs.readFile(path.join(profile,'updates.json'),'utf8')).autoUpdate,false);
  // Inspect native visibility; CDP alone also connects to an invisible window.
  let processes;for(let n=0;n<40;n++){processes=await nativeProcesses(exe);if(processes.some(p=>p.window!==0))break;await sleep(250);}assert(processes.some(p=>p.window!==0),'restart must show an OS window');
  for(const proc of processes)process.kill(proc.pid);await sleep(1500);await app.close().catch(()=>{});app=await launch(exe,profile);p=await app.firstWindow();await button(p,'Open Synthetic study 000').waitFor();assert.equal(await p.locator('.song-card').count(),3);await button(p,'Help').click();assert.match(await button(p,'Version and updates').textContent(),new RegExp((scenario==='startup-rollback'?previous:next).replaceAll('.','\\.')));
  console.log(`PASS ${scenario}: saved library and unrelated files retained; actual restart has a visible Windows window.`);
 }catch(error){if(app){const p=await app.firstWindow().catch(()=>undefined);console.log('Updater failure details:',await p?.evaluate(async()=>({state:await window.guitarUpdates.status(),clicks:window.__updateClicks})).catch(()=>undefined));await p?.screenshot({path:path.join(root,`v150-${scenario}-failure.png`)}).catch(()=>{});}console.log(await readResult());throw error;}
 finally{await app?.close().catch(()=>{});for(const p of await nativeProcesses(exe).catch(()=>[]))try{process.kill(p.pid);}catch{}await sleep(1200);assert(work.startsWith(root+path.sep));await fs.rm(work,{recursive:true,force:true});}
}
