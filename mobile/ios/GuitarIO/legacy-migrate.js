(async()=>{
 const pending=new Map();let sequence=0,records=0,totalBytes=0;
 window.legacyAck=(id,error)=>{const p=pending.get(id);if(p){pending.delete(id);error?p.reject(Error(error)):p.resolve();}};
 const native=message=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});window.webkit.messageHandlers.legacy.postMessage({...message,sequence:id});});
 const bytes64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
 async function file(value){const id=crypto.randomUUID(),size=value instanceof Blob?value.size:value.byteLength;await native({type:'file-start',id});for(let offset=0;offset<size;offset+=65536){const bytes=value instanceof Blob?new Uint8Array(await value.slice(offset,offset+65536).arrayBuffer()):value.subarray(offset,offset+65536);await native({type:'file-chunk',id,data:bytes64(bytes)});}await native({type:'file-end',id,size});totalBytes+=size;return {__nativeFile:id,size,mime:value.type||''};}
 async function encode(value){if(value instanceof Uint8Array)return file(value);if(value instanceof ArrayBuffer)return file(new Uint8Array(value));if(value instanceof Blob)return file(value);if(Array.isArray(value))return Promise.all(value.map(encode));if(value&&typeof value==='object'){const result={};for(const [key,item]of Object.entries(value))result[key]=await encode(item);return result;}return value;}
 const q=indexedDB.open('guitar-io-v1',4);q.onupgradeneeded=()=>q.transaction.abort();
 const database=await new Promise(resolve=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(null);});
 if(database){for(const store of database.objectStoreNames){const keys=await new Promise((resolve,reject)=>{const r=database.transaction(store).objectStore(store).getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});for(const key of keys){const value=await new Promise((resolve,reject)=>{const r=database.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await native({type:'record',store,key,value:await encode(value)});records++;}}database.close();}
 await native({type:'done',records,totalBytes});
})().catch(error=>window.webkit.messageHandlers.legacy.postMessage({type:'error',message:String(error)}));
