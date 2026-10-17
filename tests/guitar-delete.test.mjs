import test from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';import {fixtures} from './library-harness.mjs';import {saveSongs,removeGuitar,readLibraryIndex,readSong,readChanges,getAsset,storageMetrics,resetStorageMetrics} from '../src/storage.ts';import {syncPage,syncBaselines} from '../src/sync-storage.ts';
test('guitar deletion keeps original scores, other associations and shared artwork, and publishes a tombstone',async()=>{
 const fixture=fixtures(1,4)[0],guitar={id:'delete-guitar',name:'Delete me',make:'',model:'',material:'',stringGauge:'',notes:'',kind:'guitar',strings:6,tunings:[],artworkAssetId:'shared-art'};
 await saveSongs([{...fixture,source:new Uint8Array(fixture.source),guitars:['Delete me','Other'],artworkAssetId:'shared-art',collectionArt:{'Guitars:Delete me':'shared-art','Guitars:Other':'shared-art'}}],false,[{id:'shared-art',kind:'artwork',name:'Cover',mime:'image/jpeg',blob:new Blob(['synthetic'])}],undefined,[guitar]);
 resetStorageMetrics();await removeGuitar(guitar.id,guitar.name);assert.equal(storageMetrics.sourceReads,0);assert.equal(storageMetrics.sourceWrites,0);
 const index=await readLibraryIndex();assert.equal(index.guitars.length,0);assert.deepEqual(index.songs[0].guitars,['Other']);assert(!index.songs[0].collectionArt['Guitars:Delete me']);assert.equal(index.songs[0].collectionArt['Guitars:Other'],'shared-art');assert.deepEqual((await readSong(fixture.id)).source,new Uint8Array(fixture.source));assert(await getAsset('shared-art'));
 assert((await readChanges()).some(c=>c.entity==='guitar'&&c.entityId===guitar.id&&c.operation==='delete'));
 const rows=await syncBaselines((await syncPage()).rows.map(r=>r.key));assert(rows.some(r=>r.entity==='guitar'&&r.operation==='delete'));
});
