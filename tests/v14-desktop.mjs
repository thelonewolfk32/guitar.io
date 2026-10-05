import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fixtures,seed,instrument,capturePlayer} from './library-harness.mjs';
import {open,parsePairing,pairingCode} from '../shared/lan-crypto.mjs';
const root=path.resolve('test-results');fs.mkdirSync(root,{recursive:true});
const version=JSON.parse(fs.readFileSync('package.json')).version,executablePath=path.resolve('../../Guitar-io-'+version+'-Windows-x64/Guitar.io.exe');
const profiles=[fs.mkdtempSync(path.join(root,'v14-a-')),fs.mkdtempSync(path.join(root,'v14-b-'))],apps=[];const errors=[];
const button=(page,name)=>page.getByRole('button',{name,exact:true});
async function query(page,store,id){return page.evaluate(async({store,id})=>{const d=await new Promise((resolve,reject)=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});const value=await new Promise((resolve,reject)=>{const q=d.transaction(store).objectStore(store).get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});d.close();if(store==='songSources')return value?{hasBytes:!!value.source,hash:value.hash}:undefined;return value;},{store,id});}
async function sync(page){if(!await page.getByRole('dialog').count())await button(page,'Device sync').click();await button(page,'Sync now').click();await page.waitForFunction(()=>!document.querySelector('.sync-footer .spin'));
  const error=await page.locator('.sync-peer small').allTextContents();assert(!error.some(s=>/Invalid|failed|missing|cannot|rejected|not available|Incomplete|reset/i.test(s)),error.join(';'));}
try{
  for(const profile of profiles){const app=await electron.launch({executablePath,env:{...process.env,GUITARIO_TEST_PROFILE:profile}});apps.push(app);const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await button(page,'Device sync').waitFor();await instrument(page);}
  const a=await apps[0].firstWindow();let b=await apps[1].firstWindow();const url='guitario://app/';
  await a.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase('guitar-io-v1');q.onsuccess=resolve;q.onerror=()=>reject(q.error);}));
  await seed(a,url,fixtures(1,8),false,true);await a.goto(url);await button(a,'Open Synthetic study 000').waitFor();
  await apps[0].evaluate(()=>{const http=process.mainModule.require('node:http'),original=http.createServer;globalThis.__lanRequests=[];http.createServer=function(handler){return original.call(this,(req,res)=>{const chunks=[];req.on('data',b=>chunks.push(b));req.on('end',()=>{try{globalThis.__lanRequests.push(JSON.parse(Buffer.concat(chunks).toString()));}catch{}});return handler(req,res);});};});
  await button(a,'Device sync').click();await a.getByRole('switch',{name:'Enable local sync'}).click();await a.getByLabel('This device’s pairing code').waitFor();
  const cfg=await query(a,'settings','lan:config'),native=await a.evaluate(()=>window.guitarLan.status());const pairing={v:1,id:cfg.id,name:cfg.name,secret:cfg.secret,endpoints:native.endpoints};pairing.endpoints=pairing.endpoints.map(url=>{const u=new URL(url);u.hostname='127.0.0.1';return u.href;});
  await button(b,'Device sync').click();await b.getByRole('switch',{name:'Enable local sync'}).click();await button(b,'Add device').click();await b.getByLabel('Device pairing code').fill(pairingCode(pairing));await button(b,'Connect device').click();
  await b.waitForFunction(()=>document.querySelector('.sync-peer small')?.textContent?.includes('Checked'));
  assert.equal((await query(b,'songs','fixture-000')).title,'Synthetic study 000');assert.equal((await query(b,'songSources','fixture-000')).hasBytes,false,'Catalogue sync leaves GP uncached');
  const requests=await apps[0].evaluate(()=>globalThis.__lanRequests);const operations=await Promise.all(requests.map(e=>open(pairing.secret,e).then(m=>m.payload.op)));assert(!operations.includes('blob')||operations.filter(o=>o==='blob').length===1,'Only artwork may download while browsing');
  const replay=await fetch(pairing.endpoints[0],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(requests[0])});assert.equal(replay.status,403,'Host rejects replayed encrypted requests');
  await button(a,'Close dialog').click();await button(b,'Close dialog').click();
  // Metadata edits cross devices without original-byte transfer.
  await button(a,'Edit Synthetic study 000 details').click();await a.getByLabel('Song title').fill('LAN study');await button(a,'Save changes').click();await button(a,'Open LAN study').waitFor();
  await sync(b);assert.equal((await query(b,'songs','fixture-000')).title,'LAN study');assert.equal((await query(b,'songSources','fixture-000')).hasBytes,false);
  const beforeIdle=(await apps[0].evaluate(()=>globalThis.__lanRequests)).length;await sync(b);const idleRequests=(await apps[0].evaluate(()=>globalThis.__lanRequests)).slice(beforeIdle);const idleOps=await Promise.all(idleRequests.map(e=>open(pairing.secret,e).then(m=>m.payload.op)));assert.deepEqual(idleOps,['head'],'Unchanged sync exchanges only a head revision');
  await button(b,'Close dialog').click();await capturePlayer(b);await button(b,'Open LAN study').click();await button(b,'Select bar 8').waitFor();await b.waitForFunction(()=>window.__testApi?.isReadyForPlayback);assert.equal((await query(b,'songSources','fixture-000')).hasBytes,true,'Opening downloads and caches GP');
  await button(b,'Edit Intro').click();await b.getByLabel('Percentage learnt',{exact:true}).fill('100');await button(b,'Save section').click();await button(b,'Return to library').click();await sync(b);
  const remote=await query(a,'songs','fixture-000');assert.equal(remote.sectionsByTrack['0'][0].status,'mastered');
  await button(b,'Close dialog').click();await button(b,'Device sync').click();await b.getByRole('switch',{name:'Enable local sync'}).click();await button(b,'Close dialog').click();await button(b,'Open LAN study').click();await button(b,'Select bar 8').waitFor();await b.waitForFunction(()=>window.__testApi?.isReadyForPlayback);await button(b,'Return to library').click();
  // Re-enable/restart checkpoint does not download GP again.
  await button(b,'Device sync').click();await b.getByRole('switch',{name:'Enable local sync'}).click();await sync(b);await button(b,'Close dialog').click();
  const beforeRestart=(await apps[0].evaluate(()=>globalThis.__lanRequests)).length;await apps[1].close();apps[1]=await electron.launch({executablePath,env:{...process.env,GUITARIO_TEST_PROFILE:profiles[1]}});b=await apps[1].firstWindow();b.on('pageerror',e=>errors.push(e.message));await button(b,'Open LAN study').waitFor();await sync(b);
  assert.equal((await query(b,'songSources','fixture-000')).hasBytes,true);const restarted=(await apps[0].evaluate(()=>globalThis.__lanRequests)).slice(beforeRestart),restartOps=await Promise.all(restarted.map(e=>open(pairing.secret,e).then(m=>m.payload.op)));assert(restartOps.every(op=>op==='head'),'Restart reuses persisted checkpoints and cache: '+restartOps);
  await button(b,'Close dialog').click();
  await button(a,'Delete LAN study').click();await button(a,'Delete song').click();await sync(b);assert.equal(await query(b,'songs','fixture-000'),undefined);assert.equal(await query(b,'songSources','fixture-000'),undefined);assert.equal(await query(b,'assetRefs',['cover-0','song:fixture-000']),undefined);
  assert.deepEqual(errors,[]);await b.screenshot({path:'test-results/v14-device-sync.png'});
  console.log('PASS V1.4 packaged desktop: actual encrypted HTTP/replay rejection, schema-2 upgrade, pairing, lazy GP, changed metadata/progress, head-only idle/restart checks, persisted checkpoints, offline cached reopen, deletion propagation.');
}finally{for(const app of apps)await app.close();for(const profile of profiles){assert(profile.startsWith(root+path.sep));fs.rmSync(profile,{recursive:true,force:true});}}
