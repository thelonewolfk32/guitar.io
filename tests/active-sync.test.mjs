import test from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';
import {fixtures} from './library-harness.mjs';import {selectSyncRows,SONG_POLICY} from '../shared/library-policy.mjs';
import {featureAccess,canAddEntries,entitlementFor} from '../src/plans.ts';
import {saveSongs,readLibraryIndex,readSong,db,switchStorageScope,resetStorageMetrics,storageMetrics} from '../src/storage.ts';
import {applySyncPage,setIncomingGuard,deferredSyncRows,replayDeferredSync,syncSetting,req,done,setSyncSetting} from '../src/sync-storage.ts';
import {mergeSyncRow,projectSyncRow} from '../src/sync-model.ts';import {accountEntriesPage,installLibraryPolicy} from '../src/library-access.ts';
const wire=(entity,id,patch,revision=1,operation='upsert')=>projectSyncRow(mergeSyncRow(undefined,{entity,entityId:id,deviceId:'remote',timestamp:'2099-01-01T00:00:00.000Z',revision,operation,fields:Object.keys(patch),patch},revision),0);
test('testing allowance is 1000, lifts cached five-song snapshots and retains goodwill and Premium rules',()=>{
 assert.equal(SONG_POLICY.freeSongs,1000);assert.equal(featureAccess().limits.songs,1000);assert.equal(canAddEntries(999,1),true);assert.equal(canAddEntries(1000,1),false);
 const old={...entitlementFor([{id:'gift',kind:'limits',source:'owner',extraSongs:3}]),limits:{songs:8,bytes:150*1024**2,fileBytes:30*1024**2}};
 assert.equal(featureAccess(old).limits.songs,1003);assert.equal(featureAccess().limits.bytes,150*1024**2);assert.equal(featureAccess(entitlementFor([{id:'pro',kind:'premium',source:'owner'}])).limits.songs,null);
});
test('active rows and deletes proceed when a batch also contains archived or over-capacity songs',()=>{
 const row=(id,entity='song',operation='upsert')=>({entity,entityId:id,operation}),selection=selectSyncRows([row('a'),row('b'),row('c'),row('d'),row('b:0:verse','section'),row('b','song','delete')],['a','b','c'],['a'],2);
 assert.deepEqual(selection.accepted.map(r=>r.entityId),['a','b']);assert.deepEqual(selection.deferred.map(r=>r.entityId),['b','c','d','b:0:verse']);
 const fresh=selectSyncRows([row('a'),row('a','source'),row('b'),row('c')],[],[],2);assert.deepEqual(fresh.admitted,['a','b']);assert.equal(fresh.deferred.length,1);
});
test('mixed active/archived batches checkpoint atomically and replay after a selection change and restart',async()=>{
 const songs=fixtures(3,4).map((s,i)=>({...s,id:['a','b','c'][i],source:new Uint8Array(s.source),artworkAssetId:undefined}));await saveSongs(songs);
 let active=['a'];setIncomingGuard(async rows=>{const selected=selectSyncRows(rows,(await readLibraryIndex()).songs.map(s=>s.id),active,2);return {rows:selected.accepted,deferred:selected.deferred};});
 try{
  await applySyncPage([wire('song','a',{title:'Active update'}),wire('song','b',{title:'Deferred update'},2),wire('section','b:0:section-0',{...songs[1].sectionsByTrack['0'][0],songId:'b',trackIndex:0,name:'Deferred phrase'},3)],{peer:'phone',cursor:73});
  assert.equal((await readSong('a')).title,'Active update');assert.equal((await readSong('b')).title,songs[1].title);assert.equal((await deferredSyncRows()).length,2);assert.equal(await syncSetting('pull:phone'),73);
  await switchStorageScope('cccccccc-cccc-cccc-cccc-cccccccccccc');await switchStorageScope('');active=['b'];await replayDeferredSync();
  assert.equal((await readSong('b')).title,'Deferred update');assert.equal((await readSong('b')).sectionsByTrack['0'][0].name,'Deferred phrase');assert.equal((await deferredSyncRows()).length,0);assert.equal(await syncSetting('pull:phone'),73);
  await assert.rejects(applySyncPage([wire('song','b',{artist:'Must roll back'},8),wire('source','c',{hash:songs[2].hash,byteLength:-1},9)],{peer:'phone',cursor:99}));assert.equal(await syncSetting('pull:phone'),73);assert.notEqual((await readSong('b')).artist,'Must roll back');
 }finally{setIncomingGuard(undefined);}
});
test('selection catalogue is available before original downloads and does not read GP files',async()=>{
 const d=await db(),tx=d.transaction('songSources','readwrite'),finished=done(tx);for(const id of ['a','b','c'])tx.objectStore('songSources').put({id});await finished;
 resetStorageMetrics();const first=await accountEntriesPage('',2),second=await accountEntriesPage(first.after,2);assert.deepEqual(first.entries.map(e=>e.id),['a','b']);assert.equal(first.more,true);assert.equal(second.entries[0].id,'c');assert.equal(first.entries[0].active,true);assert.equal(storageMetrics.sourceReads,0);
});
test('production incoming policy accepts 50 metadata-only songs under the testing limit',async()=>{
 await switchStorageScope('dddddddd-dddd-dddd-dddd-dddddddddddd');const fixture=fixtures(1,4)[0],{source,sections,sectionsByTrack,media,annotations,updatedAt,...meta}=fixture;
 installLibraryPolicy();try{const rows=Array.from({length:50},(_,i)=>wire('song','legacy-'+i,{...meta,id:'legacy-'+i,artworkAssetId:null},i+1));assert.equal(await applySyncPage(rows,{peer:'pc',cursor:50}),50);assert.equal((await readLibraryIndex()).songs.length,50);assert.equal((await deferredSyncRows()).length,0);assert.equal((await accountEntriesPage()).entries.every(e=>e.active),true);}finally{setIncomingGuard(undefined);const {setWriteGuard}=await import('../src/storage.ts');setWriteGuard(undefined);await switchStorageScope('');}
});
test('two LAN devices cannot both consume the final local testing slot',async()=>{
 await switchStorageScope('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');const fixture=fixtures(1,4)[0],{source,sections,sectionsByTrack,media,annotations,updatedAt,...meta}=fixture;
 const row=id=>wire('song',id,{...meta,id,artworkAssetId:null});for(let i=0;i<999;i+=100)await applySyncPage(Array.from({length:Math.min(100,999-i)},(_,n)=>row('slot-'+(i+n))));
 installLibraryPolicy();try{const counts=await Promise.all([applySyncPage([row('device-a')],{peer:'a',cursor:1}),applySyncPage([row('device-b')],{peer:'b',cursor:1})]);assert.equal(counts.reduce((a,b)=>a+b,0),1);assert.equal((await readLibraryIndex()).songs.length,1000);assert.equal((await deferredSyncRows()).length,1);assert.equal(await syncSetting('pull:a'),1);assert.equal(await syncSetting('pull:b'),1);}finally{setIncomingGuard(undefined);const {setWriteGuard}=await import('../src/storage.ts');setWriteGuard(undefined);await switchStorageScope('');}
});
