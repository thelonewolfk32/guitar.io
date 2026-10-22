import {db,storageStores,syncNow,forgetSource} from './storage';
import {req,done,pendingSyncContent,initializeContentQueue} from './sync-storage';
import {assetIds} from './library-model';
import {mergeSyncRow,type SyncRow} from './sync-model';

export type ContentItem={key:string;kind:'source'|'asset';id:string;name:string;mime:string;byteLength:number;hash:string;available:boolean};
const validHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
export async function sha256(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function sourceBytes(value:any):Uint8Array|undefined{
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(Array.isArray(value)&&value.length&&value.every(n=>Number.isInteger(n)&&n>=0&&n<=255))return new Uint8Array(value);
}
export function contentItem(kind:'source'|'asset',record:any):ContentItem{
  const actual=kind==='source'?sourceBytes(record.source)?.byteLength:record.blob instanceof Blob?record.blob.size:0;
  return {key:`${kind}/${record.id}`,kind,id:record.id,name:record.name||record.fileName||record.id,mime:record.mime||(kind==='source'?'application/octet-stream':''),hash:record.hash||'',byteLength:Number(record.byteLength)||actual||0,available:!!actual&&(!record.byteLength||actual===record.byteLength)};
}
export async function contentManifest(after='',limit=100){
  if(typeof after!=='string'||after.length>710||!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('Invalid content manifest checkpoint.');
  const d=await db(),items:ContentItem[]=[];
  // Read a page at a time; do not clone the entire library's binary store.
  for(const [kind,store] of [['asset','assets'],['source','songSources']] as const){
    const keys=await req<IDBValidKey[]>(d.transaction(store).objectStore(store).getAllKeys());
    for(const id of keys){if(`${kind}/${id}`<=after)continue;const record=await req(d.transaction(store).objectStore(store).get(id));if(record){const item=contentItem(kind,record);if(await req(d.transaction('settings').objectStore('settings').get(`lan:invalid-content:${kind}/${id}`)))item.available=false;items.push(item);}if(items.length>limit)break;}
    if(items.length>limit)break;
  }
  const page=items.slice(0,limit);return {items:page,after:page.at(-1)?.key||after,more:items.length>limit};
}

async function songReferences(){
  const d=await db(),songs=await req<any[]>(d.transaction('songs').objectStore('songs').getAll()),guitars=await req<any[]>(d.transaction('settings').objectStore('settings').get('guitars'))||[];
  const sources=songs.filter(s=>!s.sharedLink||s.hash),art=new Set<string>(),attachments=new Set<string>();
  for(const s of songs){for(const id of assetIds(s))attachments.add(id);if(s.artworkAssetId)art.add(s.artworkAssetId);for(const id of Object.values(s.collectionArt||{}))if(typeof id==='string')art.add(id);}
  for(const g of guitars)if(g.artworkAssetId){art.add(g.artworkAssetId);attachments.add(g.artworkAssetId);}
  return {songs,sources,art,attachments};
}
/** Explicit startup/manual repair, restricted to the current account database.
 * Originals never live in a separate Electron import cache in this app. Do not
 * scan unrelated profiles or treat a generated artwork thumbnail as an original. */
export async function repairLocalContent(){
  await initializeContentQueue(true);
  const d=await db(),refs=await songReferences(),recovered:string[]=[],problems:string[]=[];
  const candidates=new Map<string,Uint8Array>();
  const sourceIds=new Set<string>([...await req<IDBValidKey[]>(d.transaction('songSources').objectStore('songSources').getAllKeys()) as string[],...refs.sources.map(s=>s.id)]);
  // Same-hash duplicates are safe recovery sources within this library only.
  for(const id of sourceIds){const record=await req(d.transaction('songSources').objectStore('songSources').get(id)),song=refs.songs.find(s=>s.id===id);let bytes=sourceBytes(record?.source)||sourceBytes(song?.source);
    if(!bytes&&typeof song?.sourceBase64==='string'){try{bytes=Uint8Array.from(atob(song.sourceBase64),c=>c.charCodeAt(0));}catch{}}
    if(bytes?.length){const hash=await sha256(bytes);if([record?.hash,song?.hash].some(expected=>validHash(expected)&&expected.toLowerCase()!==hash)){problems.push(`source/${id}: checksum mismatch; original retained for recovery`);continue;}candidates.set(hash,bytes);}
  }
  const all:(readonly [ContentItem['kind'],string])[]=[...[...sourceIds].map(id=>['source',id] as const),...[...new Set<string>([...await req<IDBValidKey[]>(d.transaction('assets').objectStore('assets').getAllKeys()) as string[],...refs.attachments])].map(id=>['asset',id] as const)];
  for(const [kind,id] of all){
    const store=kind==='source'?'songSources':'assets',old=await req(d.transaction(store).objectStore(store).get(id)),row=await req<SyncRow|undefined>(d.transaction('syncEntities').objectStore('syncEntities').get(`${kind}/${id}`));
    if(row?.operation==='delete')continue;
    const song=refs.songs.find(s=>s.id===id),meta={...row?.patch,...old,id};meta.hash ||= row?.patch?.hash;meta.byteLength ||= row?.patch?.byteLength;let bytes:Uint8Array|undefined;
    if(kind==='source'){
      meta.hash ||= song?.hash;meta.name ||= song?.fileName;
      bytes=candidates.get(String(meta.hash).toLowerCase());
      if(!bytes){const local=sourceBytes(old?.source)||sourceBytes(song?.source);if(local?.length&&!validHash(meta.hash))bytes=local;}
      if(bytes){meta.hash=await sha256(bytes);if(meta.byteLength&&meta.byteLength!==bytes.length){problems.push(`source/${id}: size mismatch; original retained for recovery`);bytes=undefined;}else{meta.source=bytes;meta.byteLength=bytes.length;}}
    }else if(meta.blob instanceof Blob&&meta.blob.size){
      const hash=await sha256(new Uint8Array(await meta.blob.arrayBuffer()));
      if(!['image/png','image/jpeg','image/webp','audio/mpeg','audio/mp3'].includes(meta.mime)||meta.byteLength&&meta.byteLength!==meta.blob.size||validHash(meta.hash)&&meta.hash.toLowerCase()!==hash){problems.push(`asset/${id}: invalid MIME, size or checksum; original retained for recovery`);const bad=d.transaction('settings','readwrite'),finished=done(bad);bad.objectStore('settings').put(true,`lan:invalid-content:asset/${id}`);bad.objectStore('settings').put({kind:'asset',id,name:meta.name||id,byteLength:Number(meta.byteLength)||0},`lan:pending-content:asset/${id}`);await finished;continue;}
      meta.byteLength=meta.blob.size;meta.hash=hash;
    }
    const available=contentItem(kind,meta).available && (kind!=='source'||!!bytes);
    const tx=d.transaction(storageStores,'readwrite'),finished=done(tx);
    const current=await req(tx.objectStore(store).get(id)),currentRow=await req<SyncRow|undefined>(tx.objectStore('syncEntities').get(`${kind}/${id}`));
    if(currentRow?.operation==='delete'||JSON.stringify({...current,source:undefined,blob:undefined})!==JSON.stringify({...old,source:undefined,blob:undefined})){await finished;continue;}
    if(available){
      tx.objectStore(store).put(meta);tx.objectStore('settings').delete(`lan:pending-content:${kind}/${id}`);tx.objectStore('settings').delete(`lan:invalid-content:${kind}/${id}`);
      if(!old||!contentItem(kind,old).available)recovered.push(`${kind}/${id}`);
      const patch=kind==='source'?{hash:meta.hash,byteLength:meta.byteLength}:{kind:meta.kind,name:meta.name,mime:meta.mime,byteLength:meta.byteLength,hash:meta.hash};
      const missing=Object.fromEntries(Object.entries(patch).filter(([key])=>!currentRow||currentRow.patch?.[key]===undefined));
      if(Object.keys(missing).length){const timestamp=await syncNow(tx),deviceId=await req<string>(tx.objectStore('settings').get('deviceId')),change={deviceId,entity:kind,entityId:id,operation:'upsert' as const,timestamp,fields:Object.keys(missing),patch:missing};const revision=Number(await req(tx.objectStore('changes').add(change))),merged=mergeSyncRow(currentRow,change,revision);if(merged)tx.objectStore('syncEntities').put(merged);tx.objectStore('settings').put(revision,'syncHead');}
    }else{
      // Keep suspect original bytes intact, but never serve them as verified.
      // Restore descriptors from this library's existing sync state as well as
      // bytes. This is not a new song reservation or a metadata checkpoint reset.
      if(kind==='source'||meta.kind&&meta.mime&&meta.name)tx.objectStore(store).put({...meta,...(current?.source?{source:current.source}:{}),...(current?.blob?{blob:current.blob}:{})});
      tx.objectStore('settings').put({kind,id,name:meta.name||id,byteLength:Number(meta.byteLength)||0},`lan:pending-content:${kind}/${id}`);
      if(kind==='source'&&old?.source){tx.objectStore('settings').put(true,`lan:invalid-content:${kind}/${id}`);forgetSource(id);}
    }
    await finished;
  }
  // Missing referenced assets without descriptors must remain visible too.
  const missingAssets:string[]=[];for(const id of refs.attachments)if(!await req(d.transaction('assets').objectStore('assets').getKey(id)))missingAssets.push(id);
  const tx=d.transaction('settings','readwrite'),finished=done(tx);
  for(const id of missingAssets)tx.objectStore('settings').put({kind:'asset',id,name:id,byteLength:0},`lan:pending-content:asset/${id}`);
  await finished;return {recovered,problems};
}
export async function auditOfflineContent(){
  const d=await db(),refs=await songReferences(),sources:ContentItem[]=[],assets:ContentItem[]=[];
  for(const [kind,store,target] of [['source','songSources',sources],['asset','assets',assets]] as const){for(const id of await req<IDBValidKey[]>(d.transaction(store).objectStore(store).getAllKeys())){const record=await req(d.transaction(store).objectStore(store).get(id));if(record){const item=contentItem(kind,record);if(await req(d.transaction('settings').objectStore('settings').get(`lan:invalid-content:${kind}/${id}`)))item.available=false;target.push(item);}}}
  const missingSources=refs.sources.filter(s=>!sources.some(item=>item.id===s.id&&item.available)).map(s=>({id:s.id,name:s.fileName||s.title,hash:s.hash}));
  const missingAssets=[...refs.attachments].filter(id=>!assets.some(item=>item.id===id&&item.available)).map(id=>({id,name:assets.find(a=>a.id===id)?.name||id}));
  const pending=await pendingSyncContent();return {songs:refs.songs.length,sourceRecords:sources.length,localSources:sources.filter(s=>s.available).length,metadataOnlySources:sources.filter(s=>!s.available).length,artworkReferences:refs.art.size,assetRecords:assets.length,localArtwork:assets.filter(a=>a.mime.startsWith('image/')&&a.available).length,metadataOnlyAssets:assets.filter(a=>!a.available).length,missingSources,missingArtwork:missingAssets.filter(a=>refs.art.has(a.id)),missingAttachments:missingAssets,pending:pending.length,complete:!missingSources.length&&!missingAssets.length&&!pending.length};
}
