// Optional private audit. The input is a copied metadata journal, never release data.
import fs from 'node:fs/promises';
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {db,storageStores,readLibraryIndex} from '../src/storage.ts';
import {applySyncPage,missingSyncBases,withSyncBaselines,done} from '../src/sync-storage.ts';
import {projectSyncRow} from '../src/sync-model.ts';
const state=JSON.parse(await fs.readFile('test-results/local-library-audit/state.json','utf8')).sort((a,b)=>a.revision-b.revision);
async function replay(repair){let after=0;for(let i=0;i<state.length;i+=100){let rows=state.slice(i,i+100).map(row=>projectSyncRow(row,after));if(repair){const needs=await missingSyncBases(rows);rows=withSyncBaselines(rows,state.filter(row=>needs.includes(row.key)).map(row=>projectSyncRow(row,0)));}await applySyncPage(rows,{peer:'offline-audit',cursor:state[Math.min(i+99,state.length-1)].revision});after=state[Math.min(i+99,state.length-1)].revision;}return readLibraryIndex();}
let legacyError;try{await replay(false);}catch(error){legacyError=error.message;}assert(legacyError,'Copied journal must reproduce the old failure');
const partial=(await readLibraryIndex()).songs.length;
const d=await db(),tx=d.transaction(storageStores,'readwrite'),p=done(tx);for(const store of storageStores)tx.objectStore(store).clear();await p;
const fixed=await replay(true);assert.equal(fixed.songs.length,49);const targets=fixed.songs.filter(s=>/44 Calib|^Alpha$|Blood Moon|^Control$/i.test(s.title));assert.equal(targets.length,4);assert(targets.every(s=>s.album&&s.artworkAssetId));
console.log(JSON.stringify({legacyError,legacySongs:partial,repairedSongs:fixed.songs.length,targets:targets.map(s=>({title:s.title,album:s.album,lastPlayedAt:s.lastPlayedAt})),originalBytesTransferred:0},null,2));
