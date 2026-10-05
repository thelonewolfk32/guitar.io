import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {fixtures} from './library-harness.mjs';
test('real V1.3 journal upgrade keeps device identity/files and removes derived timestamp patches',async()=>{
  const original=fixtures(1,4)[0],{source,sections,sectionsByTrack,annotations,noteEdits,annotationPositions,media,updatedAt,...meta}=original;
  const d=await new Promise((resolve,reject)=>{const q=indexedDB.open('guitar-io-v1',3);q.onupgradeneeded=()=>{for(const name of ['songs','assets','songSources','songIndex','artworkThumbs'])q.result.createObjectStore(name,{keyPath:'id'});q.result.createObjectStore('settings');q.result.createObjectStore('changes',{keyPath:'revision',autoIncrement:true});q.result.createObjectStore('assetRefs',{keyPath:['assetId','owner']}).createIndex('assetId','assetId');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  await new Promise((resolve,reject)=>{const tx=d.transaction(['settings','songs','songSources','songIndex','changes'],'readwrite');tx.objectStore('settings').put('stable-v13-device','deviceId');tx.objectStore('songs').put({...meta,updatedAt,sections,sectionsByTrack,annotations,noteEdits,annotationPositions,media});tx.objectStore('songSources').put({id:original.id,source:new Uint8Array(source)});tx.objectStore('songIndex').put({...meta,summaryVersion:1,progress:0,progressSplit:{new:100,learning:0,comfortable:0,mastered:0},assetIds:[]});
    tx.objectStore('changes').add({deviceId:'stable-v13-device',entity:'song',entityId:original.id,timestamp:updatedAt,operation:'upsert',fields:Object.keys(meta),patch:{...meta,updatedAt},mapPatches:{fieldUpdatedAt:{title:updatedAt},tempoEdits:{'2':145}}});
    tx.objectStore('changes').add({deviceId:'stable-v13-device',entity:'source',entityId:original.id,timestamp:updatedAt,operation:'upsert',fields:['hash','byteLength'],patch:{hash:original.hash,byteLength:source.length}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });d.close();
  const {getDeviceId,readSong,db}=await import('../src/storage.ts'),{syncPage,applySyncPage}=await import('../src/sync-storage.ts');
  assert.equal(await getDeviceId(),'stable-v13-device');assert.equal((await db()).version,4);assert.deepEqual((await readSong(original.id)).source,new Uint8Array(source));
  const page=await syncPage(),song=page.rows.find(r=>r.entity==='song');assert.equal(song.patch.updatedAt,undefined);assert.equal(song.mapPatches.fieldUpdatedAt,undefined);assert.equal(song.mapPatches.tempoEdits['2'],145);assert.equal(await applySyncPage(page.rows),0,'Upgraded wire state is valid and idempotent');
});
