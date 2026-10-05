import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as alphaTab from '@coderline/alphatab';
import {makeSong} from '../src/notation.ts';
import {migrateSong,withSections,sectionsFor} from '../src/library-model.ts';
import {encodeBackup,decodeBackup} from '../src/backups.ts';
import {recentSongs} from '../src/RecentStories.tsx';
globalThis.window={alphaTab};
const original=new TextEncoder().encode('\\title "Migration study" \\artist "Original fixture" . 0.6.1 | 2.5.1 | 4.4.1 | 5.3.1');
const legacy=migrateSong(await makeSong(original,'migration.alphatex'));
legacy.sections=[{id:'intro',name:'Intro',start:1,end:2,color:'#8b79ff',status:'learning',learnedPercent:30,notes:''},{id:'verse',name:'Verse',start:3,end:4,color:'#24b8a8',status:'new',notes:''}];
legacy.sectionsByTrack={'0':legacy.sections};
const old=await new Promise((resolve,reject)=>{const q=indexedDB.open('guitar-io-v1',2);q.onupgradeneeded=()=>{q.result.createObjectStore('songs',{keyPath:'id'});q.result.createObjectStore('assets',{keyPath:'id'});q.result.createObjectStore('settings');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
await new Promise((resolve,reject)=>{const tx=old.transaction('songs','readwrite');tx.objectStore('songs').put(legacy);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});old.close();
const storage=await import('../src/storage.ts');

test('v2 upgrade splits bytes atomically and later startup reads only the index',async()=>{
  storage.resetStorageMetrics();const index=await storage.readLibraryIndex();assert.equal(index.songs.length,1);assert.equal(index.songs[0].summaryVersion,1);
  for(const field of ['source','sections','sectionsByTrack','noteEdits','annotations','media'])assert.equal(field in index.songs[0],false,field);
  assert.equal(index.songs[0].progress,15);assert.equal(storage.storageMetrics.detailReads,0);assert.equal(storage.storageMetrics.sourceReads,0);
  const song=await storage.readSong(legacy.id);assert.deepEqual(song.source,original);assert.equal(sectionsFor(song)[0].learnedPercent,30);
  storage.resetStorageMetrics();await storage.readLibraryIndex();assert.equal(storage.storageMetrics.sourceReads,0);assert.equal(storage.storageMetrics.detailReads,0);
});
test('notation saves record one changed section and never rewrite sources or other songs',async()=>{
  const other={...legacy,id:'other',hash:'other-hash'};await storage.saveSongs([other]);
  const changes=await storage.readChanges(0,1000),revision=changes.at(-1).revision;
  const song=await storage.readSong(legacy.id),sections=sectionsFor(song);storage.resetStorageMetrics();
  await storage.saveSongs([withSections(song,[{...sections[0],speed:.5,learnedPercent:70},sections[1]])]);
  assert.equal(storage.storageMetrics.sourceWrites,0);assert.equal(storage.storageMetrics.songWrites,1);assert.equal(storage.storageMetrics.sourceReads,0);
  const delta=await storage.readChanges(revision);assert.equal(delta.filter(c=>c.entity==='section').length,1);assert(delta.every(c=>c.entityId.startsWith(legacy.id)));assert(!delta.some(c=>c.entity==='source'));
  const full=await storage.readSong(legacy.id);assert.equal(sectionsFor(full)[0].speed,.5);assert(full.fieldUpdatedAt.sectionsByTrack);assert(sectionsFor(full)[0].updatedAt);assert(!JSON.stringify(delta).includes('sourceBase64'));
});
test('one fret change produces a map patch for just that note; a no-op emits nothing',async()=>{
  const song=await storage.readSong(legacy.id);const before=(await storage.readChanges(0,1000)).at(-1).revision;
  await storage.saveSongs([{...song,noteEdits:{'0:0:0:0:0:0':{fret:4,string:6}}}]);
  const delta=await storage.readChanges(before),change=delta.find(c=>c.entity==='song');assert.deepEqual(Object.keys(change.mapPatches.noteEdits),['0:0:0:0:0:0']);
  const revision=delta.at(-1).revision;await storage.saveSongs([await storage.readSong(legacy.id)]);assert.deepEqual(await storage.readChanges(revision),[]);
});
test('activity patches fetch no original file and survive a stale dialog save',async()=>{
  const stale=await storage.readSong(legacy.id);storage.resetStorageMetrics();
  const time=new Date().toISOString();await storage.patchSongs([{id:legacy.id,patch:{lastOpenedAt:time,lastPlayedAt:time,lastPlayedBar:3}}]);
  assert.equal(storage.storageMetrics.sourceReads,0);assert.equal(storage.storageMetrics.sourceWrites,0);assert.equal(storage.storageMetrics.detailReads,0);
  await storage.saveSongs([{...stale,title:'Renamed study'}]);const song=await storage.readSong(legacy.id);assert.equal(song.lastPlayedAt,time);assert.equal(song.lastPlayedBar,3);
});
test('shared artwork is retained until its final owner is removed and deletions are journalled',async()=>{
  const a=await storage.readSong(legacy.id),b=await storage.readSong('other'),asset={id:'shared-cover',kind:'artwork',name:'cover.png',mime:'image/png',blob:new Blob(['fixture'])};
  await storage.saveSongs([{...a,artworkAssetId:asset.id},{...b,artworkAssetId:asset.id}],false,[asset]);
  await storage.patchSongs([{id:a.id,patch:{artworkAssetId:undefined}}]);assert(await storage.getAsset(asset.id));
  const revision=(await storage.readChanges(0,1000)).at(-1).revision;await storage.removeSong(b.id);assert.equal(await storage.getAsset(asset.id),undefined);
  const changes=await storage.readChanges(revision);assert(changes.some(c=>c.entity==='song' && c.operation==='delete'));assert(changes.some(c=>c.entity==='asset' && c.operation==='delete'));assert.equal(await storage.getDeviceId(),changes[0].deviceId);
});
test('transferring artwork to a new guitar within one save retains the immutable asset',async()=>{
  const song=await storage.readSong(legacy.id),asset={id:'transfer-cover',kind:'artwork',name:'transfer.png',mime:'image/png',blob:new Blob(['fixture'])};
  await storage.saveSongs([{...song,artworkAssetId:asset.id}],false,[asset]);
  const guitar={id:'new-owner',name:'New owner',make:'',model:'',material:'',stringGauge:'',notes:'',kind:'guitar',strings:6,tunings:[],artworkAssetId:asset.id};
  await storage.saveSongs([{...await storage.readSong(song.id),artworkAssetId:undefined}],false,[],undefined,[guitar]);assert(await storage.getAsset(asset.id));
  await storage.saveSongs([],false,[],undefined,[]);assert.equal(await storage.getAsset(asset.id),undefined);
});
test('recent stories select up to ten actually played songs in timestamp order without changing the input',()=>{
  const songs=Array.from({length:8},(_,i)=>({id:String(i),lastPlayedAt:i===7?undefined:new Date(2026,9,3,0,i).toISOString()}));const before=[...songs];
  assert.deepEqual(recentSongs(songs).map(s=>s.id),['6','5','4','3','2','1','0']);assert.deepEqual(songs,before);assert.deepEqual(recentSongs([{id:'opened',lastOpenedAt:new Date().toISOString()}]),[]);
});
test('backups retain section speed, playback history and calibrated timing, rejecting invalid data',async()=>{
  const song=await storage.readSong(legacy.id);song.media={recordings:[{id:'video',kind:'youtube',videoId:'dQw4w9WgXcQ',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',offsetSeconds:10,label:'Full song',tags:[],syncAnchors:[{scoreSeconds:0,mediaSeconds:10},{scoreSeconds:20,mediaSeconds:34}]}]};
  const backup=await encodeBackup([song],[],false);const decoded=await decodeBackup(backup);assert.equal(sectionsFor(decoded.songs[0])[0].speed,.5);assert.equal(decoded.songs[0].lastPlayedBar,3);assert.equal(decoded.songs[0].media.recordings[0].syncAnchors[1].mediaSeconds,34);
  const bad=structuredClone(backup);bad.songs[0].sectionsByTrack['0'][0].speed=0;await assert.rejects(()=>decodeBackup(bad),/speed/);
});

test('older progress summaries enrich once without reading source files or adding sync changes',async()=>{
  const connection=await new Promise((resolve,reject)=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const index=await storage.readSongSummary(legacy.id),before=(await storage.readChanges(0,1000)).at(-1).revision;
  delete index.progressSplit;
  await new Promise((resolve,reject)=>{const tx=connection.transaction('songIndex','readwrite');tx.objectStore('songIndex').put(index);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});connection.close();
  storage.resetStorageMetrics();const enriched=(await storage.readLibraryIndex()).songs.find(s=>s.id===legacy.id);
  assert.deepEqual(enriched.progressSplit,{new:50,learning:50,comfortable:0,mastered:0});assert.equal(storage.storageMetrics.sourceReads,0);assert.equal(storage.storageMetrics.sourceWrites,0);assert.equal(storage.storageMetrics.songWrites,0);assert.equal(storage.storageMetrics.indexWrites,1);assert.deepEqual(await storage.readChanges(before),[]);
  storage.resetStorageMetrics();await storage.readLibraryIndex();assert.equal(storage.storageMetrics.indexWrites,0);assert.equal(storage.storageMetrics.sourceReads,0);assert.equal(storage.storageMetrics.detailReads,0);
});

test('one section change refreshes cached colours and mastery with only the affected save',async()=>{
  const song=await storage.readSong(legacy.id);storage.resetStorageMetrics();
  await storage.saveSongs([withSections(song,[{...sectionsFor(song)[0],start:1,end:song.bars,status:'mastered',learnedPercent:100}])]);
  const index=await storage.readSongSummary(song.id);assert.deepEqual(index.progressSplit,{new:0,learning:0,comfortable:0,mastered:100});assert.equal(index.progressState,'mastered');assert.equal(storage.storageMetrics.songWrites,1);assert.equal(storage.storageMetrics.sourceReads,0);assert.equal(storage.storageMetrics.sourceWrites,0);
});
