import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fixtures,seed} from './library-harness.mjs';
import {pairingCode,open} from '../shared/lan-crypto.mjs';
const root=path.resolve('test-results'),version=JSON.parse(fs.readFileSync('package.json','utf8')).version,executablePath=path.resolve(process.env.GUITARIO_OUTPUT_DIR || 'release/artifacts',`Guitar-io-${version}-Windows-x64/Guitar.io.exe`),apps=[],profiles=[fs.mkdtempSync(path.join(root,'v143-host-')),fs.mkdtempSync(path.join(root,'v143-client-'))],errors=[];
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function records(page,store){return page.evaluate(async store=>{const d=await new Promise((r,j)=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const rows=await new Promise((r,j)=>{const q=d.transaction(store).objectStore(store).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});d.close();return store==='songSources'?rows.map(s=>({id:s.id,hasBytes:!!s.source})):rows;},store);}
try{
 for(const profile of profiles){const app=await electron.launch({executablePath,env:{...process.env,GUITARIO_TEST_PROFILE:profile}});apps.push(app);const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));await button(p,'Device sync').waitFor();}
 const a=await apps[0].firstWindow(),b=await apps[1].firstWindow();
 await a.evaluate(()=>new Promise((r,j)=>{const q=indexedDB.deleteDatabase('guitar-io-v1');q.onsuccess=r;q.onerror=()=>j(q.error);}));
 const songs=fixtures(49,8);await seed(a,'guitario://app/',songs,false,true);await a.reload();await button(a,'Open Synthetic study 000').waitFor();
 await apps[0].evaluate(()=>{const http=process.mainModule.require('node:http'),original=http.createServer;globalThis.__requests=[];http.createServer=function(handler){return original.call(this,(req,res)=>{const chunks=[];req.on('data',b=>chunks.push(b));req.on('end',()=>{try{globalThis.__requests.push(JSON.parse(Buffer.concat(chunks).toString()));}catch{}});return handler(req,res);});};});
 await button(a,'Device sync').click();await a.getByRole('switch',{name:'Enable local sync'}).click();await a.getByLabel('This device’s pairing code').waitFor();
 const cfg=await a.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});return new Promise(r=>{const q=d.transaction('settings').objectStore('settings').get('lan:config');q.onsuccess=()=>r(q.result);});}),native=await a.evaluate(()=>window.guitarLan.status());
 const peer={v:1,id:cfg.id,name:cfg.name,secret:cfg.secret,endpoints:native.endpoints.map(endpoint=>{const u=new URL(endpoint);u.hostname='127.0.0.1';return u.href;})};
 await button(b,'Device sync').click();await b.getByRole('switch',{name:'Enable local sync'}).click();await button(b,'Add device').click();await b.getByLabel('Device pairing code').fill(pairingCode(peer));await button(b,'Connect device').click();
 await b.waitForFunction(()=>document.querySelector('.sync-peer small')?.textContent?.startsWith('Checked'),{},{timeout:60000});
 const received=await records(b,'songIndex');assert.equal(received.length,49);for(const song of songs){const r=received.find(s=>s.id===song.id);assert.equal(r.album,song.album);assert.equal(r.lastPlayedAt,song.lastPlayedAt);}
 assert((await records(b,'songSources')).every(s=>!s.hasBytes));
 const envelopes=await apps[0].evaluate(()=>globalThis.__requests),operations=await Promise.all(envelopes.map(e=>open(peer.secret,e).then(m=>m.payload)));assert(operations.some(p=>p.op==='baselines'));assert(!operations.some(p=>p.op==='blob'&&p.kind==='source'));
 assert.equal(await button(b,'Export report').count(),0);await b.getByRole('switch',{name:'Show sync diagnostics'}).click();await button(b,'Clear sync diagnostics').waitFor();
 await b.evaluate(()=>{const create=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='application/json')void blob.text().then(s=>window.__report=JSON.parse(s));return create.call(this,blob);};const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download==='Guitar-io-sync-report.json')return;return original.call(this);};});
 await button(b,'Export report').click();await b.waitForFunction(()=>window.__report||document.querySelector('.device-sync>p[role=alert]')?.textContent);const report=await b.evaluate(()=>window.__report);assert(report,await b.locator('[role=alert]').allTextContents());assert.equal(report.catalogue.songs.length,49);assert(report.events.some(e=>e.stage==='Metadata repair'));assert(!JSON.stringify(report).includes(cfg.secret));
 await button(b,'Close dialog').click();
 await apps[1].evaluate(()=>{const {net,shell}=process.mainModule.require('electron'),original=net.fetch;globalThis.__updateURLs=[];net.fetch=async(url,options)=>url.startsWith('https://api.github.com/repos/')?new Response(JSON.stringify({tag_name:'v1.5.0',draft:false,prerelease:false,assets:[{name:'Guitar-io-1.5.0-Windows-x64.zip',browser_download_url:'https://github.com/thelonewolfk32/guitar.io/releases/download/v1.5.0/Guitar-io-1.5.0-Windows-x64.zip'}]}),{headers:{etag:'acceptance'}}):original(url,options);shell.openExternal=async url=>{globalThis.__updateURLs.push(url);};});
 await button(b,'App updates').click();await button(b,'Check now').click();await button(b,'Download 1.5.0').waitFor();await button(b,'Download 1.5.0').click();assert.equal((await apps[1].evaluate(()=>globalThis.__updateURLs))[0],'https://github.com/thelonewolfk32/guitar.io/releases/download/v1.5.0/Guitar-io-1.5.0-Windows-x64.zip');
 await b.screenshot({path:path.join(root,'v143-updates.png')});assert.deepEqual(errors,[]);
 console.log('PASS V1.4.3 packaged desktop: 49-song encrypted HTTP sync, base repair across pages, albums and recent history, zero GP downloads, secret-free diagnostics report, platform-specific update download UI.');
}finally{for(const app of apps)await app.close();for(const profile of profiles){assert(profile.startsWith(root+path.sep));fs.rmSync(profile,{recursive:true,force:true});}}
