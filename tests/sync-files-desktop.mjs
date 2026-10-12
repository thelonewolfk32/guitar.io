import {_electron as electron} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {fixtures,seed,capturePlayer} from './library-harness.mjs';
import {pairingCode,open} from '../shared/lan-crypto.mjs';
const root=path.resolve('test-results');fs.mkdirSync(root,{recursive:true});
const packaged=process.argv.includes('--packaged'),version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const executablePath=path.resolve(packaged?`release/artifacts/Guitar-io-${version}-Windows-x64/Guitar.io.exe`:'node_modules/electron/dist/electron.exe'),profiles=[fs.mkdtempSync(path.join(root,'complete-sync-host-')),fs.mkdtempSync(path.join(root,'complete-sync-client-'))],apps=[],errors=[];
const launch=profile=>electron.launch({executablePath,args:packaged?[]:['.'],env:{...process.env,GUITARIO_TEST_PROFILE:profile}}),button=(p,name)=>p.getByRole('button',{name,exact:true});
async function snapshot(page){return page.evaluate(async()=>{
 const d=await new Promise((r,j)=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const get=store=>new Promise((r,j)=>{const q=d.transaction(store).objectStore(store).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
 const sources=await get('songSources'),assets=await get('assets');d.close();return {sources:sources.map(s=>({id:s.id,hasBytes:!!s.source})),assets:assets.map(a=>({id:a.id,hasBytes:!!a.blob,size:a.blob?.size}))};
});}
async function waitFiles(page){
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  const files=await snapshot(page);
  if(files.sources.length===3&&files.sources.every(s=>s.hasBytes)&&files.assets.some(a=>a.id==='backing')&&files.assets.every(a=>a.hasBytes)&&!await page.locator('.sync-footer .spin').count())return;
  await page.waitForTimeout(150);
 }
 throw new Error('File sync did not finish: '+JSON.stringify(await snapshot(page)));
}
try{
 for(const profile of profiles){const app=await launch(profile);apps.push(app);const p=await app.firstWindow();p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));await button(p,'Help').waitFor();}
 const a=await apps[0].firstWindow();let b=await apps[1].firstWindow();
 await a.evaluate(()=>new Promise((r,j)=>{const q=indexedDB.deleteDatabase('guitar-io-v1');q.onsuccess=r;q.onerror=()=>j(q.error);}));
 const songs=fixtures(3,4);songs[0].media={recordings:[{id:'backing-recording',label:'Backing',name:'Backing.mp3',kind:'audio',purpose:'full',tags:[],offsetSeconds:0,assetId:'backing'}]};
 await seed(a,'guitario://app/',songs,false,true);
 await a.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});await new Promise((r,j)=>{const tx=d.transaction('assets','readwrite');tx.objectStore('assets').put({id:'backing',kind:'audio',name:'Backing.mp3',mime:'audio/mpeg',blob:new Blob([new Uint8Array(1200000)],{type:'audio/mpeg'})});tx.oncomplete=r;tx.onerror=()=>j(tx.error);});d.close();});
 await a.reload();await button(a,'Open Synthetic study 000').waitFor();
 await apps[0].evaluate(()=>{const http=process.mainModule.require('node:http'),original=http.createServer;globalThis.__requests=[];http.createServer=function(handler){return original.call(this,(req,res)=>{const chunks=[];req.on('data',b=>chunks.push(b));req.on('end',()=>{try{globalThis.__requests.push(JSON.parse(Buffer.concat(chunks).toString()));}catch{}});return handler(req,res);});};});
 await button(a,'Device sync').click();await a.getByRole('switch',{name:'Enable local sync'}).click();await a.getByLabel('This device’s pairing code').waitFor();
 const cfg=await a.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});return new Promise(r=>{const q=d.transaction('settings').objectStore('settings').get('lan:config');q.onsuccess=()=>r(q.result);});}),native=await a.evaluate(()=>window.guitarLan.status());
 const peer={v:1,id:cfg.id,name:cfg.name,secret:cfg.secret,endpoints:native.endpoints.map(endpoint=>{const u=new URL(endpoint);u.hostname='127.0.0.1';return u.href;})};
 await button(b,'Device sync').click();await b.getByRole('switch',{name:'Enable local sync'}).click();await button(b,'Add device').click();await b.getByLabel('Device pairing code').fill(pairingCode(peer));await button(b,'Connect device').click();await waitFiles(b);
 const received=await snapshot(b);console.log('Received file summary:',JSON.stringify(received));assert(received.sources.every(s=>s.hasBytes));assert(received.assets.every(a=>a.hasBytes));assert.equal(received.assets.find(a=>a.id==='backing')?.size,1200000);
 await b.screenshot({path:path.join(root,'complete-sync-files.png')});
 const operations=async()=>Promise.all((await apps[0].evaluate(()=>globalThis.__requests)).map(e=>open(peer.secret,e).then(m=>m.payload)));
 assert((await operations()).some(p=>p.op==='blob'&&p.kind==='source'));
 const before=(await operations()).filter(p=>p.op==='blob').length;await button(b,'Sync now').click();await b.waitForFunction(()=>!document.querySelector('.sync-footer .spin'));assert.equal((await operations()).filter(p=>p.op==='blob').length,before,'cached files are not transferred again');
 await b.getByLabel('Auto sync',{exact:true}).uncheck();
 await b.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});await new Promise(r=>{const tx=d.transaction(['songSources','settings'],'readwrite'),q=tx.objectStore('songSources').get('fixture-001');q.onsuccess=()=>{const {source,...metadata}=q.result;tx.objectStore('songSources').put(metadata);};tx.objectStore('settings').delete('lan:content-queue-ready');tx.oncomplete=r;});d.close();});
 await button(b,'Sync now').click();await waitFiles(b);assert((await operations()).filter(p=>p.op==='blob').length>before,'existing metadata-only song is repaired');
 await b.getByRole('switch',{name:'Enable local sync'}).click();await button(b,'Close dialog').click();await button(b,'Help').click();assert.equal(await b.locator('.help-steps>div').count(),2);assert.equal(await b.locator('.help-note').count(),0);assert.match(await b.locator('.help-steps').innerText(),/Add a guitar/);assert.match(await button(b,'Learn').innerText(),/beta/);await b.screenshot({path:path.join(root,'complete-sync-help.png')});
 await b.setViewportSize({width:393,height:852});await b.screenshot({path:path.join(root,'complete-sync-help-mobile.png')});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await button(b,'Close dialog').click();
 await apps[0].close();apps[0]=undefined;await apps[1].close();apps[1]=await launch(profiles[1]);b=await apps[1].firstWindow();b.on('pageerror',e=>errors.push(e.message));await button(b,'Open Synthetic study 001').waitFor();await capturePlayer(b);await button(b,'Open Synthetic study 001').click();await button(b,'Select bar 4').waitFor();await b.waitForFunction(()=>window.__testApi?.isReadyForPlayback);assert((await snapshot(b)).sources.every(s=>s.hasBytes));
 assert.deepEqual(errors,[]);console.log('PASS complete file sync: encrypted desktop LAN, GP/audio/artwork downloads, multi-chunk MP3, no-change reuse, legacy repair, restart and offline score opening, compact desktop/mobile Help, Learn beta.');
}catch(error){console.log('Sync diagnostics:',await (await apps[1]?.firstWindow())?.evaluate(()=>localStorage.getItem('guitario-sync-diagnostics')));throw error;}finally{
 for(const app of apps)await app?.close().catch(()=>{});
 for(const profile of profiles){const resolved=path.resolve(profile);assert(resolved.startsWith(root+path.sep));fs.rmSync(resolved,{recursive:true,force:true});}
}
