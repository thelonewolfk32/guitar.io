import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {fixtures} from './library-harness.mjs';
import {db,readSong,getAsset,saveSongs} from '../src/storage.ts';
import {mergeSyncRow,projectSyncRow} from '../src/sync-model.ts';
import {applySyncPage,contentRecord,finishTransfer,initializeContentQueue,pendingSyncContent,syncSetting,setSyncSetting,storeTransfer,transferProgress,req,done} from '../src/sync-storage.ts';
import {SyncEngine} from '../src/lan-sync.ts';
const fixture=fixtures(1,4)[0],bytes=new Uint8Array(fixture.source),wire=(entity,id,patch,revision=1,operation='upsert')=>projectSyncRow(mergeSyncRow(undefined,{entity,entityId:id,deviceId:'remote',timestamp:'2300-01-01T00:00:00.000Z',operation,fields:Object.keys(patch),patch,revision},revision),0);
const songRows=id=>{const {source,sections,sectionsByTrack,media,annotations,updatedAt,...meta}=fixture;return [wire('song',id,{...meta,id,artworkAssetId:null}),wire('source',id,{hash:fixture.hash,byteLength:bytes.length},2)];};
const pending=()=>pendingSyncContent();
async function put(store,value,key){const d=await db(),tx=d.transaction(store,'readwrite'),p=done(tx);tx.objectStore(store).put(value,key);await p;}
async function remove(store,key){const d=await db(),tx=d.transaction(store,'readwrite'),p=done(tx);tx.objectStore(store).delete(key);await p;}
function environment(){
 const previous={window:globalThis.window,document:globalThis.document};
 globalThis.window={dispatchEvent:()=>{},localStorage:{setItem:()=>{}}};globalThis.document={visibilityState:'visible',documentElement:{classList:{contains:()=>false}}};
 const engine=new SyncEngine(()=>true,()=>{});engine.config={enabled:true,id:'local',name:'PC'};engine.view={...engine.view,enabled:true,autoSync:false,peers:[{id:'remote',name:'Mac',endpoints:[],secret:'fixture'}]};
 return {engine,restore(){engine.stop();globalThis.window=previous.window;globalThis.document=previous.document;}};
}
function chunk(content,offset,limit=512*1024){return {bytes:Buffer.from(content.subarray(offset,offset+limit)).toString('base64'),offset,size:content.length};}

test('existing metadata-only files are queued once without resetting checkpoints',async()=>{
 await put('songSources',{id:'legacy-missing',hash:fixture.hash,byteLength:bytes.length});
 await put('songSources',{id:'legacy-cached',hash:fixture.hash,byteLength:bytes.length,source:bytes});
 await put('assets',{id:'legacy-art',kind:'artwork',mime:'image/jpeg',name:'Cover.jpg',byteLength:4});
 await setSyncSetting('pull:remote',42);await initializeContentQueue();
 assert((await pending()).some(p=>p.id==='legacy-missing'));assert((await pending()).some(p=>p.id==='legacy-art'));assert(!(await pending()).some(p=>p.id==='legacy-cached'));assert.equal(await syncSetting('pull:remote'),42);
 await remove('settings','lan:pending-content:source/legacy-missing');await initializeContentQueue();assert(!(await pending()).some(p=>p.id==='legacy-missing'),'repair does not rescan originals on every check');
 await remove('assets','legacy-art');await remove('settings','lan:pending-content:asset/legacy-art');
});

test('metadata apply queues bytes atomically and completion persists GP/audio/artwork',async()=>{
 const id='download-song';await applySyncPage(songRows(id),{peer:'remote',cursor:50});
 const audio=new Uint8Array([1,2,3,4]),art=new Uint8Array([5,6,7]);
 await applySyncPage([wire('asset','audio',{kind:'audio',mime:'audio/mpeg',name:'Backing.mp3',byteLength:4}),wire('asset','art',{kind:'artwork',mime:'image/jpeg',name:'Cover.jpg',byteLength:3})]);
 assert((await pending()).some(p=>p.id===id));assert.equal(await syncSetting('pull:remote'),50);
 const {engine,restore}=environment();const requests=[];
 engine.call=async(_peer,payload)=>{requests.push(payload);if(payload.op==='head')return {head:50,ready:false,protocol:2};const data=payload.id===id?bytes:payload.id==='audio'?audio:art;return chunk(data,payload.offset);};
 try{
  await engine.run();assert.equal(engine.view.pendingFiles,0);assert.equal(engine.view.error,'');assert.deepEqual((await readSong(id)).source,bytes);
  assert.deepEqual(new Uint8Array(await (await getAsset('audio')).blob.arrayBuffer()),audio);assert.deepEqual(new Uint8Array(await (await getAsset('art')).blob.arrayBuffer()),art);
  const downloads=requests.filter(r=>r.op==='blob').length;await engine.run();assert.equal(requests.filter(r=>r.op==='blob').length,downloads,'no-change sync never downloads cached bytes again');
  engine.view.enabled=false;engine.call=async()=>{throw new Error('Source asleep');};assert.deepEqual((await readSong(id)).source,bytes);
 }finally{restore();}
});

test('offline failure leaves a durable queue and resumable chunk prefix for next sync',async()=>{
 const id='resume-song',resumeBytes=new Uint8Array(fixtures(2,4)[1].source),resumeHash=fixtures(2,4)[1].hash;await applySyncPage(songRows(id).map(row=>({...row,patch:{...row.patch,...(row.entity==='song'?{hash:resumeHash}:row.entity==='source'?{hash:resumeHash,byteLength:resumeBytes.length}:{})}})));await storeTransfer('source/'+id,resumeBytes.subarray(0,100),0,resumeBytes.length);
 const {engine,restore}=environment();let unavailable=true;const offsets=[];
 engine.call=async(_peer,payload)=>{if(payload.op==='head')return {head:50,ready:false,protocol:2};offsets.push(payload.offset);if(unavailable)throw new Error('Mac is asleep');return chunk(resumeBytes,payload.offset);};
 try{
  await engine.run();assert((await pending()).some(p=>p.id===id));assert.match(engine.view.error,/still need downloading/);assert.equal((await transferProgress('source/'+id)).offset,100);
  unavailable=false;await engine.run();assert.equal(offsets.at(-1),100);assert(!(await pending()).some(p=>p.id===id));assert.deepEqual((await readSong(id)).source,resumeBytes);
 }finally{restore();}
});

test('integrity failures clear poisoned chunks so the next retry can repair the file',async()=>{
 const id='checksum-song';await applySyncPage(songRows(id));const corrupt=new Uint8Array(bytes);corrupt[0]^=1;await storeTransfer('source/'+id,corrupt,0,corrupt.length);
 await assert.rejects(finishTransfer('source',id,new Blob([corrupt])),/checksum/);assert.equal(await transferProgress('source/'+id),undefined);assert((await pending()).some(p=>p.id===id));
 await assert.rejects(finishTransfer('source',id,new Blob([bytes.subarray(0,5)])),/size/);await finishTransfer('source',id,new Blob([bytes]));assert.deepEqual((await readSong(id)).source,bytes);
});

test('deletion removes queued originals and failed metadata pages cannot enqueue files',async()=>{
 const id='deleted-song';await applySyncPage(songRows(id));await applySyncPage([wire('song',id,{},100,'delete')]);assert(!(await pending()).some(p=>p.id===id));
 await assert.rejects(applySyncPage([wire('source','rollback-source',{hash:fixture.hash,byteLength:bytes.length}),wire('source','bad-source',{hash:fixture.hash,byteLength:-1})],{peer:'invalid',cursor:200}));
 assert.equal(await contentRecord('source','rollback-source'),undefined);assert(!(await pending()).some(p=>p.id==='rollback-source'));assert.equal(await syncSetting('pull:invalid'),undefined);
});

test('foreground clients upload original files to hosts that advertise support',async()=>{
 const id='phone-upload',song={...fixture,id,source:bytes,artworkAssetId:undefined};await saveSongs([song]);
 const {engine,restore}=environment(),received=[];let queried=0;
 engine.call=async(_peer,payload)=>{
  if(payload.op==='head')return {head:50,ready:true,protocol:2,contentUpload:true};
  if(payload.op==='apply')return {accepted:payload.rows.length};
  if(payload.op==='missing-files'){queried++;return {files:[{kind:'source',id,offset:100}],more:false};}
  assert.equal(payload.op,'put-blob');assert.equal(payload.offset,100);received.push(Buffer.from(payload.bytes,'base64'));return {offset:100+received.at(-1).length};
 };
 try{await engine.run();assert.equal(queried,1);assert.deepEqual(new Uint8Array(Buffer.concat(received)),bytes.subarray(100));assert.equal(engine.view.peers[0].error,'');}finally{restore();}
});

test('desktop hosts accept resumable client uploads and persist bytes before acknowledging',async()=>{
 const id='incoming-phone-song';await applySyncPage(songRows(id));await storeTransfer('source/'+id,bytes.subarray(0,100),0,bytes.length);
 const {engine,restore}=environment();
 try{
  assert.equal((await engine.serve({op:'head'},'phone')).contentUpload,true);
  const waiting=await engine.serve({op:'missing-files'},'phone');assert.equal(waiting.files.find(p=>p.id===id).offset,100);
  const uploaded=await engine.serve({op:'put-blob',kind:'source',id,offset:100,bytes:Buffer.from(bytes.subarray(100)).toString('base64')},'phone');assert.equal(uploaded.offset,bytes.length);assert.deepEqual((await readSong(id)).source,bytes);assert(!(await pending()).some(p=>p.id===id));
  await assert.rejects(engine.serve({op:'put-blob',kind:'source',id,offset:-1,bytes:'AA=='},'phone'),/Invalid file chunk/);
  await engine.pauseForUpdate();assert.deepEqual(await engine.serve({op:'put-blob',kind:'source',id,offset:0,bytes:'AA=='},'phone'),{busy:true});
 }finally{restore();}
});

test('opening a file joins its incoming upload instead of downloading competing chunks',async()=>{
 const id='joined-upload';await applySyncPage(songRows(id));const {engine,restore}=environment();
 try{
  await engine.serve({op:'put-blob',kind:'source',id,offset:0,bytes:Buffer.from(bytes.subarray(0,100)).toString('base64')},'phone');
  let finished=false;const opening=engine.fetchContent('source',id).then(()=>{finished=true;});
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(finished,false);
  await engine.serve({op:'put-blob',kind:'source',id,offset:100,bytes:Buffer.from(bytes.subarray(100)).toString('base64')},'phone');
  await opening;assert.deepEqual((await readSong(id)).source,bytes);
 }finally{restore();}
});

test('an active pull owns its file and rejects a competing upload without changing progress',async()=>{
 const id='owned-pull';await applySyncPage(songRows(id));const {engine,restore}=environment();
 engine.transfers.set('source/'+id,Promise.resolve());
 try{
  assert.deepEqual(await engine.serve({op:'put-blob',kind:'source',id,offset:0,bytes:Buffer.from(bytes.subarray(0,100)).toString('base64')},'phone'),{busy:true});
  assert.equal(await transferProgress('source/'+id),undefined);
 }finally{engine.transfers.clear();restore();}
});
