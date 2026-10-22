import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';import {IDBFactory} from 'fake-indexeddb';
test('legacy extraction reads guest and matching account independently without upgrading old databases',async()=>{
 const indexedDB=new IDBFactory(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 for(const [name,title]of [['guitar-io-v1','guest'],['guitar-io-v1-account-'+a,'first'],['guitar-io-v1-account-'+b,'second']]){
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,3);q.onupgradeneeded=()=>q.result.createObjectStore('songs',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('songs','readwrite');tx.objectStore('songs').put({id:title,title});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 }
 const script=await fs.readFile('mobile/ios/GuitarIO/legacy-migrate.js','utf8');
 for(const [scope,title]of [['','guest'],[a,'first'],[b,'second']]){const messages=[],window={__guitarioLegacyScope:scope,webkit:{messageHandlers:{legacy:{postMessage:value=>{messages.push(value);queueMicrotask(()=>window.legacyAck(value.sequence));}}}}};await vm.runInNewContext(script,{window,indexedDB,crypto,Uint8Array,ArrayBuffer,Blob,btoa,console});const records=messages.filter(m=>m.type==='record');assert.equal(records.length,1);assert.equal(records[0].value.title,title);assert.equal(messages.at(-1).type,'done');}
 const databases=await indexedDB.databases();assert(databases.every(d=>d.version===3),'Migration must not upgrade or retire the old WebKit store');
});
