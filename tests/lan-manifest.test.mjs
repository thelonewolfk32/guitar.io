import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {fixtures} from './library-harness.mjs';
import {db,saveSongs,switchStorageScope} from '../src/storage.ts';
import {contentManifest,repairLocalContent,auditOfflineContent,sha256} from '../src/content-audit.ts';
import {req,done,contentRecord,syncHead,syncSetting,setSyncSetting,contentChunk,pendingSyncContent} from '../src/sync-storage.ts';
import {SyncEngine} from '../src/lan-sync.ts';
import {newSecret} from '../shared/lan-crypto.mjs';
import {rankEndpoints,directEndpoint,connectionProblem} from '../shared/lan-endpoints.mjs';
import {networkEndpoints} from '../electron/lan-service.mjs';
async function put(store,value,key){const d=await db(),tx=d.transaction(store,'readwrite'),p=done(tx);tx.objectStore(store).put(value,key);await p;}
async function clear(store,key){const d=await db(),tx=d.transaction(store,'readwrite'),p=done(tx);tx.objectStore(store).delete(key);await p;}

test('legacy bytes gain verified descriptors and a protocol 3 manifest without replaying checkpoints',async()=>{
 const s={...fixtures(1,4)[0],source:new Uint8Array(fixtures(1,4)[0].source)};await saveSongs([s]);
 const art=new Blob([new Uint8Array([1,2,3])],{type:'image/jpeg'});await put('assets',{id:s.artworkAssetId,kind:'artwork',mime:'image/jpeg',name:'Cover.jpg',blob:art});
 await put('songSources',{id:s.id,source:s.source});await clear('syncEntities','source/'+s.id);await clear('syncEntities','asset/'+s.artworkAssetId);
 await setSyncSetting('pull:phone',217);await setSyncSetting('push:phone',218);await setSyncSetting('content-queue-ready',true);
 await repairLocalContent();const record=await contentRecord('source',s.id);assert.equal(record.hash,s.hash);assert.equal(record.byteLength,s.source.length);
 assert.equal(await syncSetting('pull:phone'),217);assert.equal(await syncSetting('push:phone'),218);
 const manifest=await contentManifest('',1);assert.equal(manifest.items.length,1);assert.equal(manifest.more,true);assert.equal(manifest.items[0].kind,'asset');assert.equal(manifest.items[0].available,true);
 const second=await contentManifest(manifest.after,1);assert.equal(second.items[0].kind,'source');assert.equal(second.items[0].hash,s.hash);assert.equal(second.more,false);
 const head=await syncHead();await repairLocalContent();assert.equal(await syncHead(),head,'repair is idempotent and emits no duplicate metadata');
 assert.equal((await auditOfflineContent()).complete,true);
});

test('stale initialized queue and entirely absent descriptors are repaired while missing bytes stay unavailable',async()=>{
 const s={...fixtures(2,4)[1],id:'metadata-only',source:new Uint8Array(fixtures(2,4)[1].source),artworkAssetId:'lost-cover'};await saveSongs([s]);
 await put('songSources',{id:s.id});await clear('settings','lan:pending-content:source/'+s.id);await setSyncSetting('content-queue-ready',true);
 await repairLocalContent();assert.equal((await contentRecord('source',s.id)).hash,s.hash);assert.equal((await contentRecord('source',s.id)).byteLength,s.source.length);assert((await pendingSyncContent()).some(item=>item.id===s.id));assert((await pendingSyncContent()).some(item=>item.id==='lost-cover'));
 assert.equal((await contentManifest()).items.find(item=>item.id===s.id).available,false);
 const audit=await auditOfflineContent();assert.equal(audit.complete,false);assert(audit.missingSources.some(item=>item.id===s.id));assert(audit.missingArtwork.some(item=>item.id==='lost-cover'));
 await assert.rejects(contentChunk('source',s.id,0),/not cached/);
});

test('source bytes embedded in a legacy song recover without changing edits or progress',async()=>{
 const s={...fixtures(3,4)[2],id:'legacy-embedded',source:new Uint8Array(fixtures(3,4)[2].source),artworkAssetId:undefined};await saveSongs([s]);
 const d=await db(),details=await req(d.transaction('songs').objectStore('songs').get(s.id));await put('songs',{...details,source:s.source});await clear('songSources',s.id);
 const before=JSON.stringify((await req(d.transaction('songs').objectStore('songs').get(s.id))).sectionsByTrack);
 await repairLocalContent();assert.deepEqual((await contentRecord('source',s.id)).source,s.source);assert.equal(JSON.stringify((await req(d.transaction('songs').objectStore('songs').get(s.id))).sectionsByTrack),before);
});

test('same-hash originals can recover a duplicate but never cross an account boundary',async()=>{
 const s={...fixtures(1,4)[0],id:'duplicate',source:new Uint8Array(fixtures(1,4)[0].source),artworkAssetId:undefined};await saveSongs([s]);await clear('songSources',s.id);await repairLocalContent();assert.deepEqual((await contentRecord('source',s.id)).source,s.source);
 await switchStorageScope('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');await saveSongs([{...s,id:'other-account'}]);await clear('songSources','other-account');await repairLocalContent();assert.equal((await contentRecord('source','other-account')).source,undefined);assert.equal((await auditOfflineContent()).complete,false);await switchStorageScope('');
});

test('checksum-corrupt GP stays recoverable but is never advertised or served as available',async()=>{
 const s={...fixtures(4,4)[3],id:'corrupt',source:new Uint8Array(fixtures(4,4)[3].source),artworkAssetId:undefined};await saveSongs([s]);const corrupted=new Uint8Array(s.source);corrupted[0]^=1;await put('songSources',{id:s.id,hash:s.hash,byteLength:s.source.length,source:corrupted});
 const report=await repairLocalContent();assert(report.problems.some(p=>p.includes('corrupt')));assert.equal((await contentManifest()).items.find(i=>i.id===s.id).available,false);await assert.rejects(contentChunk('source',s.id,0),/not cached/);
 const raw=await req((await db()).transaction('songSources').objectStore('songSources').get(s.id));assert.equal(await sha256(raw.source),await sha256(corrupted),'suspect original is retained');
});

test('pairing retries unreachable endpoints, logs timings, supports a direct address and keeps authentication',async()=>{
 const prev=globalThis.window,host=new SyncEngine(()=>true,()=>{}),client=new SyncEngine(()=>true,()=>{}),attempts=[];
 host.config={id:'host',enabled:true,name:'Mac',secret:newSecret(),pairingCode:'123456'};client.config={id:'client',enabled:true,name:'PC',secret:newSecret()};
 const first='http://10.99.0.1:4321/sync',good='http://192.168.1.8:4321/sync',link='http://169.254.3.4:4321/sync';
 globalThis.window={localStorage:{setItem(){}},guitarLan:{status:async()=>({discovered:[{id:'host',name:'Mac',code:'123456',endpoints:[link,first,good]}]}),request:async(endpoint,payload)=>{attempts.push(endpoint);if(endpoint!==good)throw Object.assign(Error('connection refused'),{code:'ECONNREFUSED'});return host.serve(payload,'pairing');}}};
 try{const result=await client.beginPair('123456');assert.equal(result.endpoint,good);assert.equal(result.id,'host');assert.deepEqual(attempts,[first,good,good]);assert(client.view.events.some(e=>e.message.includes('ms')&&e.message.includes('LAN-NET-002')));host.approvePair(false);attempts.length=0;const direct=await client.beginPair('123456','192.168.1.8:4321');assert.equal(direct.endpoint,good);host.approvePair(false);await assert.rejects(client.beginPair('654321','192.168.1.8:4321'),/LAN-PAIR-002/);assert(!JSON.stringify(client.view.events).includes(client.config.secret));}finally{host.stop();client.stop();globalThis.window=prev;}
});

test('LAN address selection retains fallbacks and puts physical interfaces before virtual and link-local',()=>{
 const iface=address=>({family:'IPv4',address,internal:false});const addresses=networkEndpoints({'vEthernet (WSL)':[iface('172.20.0.1')],'Wi-Fi':[iface('192.168.1.2')],'Ethernet':[iface('169.254.1.4')]},3456);
 assert.deepEqual(addresses,['http://192.168.1.2:3456/sync','http://172.20.0.1:3456/sync','http://169.254.1.4:3456/sync']);assert.equal(rankEndpoints([...addresses].reverse()).at(-1),addresses.at(-1));assert.equal(directEndpoint('192.168.1.2:3456'),addresses[0]);assert.throws(()=>directEndpoint('example.com:3456'));assert.match(connectionProblem(Error('TimeoutError'),addresses[0]),/LAN-NET-001/);
});

test('diagnostics report missing bytes with zero queue and never expose pairing secrets',async()=>{
 const prev=globalThis.window,engine=new SyncEngine(()=>true,()=>{});globalThis.window={localStorage:{setItem(){}}};engine.config={enabled:true,id:'local',name:'PC',secret:newSecret()};engine.view.peers=[{id:'phone',name:'Phone',endpoints:[],secret:newSecret(),clientOnly:true}];
 try{const report=await engine.diagnostics();assert.equal(report.protocol,3);assert(report.content.metadataOnlySources>0);assert(report.content.localSources>0);assert(!JSON.stringify(report).includes(engine.view.peers[0].secret));}finally{engine.stop();globalThis.window=prev;}
});

test('50 GP and 49 artwork metadata entries with a stale empty queue cannot claim offline completion',async()=>{
 await switchStorageScope('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
 const songs=fixtures(50,4).map((s,i)=>({...s,source:new Uint8Array(s.source),artworkAssetId:i===49?undefined:s.artworkAssetId}));await saveSongs(songs);
 for(const song of songs){await put('songSources',{id:song.id,hash:song.hash,byteLength:song.source.length});if(song.artworkAssetId)await put('assets',{id:song.artworkAssetId,kind:'artwork',mime:'image/jpeg',name:'Cover.jpg',byteLength:3});}
 await setSyncSetting('content-queue-ready',2);await setSyncSetting('pull:remote',314);
 const prev={window:globalThis.window,document:globalThis.document},engine=new SyncEngine(()=>true,()=>{});globalThis.window={dispatchEvent(){},localStorage:{setItem(){}}};globalThis.document={visibilityState:'visible',documentElement:{classList:{contains:()=>false}}};engine.config={enabled:true,id:'local',name:'Mac'};engine.view={...engine.view,enabled:true,autoSync:true,peers:[{id:'remote',name:'PC',endpoints:[],secret:newSecret()}]};
 engine.call=async(_peer,payload)=>{if(payload.op==='head')return {head:314,ready:false,protocol:3,contentManifest:true};if(payload.op==='content-manifest')return contentManifest(payload.after,payload.limit);throw Error('Desktop has metadata but not the original file.');};
 try{assert.equal((await pendingSyncContent()).length,0);await engine.run(true);assert.equal(engine.view.offlineComplete,false);assert.equal((await pendingSyncContent()).length,99);assert.match(engine.view.error,/still need downloading/);const audit=await auditOfflineContent();assert.equal(audit.missingSources.length,50);assert.equal(audit.missingArtwork.length,49);assert.equal(await syncSetting('pull:remote'),314);}finally{engine.stop();globalThis.window=prev.window;globalThis.document=prev.document;await switchStorageScope('');}
});
