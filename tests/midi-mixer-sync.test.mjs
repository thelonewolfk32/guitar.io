import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {fixtures} from './library-harness.mjs';
import {mergeSyncRow,projectSyncRow} from '../src/sync-model.ts';
import {db,readSong,saveSongs,patchSongs,switchStorageScope} from '../src/storage.ts';
import {applySyncPage,syncPage,syncHead,syncSetting,req,finishTransfer,setIncomingGuard,deferredSyncRows} from '../src/sync-storage.ts';

const peer='mixer-iphone',id='mixer-song',mixer={masterVolume:0.8,tracks:{'0':{volume:1.2,muted:false,solo:true},'3':{volume:0,muted:true,solo:false}}};
const fixture=fixtures(1,4)[0],source=new Uint8Array(fixture.source);
const {source:_source,sections,sectionsByTrack,media,annotations,noteEdits,annotationPositions,updatedAt,...metadata}=fixture;
const wire=(patch,revision=1,entityId=id,timestamp='2099-01-01T00:00:00.000Z',entity='song')=>projectSyncRow(mergeSyncRow(undefined,{entity,entityId,deviceId:peer,timestamp,operation:'upsert',fields:Object.keys(patch),patch,revision},revision),0);
const stored=async()=>{const d=await db();return req(d.transaction('songs').objectStore('songs').get(id));};
const clockValue=async()=>{const d=await db();return req(d.transaction('settings').objectStore('settings').get('syncClock'));};

test('LAN accepts and materializes iPhone mixer metadata before GP bytes; older songs remain unchanged',async()=>{
 await applySyncPage([
  wire({...metadata,id,artworkAssetId:null,midiMixer:mixer}),
  wire({...metadata,id:'legacy-mixer-song',artworkAssetId:null},2,'legacy-mixer-song')
 ],{peer,cursor:2});
 assert.deepEqual((await stored()).midiMixer,mixer);
 assert.equal(await syncSetting('pull:'+peer),2);
 const d=await db(),legacy=await req(d.transaction('songs').objectStore('songs').get('legacy-mixer-song'));
 assert.equal(Object.hasOwn(legacy,'midiMixer'),false);
 assert.deepEqual((await syncPage()).rows.find(r=>r.entityId===id).patch.midiMixer,mixer,'another desktop can relay the complete mixer');
});

test('invalid mixer pages preserve every previous field, sync head, clock and pull checkpoint',async()=>{
 const track={volume:1,muted:false,solo:false};
 const invalid=[
  null,undefined,[],0,'mixer',true,{},
  {...mixer,extra:true},{...mixer,masterVolume:undefined},{...mixer,masterVolume:-0.01},{...mixer,masterVolume:1.01},{...mixer,masterVolume:NaN},{...mixer,masterVolume:Infinity},{...mixer,masterVolume:'0.5'},
  {masterVolume:1},{masterVolume:1,tracks:null},{masterVolume:1,tracks:[]},{masterVolume:1,tracks:'tracks'},
  ...['-1','1.5','1e2','+1',' 0',''].map(key=>({masterVolume:1,tracks:{[key]:track}})),
  {masterVolume:1,tracks:Object.fromEntries(Array.from({length:257},(_,i)=>[i,track]))},
  ...[null,[],0,{}, {...track,volume:undefined},{...track,volume:-0.01},{...track,volume:1.51},{...track,volume:NaN},{...track,volume:-Infinity},{...track,volume:'1'}, {...track,muted:0},{...track,muted:undefined},{...track,solo:'false'},{...track,solo:undefined},{...track,pan:0}].map(value=>({masterVolume:1,tracks:{'0':value}}))
 ];
 const before=await stored(),head=await syncHead(),clock=await clockValue(),checkpoint=await syncSetting('pull:'+peer);
 for(const [i,value] of invalid.entries()){
  await assert.rejects(applySyncPage([wire({title:'Must roll back'},10+i*2),wire({midiMixer:value},11+i*2)],{peer,cursor:100+i}),/Invalid MIDI mixer/,`invalid case ${i}`);
  assert.deepEqual(await stored(),before,`metadata changed for case ${i}`);
  assert.equal(await syncHead(),head);assert.equal(await clockValue(),clock);assert.equal(await syncSetting('pull:'+peer),checkpoint);
 }
 // Null must be rejected even when an older version could otherwise be ignored.
 await assert.rejects(applySyncPage([wire({midiMixer:null},1,id,'2000-01-01T00:00:00.000Z')],{peer,cursor:999}),/Invalid MIDI mixer/);
 assert.deepEqual((await stored()).midiMixer,mixer);assert.equal(await syncSetting('pull:'+peer),checkpoint);
});

test('malformed deferred songs cannot advance a checkpoint or enter the deferred queue',async()=>{
 setIncomingGuard(async rows=>({rows:[],deferred:rows}));
 try{
  await assert.rejects(applySyncPage([wire({midiMixer:{...mixer,masterVolume:2}},300)],{peer,cursor:300}),/Invalid MIDI mixer/);
  assert.equal(await syncSetting('pull:'+peer),2);assert.equal((await deferredSyncRows()).length,0);assert.deepEqual((await stored()).midiMixer,mixer);
 }finally{setIncomingGuard(undefined);}
});

test('normal full saves, metadata edits, remote merges and reopen retain the mixer',async()=>{
 await applySyncPage([wire({hash:fixture.hash,byteLength:source.length},301,id,undefined,'source')]);
 await finishTransfer('source',id,new Blob([source]));
 const head=await syncHead();
 await patchSongs([{id,patch:{title:'Local title',tags:['Edited locally']}}]);
 const song=await readSong(id);assert.deepEqual(song.midiMixer,mixer);
 await saveSongs([{...song,album:'Local album',bpm:130}]);
 assert.deepEqual((await readSong(id)).midiMixer,mixer);
 const local=(await syncPage(head)).rows.find(r=>r.entity==='song'&&r.entityId===id);
 assert.equal(Object.hasOwn(local.patch,'midiMixer'),false,'unrelated edits must not emit a mixer reset');
 await applySyncPage([wire({artist:'Remote artist'},302,id,'2199-01-01T00:00:00.000Z')],{peer,cursor:302});
 assert.deepEqual((await readSong(id)).midiMixer,mixer);
 await switchStorageScope('11111111-aaaa-aaaa-aaaa-111111111111');await switchStorageScope('');
 const reopened=await readSong(id);assert.deepEqual(reopened.midiMixer,mixer);assert.equal(reopened.album,'Local album');assert.equal(reopened.artist,'Remote artist');
});

test('mixer accepts inclusive bounds, an empty map and up to 256 track indices',async()=>{
 const bounds={masterVolume:0,tracks:Object.fromEntries(Array.from({length:256},(_,i)=>[String(i),{volume:i%2?1.5:0,muted:i%2===0,solo:false}]))};
 await applySyncPage([wire({midiMixer:bounds},400,id,'2299-01-01T00:00:00.000Z')],{peer,cursor:400});assert.deepEqual((await stored()).midiMixer,bounds);
 const empty={masterVolume:1,tracks:{}};await applySyncPage([wire({midiMixer:empty},401,id,'2299-01-01T00:00:01.000Z')],{peer,cursor:401});assert.deepEqual((await stored()).midiMixer,empty);
});
