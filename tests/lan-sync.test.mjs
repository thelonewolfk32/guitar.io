import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {fixtures} from './library-harness.mjs';
import {mergeSyncRow,projectSyncRow,validateSyncRows} from '../src/sync-model.ts';
import {saveSongs,patchSongs,readSong,readLibraryIndex,removeSong,db,resetStorageMetrics,storageMetrics} from '../src/storage.ts';
import {syncPage,syncHead,applySyncPage,syncSetting,contentRecord,storeTransfer,transferProgress,transferChunks,finishTransfer,req,done,cleanTransfers,missingSyncBases,syncBaselines,withSyncBaselines} from '../src/sync-storage.ts';
import {newSecret,seal,open,pairingCode,parsePairing,localEndpoint} from '../shared/lan-crypto.mjs';
const when='2026-10-05T08:00:00.000Z';
const change=(patch,sequence=1,entity='song',id='test',timestamp=when,deviceId='remote')=>({entity,entityId:id,deviceId,timestamp,operation:'upsert',fields:Object.keys(patch),patch,revision:sequence});
const wire=(c)=>projectSyncRow(mergeSyncRow(undefined,c,c.revision),0);

test('per-field clocks converge for offline edits and deterministic concurrent ties',()=>{
  const first=mergeSyncRow(undefined,change({title:'Original',artist:'Band'},1,'song','test','2026-10-05T07:00:00.000Z'),1);
  const a=mergeSyncRow(first,change({title:'PC'},2,'song','test',when,'PC'),2);
  const b=mergeSyncRow(a,wire(change({artist:'Mac'},3,'song','test',when,'Mac')),3);
  assert.equal(b.patch.title,'PC');assert.equal(b.patch.artist,'Mac');
  const z=wire(change({title:'Z'},3,'song','test',when,'Z')),aa=wire(change({title:'A'},3,'song','test',when,'A'));
  assert.equal(mergeSyncRow(mergeSyncRow(first,aa,2),z,3).patch.title,'Z');assert.equal(mergeSyncRow(mergeSyncRow(first,z,2),aa,3),undefined,'same-field tie picks the same winner in either arrival order');
  const newer=mergeSyncRow(b,wire(change({artist:'Mac'},4,'song','test','2026-10-05T09:00:00.000Z','Mac')),4);
  assert.equal(newer.patch.title,'PC');assert.equal(newer.patch.artist,'Mac');assert.equal(mergeSyncRow(newer,wire(change({artist:'Mac'},4,'song','test','2026-10-05T09:00:00.000Z','Mac')),5),undefined);
});
test('delta projection sends only changed keys, including keyed deletions and tombstones',()=>{
  const a=mergeSyncRow(undefined,change({title:'Title',artist:'Band'}),1);
  const b=mergeSyncRow(a,{...change({},2),mapPatches:{noteEdits:{'0:1':{fret:3,string:1}}}},2),page=projectSyncRow(b,1);
  assert.deepEqual(page.patch,{});assert.deepEqual(Object.keys(page.mapPatches.noteEdits),['0:1']);
  const c=mergeSyncRow(b,{...change({},3),mapPatches:{noteEdits:{'0:1':null}}},3);assert.equal(projectSyncRow(c,2).mapPatches.noteEdits['0:1'],null);
  const gone=mergeSyncRow(c,{...change({},4),operation:'delete'},4);assert.equal(gone.operation,'delete');assert.equal(mergeSyncRow(gone,wire(change({title:'Old'},1)),5),undefined);validateSyncRows([projectSyncRow(gone,3)]);
});
test('LAN payload encryption authenticates both pairing and message content',async()=>{
  const secret=newSecret(),value={privateTitle:'Synthetic song',fields:['progress']},message=await seal(secret,value);
  assert.deepEqual(await open(secret,message),value);assert(!JSON.stringify(message).includes('Synthetic song'));
  await assert.rejects(open(newSecret(),message));const corrupt={...message,body:message.body.slice(0,-4)+'AAAA'};await assert.rejects(open(secret,corrupt));
  const code=pairingCode({v:1,id:'device',name:'PC',secret,endpoints:['http://192.168.1.5:2345/sync']});assert.equal(parsePairing(code).secret,secret);
  for(const url of ['http://example.com:80/sync','https://192.168.1.1:80/sync','http://8.8.8.8:80/sync','http://user:pass@10.1.2.3:80/sync'])assert.throws(()=>localEndpoint(url));
});
test('indexed catalogue bootstrap is metadata-only and an edit never resends original files',async()=>{
  const songs=fixtures(3,4).map(s=>({...s,source:new Uint8Array(s.source),artworkAssetId:undefined}));await saveSongs(songs,true);
  const initial=await syncPage();assert(initial.rows.some(r=>r.entity==='source'));assert(!JSON.stringify(initial).includes('source":['));const cursor=initial.head;
  resetStorageMetrics();await patchSongs([{id:songs[0].id,patch:{title:'Changed title'}}]);const next=await syncPage(cursor);
  assert.equal(next.rows.length,1);assert.equal(next.rows[0].entity,'song');assert.deepEqual(Object.keys(next.rows[0].patch),['title']);assert.equal(storageMetrics.sourceReads,0);assert.equal(storageMetrics.sourceWrites,0);
  const unchanged=await syncPage(next.head);assert.equal(unchanged.rows.length,0);assert.equal(unchanged.cursor,next.head);
});
test('remote patches apply atomically once, preserve independent fields and do not rewrite tab bytes',async()=>{
  const id='fixture-000',timestamp='2090-01-01T00:00:00.000Z',incoming=wire(change({artist:'Other device'},17,'song',id,timestamp));
  const before=await syncHead();resetStorageMetrics();assert.equal(await applySyncPage([incoming],{peer:'other',cursor:17}),1);assert.equal(await syncSetting('pull:other'),17);
  const song=await readSong(id);assert.equal(song.artist,'Other device');assert.equal(song.title,'Changed title');assert.equal(storageMetrics.sourceWrites,0);
  const head=await syncHead();assert(head>before);assert.equal(await applySyncPage([incoming]),0);assert.equal(await syncHead(),head);
  await patchSongs([{id,patch:{title:'Local after remote'}}]);assert((await syncPage(head)).rows[0].timestamp>timestamp,'logical clock observes the remote clock');
});
test('remote section deletion and a whole-track removal persist without resurrecting items',async()=>{
  const id='fixture-001',song=await readSong(id),section=song.sectionsByTrack['0'][0],key=`${id}:0:${section.id}`,timestamp='2091-01-01T00:00:00.000Z';
  const edit=wire(change({...section,songId:id,trackIndex:0,name:'Remote section',status:'mastered',learnedPercent:100},1,'section',key,timestamp));await applySyncPage([edit]);assert.equal((await readSong(id)).sectionsByTrack['0'][0].name,'Remote section');
  const gone=wire({...change({},2,'section',key,'2091-01-01T00:00:01.000Z'),operation:'delete'});await applySyncPage([gone]);assert(!(await readSong(id)).sectionsByTrack['0'].some(s=>s.id===section.id));await applySyncPage([edit]);assert(!(await readSong(id)).sectionsByTrack['0'].some(s=>s.id===section.id));
});
test('new remote songs have lazy source placeholders and cached files resume by chunks',async()=>{
  const original=fixtures(1,4)[0],id='remote-song',source=new Uint8Array(original.source),timestamp='2092-01-01T00:00:00.000Z';
  const {source:_source,sections,sectionsByTrack,media,annotations,noteEdits,annotationPositions,updatedAt,...meta}=original;
  const rows=[wire(change({hash:original.hash,byteLength:source.length},1,'source',id,timestamp)),wire(change({...meta,id,artworkAssetId:null},2,'song',id,timestamp))];
  await applySyncPage(rows);assert((await readLibraryIndex()).songs.some(s=>s.id===id));assert.equal((await contentRecord('source',id)).source,undefined);
  await storeTransfer('source/'+id,source.subarray(0,100),0,source.length);assert.equal((await transferProgress('source/'+id)).offset,100);assert.equal((await transferChunks('source/'+id))[0].length,100);
  await assert.rejects(finishTransfer('source',id,new Blob([source.subarray(0,20)])),/checksum/);await finishTransfer('source',id,new Blob([source]));assert.equal(await transferProgress('source/'+id),undefined);assert.deepEqual((await readSong(id)).source,source);
});
test('invalid incoming pages cannot advance checkpoints or partially write state',async()=>{
  const head=await syncHead(),valid=wire(change({title:'Must roll back'},30,'song','fixture-002','2093-01-01T00:00:00.000Z')),bad=wire(change({source:[1,2,3]},31,'song','fixture-002','2093-01-01T00:00:01.000Z'));
  await assert.rejects(applySyncPage([valid,bad],{peer:'invalid',cursor:31}));assert.equal(await syncHead(),head);assert.equal(await syncSetting('pull:invalid'),undefined);assert.notEqual((await readSong('fixture-002')).title,'Must roll back');
});
test('journal compaction keeps current delta state and deletion tombstones for offline peers',async()=>{
  const id='fixture-002';await removeSong(id);await cleanTransfers();const page=await syncPage(0);assert.equal(page.rows.find(r=>r.entity==='song'&&r.entityId===id).operation,'delete');
  const d=await db(),tx=d.transaction('changes','readwrite'),p=done(tx);tx.objectStore('changes').clear();await p;assert((await syncPage(0)).rows.length>0);assert.equal((await syncPage(page.head)).rows.length,0);
});
test('300-song delta query touches no originals and returns just the edited field',async()=>{
  const songs=fixtures(300,8).map((s,i)=>({...s,id:'scale-'+i,source:new Uint8Array(s.source),artworkAssetId:undefined}));await saveSongs(songs,true);
  const head=await syncHead();resetStorageMetrics();const start=performance.now();await patchSongs([{id:'scale-250',patch:{title:'Only this field changes'}}]);const delta=await syncPage(head),elapsed=performance.now()-start;
  assert.equal(delta.rows.length,1);assert.deepEqual(delta.rows[0].patch,{title:'Only this field changes'});assert.equal(storageMetrics.sourceReads,0);assert.equal(storageMetrics.sourceWrites,0);
  const d=await db(),count=await req(d.transaction('changes').objectStore('changes').count());assert(count<=2101,'Local journal compacts while current entity state stays complete');
  console.log(JSON.stringify({songs:300,changedRows:delta.rows.length,deltaJSONBytes:JSON.stringify(delta).length,sourceReads:0,sourceWrites:0,elapsedMs:Math.round(elapsed*100)/100,diagnosticEvents:count}));
});
test('an unseen song edited past a checkpoint recovers its base, album, edits and playback history',async()=>{
 const original=fixtures(1,4)[0],id='late-base',source=new Uint8Array(original.source);
 const {source:_source,sections,sectionsByTrack,media,annotations,noteEdits,annotationPositions,updatedAt,...meta}=original;
 const base=mergeSyncRow(undefined,change({...meta,id,artworkAssetId:'unavailable-cover',album:'Saved album'},1,'song',id,'2095-01-01T00:00:00.000Z'),1);
 const full=mergeSyncRow(base,{...change({lastPlayedAt:'2095-01-01T00:03:00.000Z',lastPlayedBar:3},300,'song',id,'2095-01-01T00:03:00.000Z'),mapPatches:{noteEdits:{'0:0:0:0:0:0':{fret:3,string:1}}}},300);
 const delta=projectSyncRow(full,200);assert.deepEqual(Object.keys(delta.patch),['lastPlayedAt','lastPlayedBar']);assert.deepEqual(await missingSyncBases([delta]),[full.key]);
 await assert.rejects(applySyncPage([delta],{peer:'late',cursor:300}),/Incomplete song metadata/);assert.equal(await syncSetting('pull:late'),undefined);
 await applySyncPage(withSyncBaselines([delta],[projectSyncRow(full,0)]),{peer:'late',cursor:300});
 const index=(await readLibraryIndex()).songs.find(s=>s.id===id);assert.equal(index.album,'Saved album');assert.equal(index.lastPlayedBar,3);assert.equal(index.artworkAssetId,'unavailable-cover');assert.equal(await syncSetting('pull:late'),300);assert.deepEqual(await missingSyncBases([delta]),[]);
 const recovered=(await syncBaselines([full.key]))[0];assert.equal(recovered.patch.hash,original.hash);assert.equal(recovered.mapPatches.noteEdits['0:0:0:0:0:0'].fret,3);assert(!('source' in recovered.patch));
 await applySyncPage([wire(change({hash:original.hash,byteLength:source.length},301,'source',id,'2095-01-01T00:04:00.000Z'))]);assert.equal((await contentRecord('source',id)).source,undefined);
});
