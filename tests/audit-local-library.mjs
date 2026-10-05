// Read an isolated copy of the existing profile; never start the application or LAN service.
import fs from 'node:fs/promises';
import path from 'node:path';
import {_electron as electron} from 'playwright';
const root=path.resolve('test-results/local-library-audit');
await fs.mkdir(root,{recursive:true});
const profile=path.join(root,'profile');await fs.mkdir(profile,{recursive:true});
await fs.cp(path.join(process.env.APPDATA,'Guitar.io','IndexedDB'),path.join(profile,'IndexedDB'),{recursive:true,filter:p=>path.basename(p)!=='LOCK'});
const main=path.join(root,'main.cjs');
await fs.writeFile(main,`const {app,BrowserWindow,protocol,session}=require('electron');
protocol.registerSchemesAsPrivileged([{scheme:'guitario',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setPath('userData',${JSON.stringify(profile)});
app.whenReady().then(()=>{session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));protocol.handle('guitario',()=>new Response('<!doctype html><title>Offline read-only library audit</title>',{headers:{'Content-Type':'text/html'}}));const w=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});w.loadURL('guitario://app/');});app.on('window-all-closed',()=>app.quit());`,'utf8');
let app;
try{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[main],env});
 const page=await app.firstWindow();await page.waitForLoadState();
 const result=await page.evaluate(async()=>{
  const names=await indexedDB.databases();if(!names.some(d=>d.name==='guitar-io-v1'))throw Error('No existing library database.');
  const db=await new Promise((res,rej)=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
  const getAll=store=>new Promise((res,rej)=>{if(!db.objectStoreNames.contains(store))return res([]);const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
  const [songs,assets,sources,rows]=await Promise.all(['songs','assets','songSources','syncEntities'].map(getAll));
  const targets=/44 Calib|^Alpha$|Blood Moon|^Control$/i;
  const slim=s=>({id:s.id,title:s.title,artist:s.artist,album:s.album,artworkAssetId:s.artworkAssetId,hash:s.hash,bars:s.bars,bpm:s.bpm,tags:s.tags,guitars:s.guitars,format:s.format,lastPlayedAt:s.lastPlayedAt,lastOpenedAt:s.lastOpenedAt,sourceBytes:sources.find(x=>x.id===s.id)?.source?.byteLength,sourceMetadata:sources.find(x=>x.id===s.id)&&{byteLength:sources.find(x=>x.id===s.id).byteLength,hash:sources.find(x=>x.id===s.id).hash},sync:rows.filter(r=>r.entityId===s.id).map(r=>({entity:r.entity,revision:r.revision,patch:r.entity==='song'?Object.fromEntries(Object.entries(r.patch||{}).filter(([k])=>!['spliceUndo','source','fieldUpdatedAt'].includes(k))):r.patch}))});
  return {dbVersion:db.version,songCount:songs.length,songs:songs.map(s=>({id:s.id,title:s.title,album:s.album,artworkAssetId:s.artworkAssetId})),targets:songs.filter(s=>targets.test(s.title)).map(slim),assets:assets.map(a=>({id:a.id,name:a.name,kind:a.kind,mime:a.mime,byteLength:a.byteLength,blobBytes:a.blob?.size,blobMime:a.blob?.type})),rows:rows.map(r=>({entity:r.entity,id:r.entityId,revision:r.revision,operation:r.operation,...(['asset','source'].includes(r.entity)?{patch:r.patch}:{}),...(r.entity==='song'?{title:r.patch?.title,album:r.patch?.album}: {})})),lanSettings:await new Promise((res,rej)=>{const out={},q=db.transaction('settings','readonly').objectStore('settings').openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return res(out);if(String(c.key).startsWith('lan:pull:')||String(c.key).startsWith('lan:push:'))out[c.key]=c.value;if(c.key==='lan:peers')out.peers=c.value.map(p=>({id:p.id,name:p.name,error:p.error,lastSync:p.lastSync,endpointCount:p.endpoints?.length}));c.continue();};q.onerror=()=>rej(q.error);})};
 });
 await fs.writeFile(path.join(root,'report.json'),JSON.stringify(result,null,2),'utf8');
 const state=await page.evaluate(async()=>{const d=await new Promise((r,j)=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});return new Promise((r,j)=>{const q=d.transaction('syncEntities','readonly').objectStore('syncEntities').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 await fs.writeFile(path.join(root,'state.json'),JSON.stringify(state),'utf8');
 console.log(JSON.stringify({songCount:result.songCount,targets:result.targets.map(s=>({title:s.title,id:s.id,album:s.album,artworkAssetId:s.artworkAssetId,sourceBytes:s.sourceBytes,sync:s.sync.map(r=>({entity:r.entity,revision:r.revision}))})),invalidAssets:result.assets.filter(a=>!['image/png','image/jpeg','image/webp','audio/mpeg','audio/mp3'].includes(a.mime)||!(a.byteLength||a.blobBytes)),settings:result.lanSettings},null,2));
}finally{await app?.close();}
