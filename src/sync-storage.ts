import type { Song, SyncChange } from './types';
import { db, storageStores, forgetSource, syncNow } from './storage';
import { mergeSyncRow, projectSyncRow, validateSyncRows, type SyncRow } from './sync-model';
import { summarizeSong } from './song-summary';
import { assetIds } from './library-model';
import {validateBackup} from './domain.mjs';
import {validateGuitars} from './guitars';

export const req=<T>(q:IDBRequest<T>):Promise<T>=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
export const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error || new Error('Sync storage transaction failed.'));});
export async function syncSetting<T>(key:string):Promise<T|undefined>{const d=await db();return req(d.transaction('settings').objectStore('settings').get(`lan:${key}`));}
export async function setSyncSetting(key:string,value:unknown){const d=await db(),tx=d.transaction('settings','readwrite'),p=done(tx);tx.objectStore('settings').put(value,`lan:${key}`);await p;}
export async function syncHead(){const d=await db();return Number(await req(d.transaction('settings').objectStore('settings').get('syncHead'))) || 0;}
/** An indexed entity may move past a checkpoint before its base was delivered.
 * Hydrate only unknown entities; known entities keep their small field deltas. */
export async function missingSyncBases(input:unknown):Promise<string[]>{
  const rows=validateSyncRows(input),d=await db(),tx=d.transaction('syncEntities');
  const missing=await Promise.all(rows.map(async row=>row.operation==='upsert'&&row.complete!==true&&!await req(tx.objectStore('syncEntities').getKey(row.key))?row.key:undefined));
  return [...new Set(missing.filter((key):key is string=>!!key))];
}
export async function syncBaselines(keys:unknown):Promise<SyncRow[]>{
  if(!Array.isArray(keys)||keys.length>100||keys.some(key=>typeof key!=='string'||key.length>710||!key.includes('/')))throw new Error('Invalid metadata repair request.');
  const d=await db(),tx=d.transaction('syncEntities'),rows=await Promise.all(keys.map(key=>req<SyncRow|undefined>(tx.objectStore('syncEntities').get(key))));
  if(rows.some(row=>!row))throw new Error('Requested metadata is no longer available. Check for updates again.');
  return rows.map(row=>projectSyncRow(row!,0));
}
export function withSyncBaselines(input:unknown,bases:unknown):SyncRow[]{
  const rows=validateSyncRows(input),full=validateSyncRows(bases),byKey=new Map(full.map(row=>[row.key,row]));
  if(full.some(row=>row.complete!==true||!rows.some(delta=>delta.key===row.key)))throw new Error('Invalid metadata repair response.');
  return rows.map(row=>byKey.get(row.key)||row);
}
export async function syncPage(after=0,limit=100){
  if(!Number.isSafeInteger(after)||after<0)throw new Error('Invalid device checkpoint.');
  const d=await db(),tx=d.transaction(['syncEntities','settings']);
  if(!Number.isSafeInteger(limit)||limit<1)throw Error('Invalid metadata page size.');
  const [rows,head]=await Promise.all([req(tx.objectStore('syncEntities').index('revision').getAll(IDBKeyRange.lowerBound(after,true),Math.min(500,limit))),req(tx.objectStore('settings').get('syncHead'))]);
  // Keep pages under 1 MiB unless a single saved splice is larger.
  const page:SyncRow[]=[];let size=0;
  for(const row of rows){const delta=projectSyncRow(row,after),bytes=new TextEncoder().encode(JSON.stringify(delta)).byteLength;if(page.length && size+bytes>1024*1024)break;page.push(delta);size+=bytes;}
  const cursor=page.length?page.at(-1)!.revision:Number(head)||after;
  return {rows:page,cursor,head:Number(head)||0,more:cursor<(Number(head)||0)};
}
const maps=new Set(['spliceEdits','noteEdits','tempoEdits','tuningEdits','sourceTunings','tuningCompensation','tuningNoteCompensation','annotationPositions']);
const songFields=new Set(['id','sharedLink','title','artist','album','difficulty','tuning','guitars','tags','fileName','format','hash','bars','bpm','tracks','trackIndex','schemaVersion','folderId','artworkAssetId','collectionArt','artworkSource','demo','createdAt','lastOpenedAt','lastPlayedAt','lastPlayedBar','songsterr','spliceUndo']);
function assign(target:Record<string,unknown>,patch:Record<string,unknown>){for(const [key,value] of Object.entries(patch)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe sync field.');if(value===null)delete target[key];else target[key]=value;}}
function materialize(row:SyncRow){const result:Record<string,unknown>={};assign(result,row.patch || {});for(const [name,values] of Object.entries(row.mapPatches || {})){if(!maps.has(name))throw new Error('Unsupported edit map.');const map:Record<string,unknown>={};assign(map,values);result[name]=map;}return result;}
function requireMeta(row:SyncRow,data:Record<string,unknown>){
  if(row.entity==='song'){
    for(const key of Object.keys(data))if(!songFields.has(key)&&!maps.has(key))throw new Error('Unsupported song field.');
    if(typeof data.title!=='string'||typeof data.hash!=='string'||data.hash.length>128||!Array.isArray(data.tracks)||!Number.isInteger(data.bars)||Number(data.bars)<1||Number(data.bars)>20000||!Array.isArray(data.tags)||!Array.isArray(data.guitars))throw new Error('Incomplete song metadata.');
    if(Object.keys(data.noteEdits || {}).length>200000 || JSON.stringify(data.spliceEdits || {}).length>40*1024*1024)throw new Error('Song edits are too large.');
  }
  if(row.entity==='source' && (typeof data.hash!=='string'||!Number.isSafeInteger(data.byteLength)||Number(data.byteLength)>30*1024*1024||Number(data.byteLength)<1))throw new Error('Invalid original file metadata.');
  if(row.entity==='asset' && (!['audio','artwork'].includes(String(data.kind))||!['image/png','image/jpeg','image/webp','audio/mpeg','audio/mp3'].includes(String(data.mime))||typeof data.name!=='string'||!Number.isSafeInteger(data.byteLength)||Number(data.byteLength)<1||Number(data.byteLength)>250*1024*1024))throw new Error('Invalid attachment metadata.');
  if(row.entity==='folder' && (typeof data.name!=='string'||!data.name.trim()||data.name.length>1000||!/^#[0-9a-f]{6}$/i.test(String(data.color))))throw new Error('Invalid folder metadata.');
}
export type PendingContent={kind:'source'|'asset';id:string;name:string;byteLength:number};
const pendingKey=(kind:'source'|'asset',id:string)=>`lan:pending-content:${kind}/${id}`;
const pendingRange=()=>IDBKeyRange.bound('lan:pending-content:','lan:pending-content:\uffff');
function queueContent(tx:IDBTransaction,kind:'source'|'asset',id:string,record:any){
  const key=pendingKey(kind,id);
  if(!record || (kind==='source'?record.source:record.blob))tx.objectStore('settings').delete(key);
  else tx.objectStore('settings').put({kind,id,name:record.name || id,byteLength:Number(record.byteLength)||0},key);
}
/** One-time repair for existing metadata-only libraries. Routine checks read
 * the small durable queue, never scan cached originals or parse scores. */
export async function initializeContentQueue(force=false){
  const d=await db(),tx=d.transaction(['settings','songSources','assets'],'readwrite'),p=done(tx);
  if(force || await req(tx.objectStore('settings').get('lan:content-queue-ready'))!==2){
    tx.objectStore('settings').delete(pendingRange());
    for(const [store,kind] of [['songSources','source'],['assets','asset']] as const){
      const q=tx.objectStore(store).openCursor();
      q.onsuccess=()=>{const cursor=q.result;if(cursor){queueContent(tx,kind,String(cursor.key),cursor.value);cursor.continue();}};
    }
    tx.objectStore('settings').put(2,'lan:content-queue-ready');
  }
  await p;
}
export async function pendingSyncContent():Promise<PendingContent[]>{
  const d=await db();const items=await req<PendingContent[]>(d.transaction('settings').objectStore('settings').getAll(pendingRange()));return items.sort((a,b)=>Number(a.kind==='asset')-Number(b.kind==='asset')||a.id.localeCompare(b.id));
}
export async function clearPendingContent(kind:'source'|'asset',id:string){
  const d=await db(),tx=d.transaction('settings','readwrite'),p=done(tx);tx.objectStore('settings').delete(pendingKey(kind,id));await p;
}
async function discardTransfer(key:string){
  const d=await db(),tx=d.transaction(['syncTransfers','syncTransferChunks'],'readwrite'),p=done(tx);removeTransfer(tx,key);await p;
}
/** Merge, queue missing bytes and checkpoint atomically. */
let incomingGuard:((rows:SyncRow[])=>Promise<void>)|undefined;
export function setIncomingGuard(guard:typeof incomingGuard){incomingGuard=guard;}
export async function applySyncPage(input:unknown,checkpoint?:{peer:string;cursor:number}){
  if(!checkpoint?.peer.startsWith('cloud:'))await incomingGuard?.(validateSyncRows(input));
  const incoming=validateSyncRows(input),d=await db(),tx=d.transaction(storageStores,'readwrite'),p=done(tx),affected=new Set<string>();let accepted=0;
  let current:SyncRow|undefined;
  try{
    let clock=Number(await req(tx.objectStore('settings').get('syncClock'))) || 0;
    for(const change of incoming){
      current=change;
      const old=await req(tx.objectStore('syncEntities').get(change.key)),merged=mergeSyncRow(old,change,1);if(!merged)continue;
      const data=materialize(merged);if(merged.operation==='upsert')requireMeta(merged,data);
      const revision=Number(await req(tx.objectStore('changes').add({deviceId:change.deviceId,entity:change.entity,entityId:change.entityId,timestamp:change.timestamp,operation:change.operation,fields:change.fields,remote:true} as SyncChange)));
      for(const [key,v] of Object.entries(merged.versions))if(v.revision===1 && (!old || JSON.stringify(old.versions[key])!==JSON.stringify(v)))v.revision=revision;
      merged.revision=revision;tx.objectStore('syncEntities').put(merged);tx.objectStore('settings').put(revision,'syncHead');accepted++;clock=Math.max(clock,...Object.values(change.versions).map(s=>Date.parse(s.timestamp)));
      const id=change.entityId,deleted=merged.operation==='delete';
      if(change.entity==='song'){
        if(deleted){const index=await req(tx.objectStore('songIndex').get(id));for(const assetId of index?.assetIds || [])tx.objectStore('assetRefs').delete([assetId,`song:${id}`]);tx.objectStore('songs').delete(id);tx.objectStore('songIndex').delete(id);tx.objectStore('songSources').delete(id);queueContent(tx,'source',id,undefined);forgetSource(id);}else{
          const previous=await req(tx.objectStore('songs').get(id));if(previous?.hash && previous.hash!==data.hash)throw new Error('A paired device tried to replace an immutable tab.');
          const details={...data,id,updatedAt:merged.timestamp,fieldUpdatedAt:Object.fromEntries(Object.entries(merged.versions).filter(([k])=>k.startsWith('f:')).map(([k,v])=>[k.slice(2),v.timestamp])),sectionsByTrack:previous?.sectionsByTrack || {},sections:[],annotations:previous?.annotations || [],media:previous?.media || {}};
          tx.objectStore('songs').put(details);tx.objectStore('settings').put(true,'seeded');
        }affected.add(id);
      }else if(change.entity==='source'||change.entity==='asset'){
        const store=tx.objectStore(change.entity==='source'?'songSources':'assets'),previous=await req(store.get(id));
        if(deleted){store.delete(id);queueContent(tx,change.entity,id,undefined);if(change.entity==='source')forgetSource(id);else tx.objectStore('artworkThumbs').delete(id);}else{
          if(previous && previous.hash && data.hash && previous.hash!==data.hash)throw new Error('Immutable content changed.');
          const record={...data,id,...(previous?.source?{source:previous.source}:{}),...(previous?.blob?{blob:previous.blob}:{})};store.put(record);queueContent(tx,change.entity,id,record);
        }
      }else if(change.entity==='guitar'||change.entity==='folder'){
        const key=change.entity==='guitar'?'guitars':'folders',list=await req(tx.objectStore('settings').get(key)) || [],filtered=list.filter((item:{id:string})=>item.id!==id);if(!deleted)filtered.push({...data,id});if(key==='guitars')validateGuitars(filtered);tx.objectStore('settings').put(filtered,key);
        if(key==='guitars'){const before=list.find((item:{id:string})=>item.id===id);if(before?.artworkAssetId && (deleted||data.artworkAssetId!==before.artworkAssetId))tx.objectStore('assetRefs').delete([before.artworkAssetId,`guitar:${id}`]);if(!deleted&&data.artworkAssetId)tx.objectStore('assetRefs').put({assetId:data.artworkAssetId,owner:`guitar:${id}`});}
      }else {
        const parent=String(data.songId || old?.patch?.songId || id.split(':')[0]),song=await req(tx.objectStore('songs').get(parent));if(!song)continue;
        const itemId=String(data.id || old?.patch?.id || id.split(':').at(-1)),item:Record<string,unknown>={...data,id:itemId};delete item.songId;delete item.trackIndex;
        if(change.entity==='section'){const track=String(data.trackIndex ?? old?.patch?.trackIndex ?? song.trackIndex);song.sectionsByTrack ||= {};song.sectionsByTrack[track]=(song.sectionsByTrack[track] || []).filter((s:{id:string})=>s.id!==itemId);if(!deleted)song.sectionsByTrack[track].push(item);song.sectionsByTrack[track].sort((a:{start:number},b:{start:number})=>a.start-b.start);}
        if(change.entity==='annotation'){song.annotations=(song.annotations || []).filter((s:{id:string})=>s.id!==itemId);if(!deleted)song.annotations.push(item);}
        if(change.entity==='recording'){song.media={recordings:(song.media?.recordings || []).filter((s:{id:string})=>s.id!==itemId)};if(!deleted)song.media.recordings.push(item);}
        song.updatedAt=merged.timestamp>song.updatedAt?merged.timestamp:song.updatedAt;tx.objectStore('songs').put(song);affected.add(parent);
      }
    }
    // Parent metadata can arrive after a child from another peer. Reconcile only
    // that parent's known children, using a key range instead of catalogue scans.
    for(const id of affected){const song=await req(tx.objectStore('songs').get(id)),oldIndex=await req(tx.objectStore('songIndex').get(id));if(song){
      current=incoming.find(row=>row.entity==='song'&&row.entityId===id)||current;
      for(const entity of ['section','annotation','recording']){const prefix=`${entity}/${id}:`,rows=await req(tx.objectStore('syncEntities').getAll(IDBKeyRange.bound(prefix,prefix+'\uffff')));for(const row of rows){if(row.operation==='delete')continue;const data=materialize(row),item={...data};delete item.songId;delete item.trackIndex;if(entity==='section'){song.sectionsByTrack ||= {};const track=String(data.trackIndex ?? song.trackIndex),list=song.sectionsByTrack[track] ||= [];if(!list.some((s:{id:string})=>s.id===item.id))list.push(item);}if(entity==='annotation'&&!song.annotations.some((s:{id:string})=>s.id===item.id))song.annotations.push(item);if(entity==='recording'){song.media.recordings ||= [];if(!song.media.recordings.some((s:{id:string})=>s.id===item.id))song.media.recordings.push(item);}}}
      // Validate mutable details without parsing or loading the original file.
      // Lesson references can span pages, so defer only that referential check.
      const lists=Object.fromEntries(Object.entries(song.sectionsByTrack || {}).map(([key,list])=>[key,(list as Record<string,unknown>[]).map(({instructionalTimestamps:_,...section})=>section)]));
      validateBackup({app:'guitar.io',version:1,songs:[{...song,sourceBase64:'',sections:[],sectionsByTrack:lists}]});
      const index=summarizeSong({...song,source:new Uint8Array()} as Song);if(oldIndex?.originalPitches?.length && !index.originalPitches.length)index.originalPitches=oldIndex.originalPitches;
      tx.objectStore('songs').put(song);tx.objectStore('songIndex').put(index);
      const nextIds=assetIds(song);for(const assetId of oldIndex?.assetIds || [])if(!nextIds.includes(assetId))tx.objectStore('assetRefs').delete([assetId,`song:${id}`]);for(const assetId of nextIds)tx.objectStore('assetRefs').put({assetId,owner:`song:${id}`});
    }else if(oldIndex)for(const assetId of oldIndex.assetIds || [])tx.objectStore('assetRefs').delete([assetId,`song:${id}`]);}
    tx.objectStore('settings').put(clock,'syncClock');
    if(checkpoint)tx.objectStore('settings').put(checkpoint.cursor,`lan:pull:${checkpoint.peer}`);
    // The compact indexed state retains all latest fields and tombstones, so old
    // diagnostic events can be removed without invalidating an offline peer.
    const head=Number(await req(tx.objectStore('settings').get('syncHead'))) || 0;
    if(head>2000)tx.objectStore('changes').delete(IDBKeyRange.upperBound(head-2000));
  }catch(error){tx.abort();await p.catch(()=>{});const reason=error instanceof Error?error.message:String(error);throw new Error(`${current?.entity || 'page'} ${String(current?.patch?.title || current?.patch?.name || current?.entityId || '').slice(0,180)}: ${reason}`);}
  await p;return accepted;
}
export async function contentRecord(kind:'source'|'asset',id:string){const d=await db(),tx=d.transaction([kind==='source'?'songSources':'assets','settings']);const [record,invalid]=await Promise.all([req(tx.objectStore(kind==='source'?'songSources':'assets').get(id)),req(tx.objectStore('settings').get(`lan:invalid-content:${kind}/${id}`))]);return record&&invalid?{...record,source:undefined,blob:undefined}:record;}
export async function contentChunk(kind:'source'|'asset',id:string,offset:number){
  const record=await contentRecord(kind,id);if(!record || (!record.source&&!record.blob))throw new Error('[LAN-FILE-003] Content is not cached on this device. This desktop has metadata but not the original file.');
  const blob:Blob=kind==='source'?new Blob([record.source]):record.blob;
  if(!Number.isSafeInteger(offset)||offset<0||offset>blob.size)throw new Error('Invalid file offset.');
  const bytes=new Uint8Array(await blob.slice(offset,offset+512*1024).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {bytes:btoa(binary),size:blob.size,hash:record.hash || '',offset};
}
export async function transferProgress(key:string){const d=await db();return req(d.transaction('syncTransfers').objectStore('syncTransfers').get(key));}
export async function transferChunks(key:string):Promise<Uint8Array[]>{const d=await db();const rows=await req(d.transaction('syncTransferChunks').objectStore('syncTransferChunks').index('transfer').getAll(key));return rows.sort((a,b)=>a.offset-b.offset).map(r=>r.bytes);}
export async function storeTransfer(key:string,bytes:Uint8Array,offset:number,size:number){const d=await db(),tx=d.transaction(['syncTransfers','syncTransferChunks'],'readwrite'),p=done(tx);tx.objectStore('syncTransferChunks').put({transfer:key,offset,bytes});tx.objectStore('syncTransfers').put({key,offset:offset+bytes.length,size,updatedAt:Date.now()});await p;}
function removeTransfer(tx:IDBTransaction,key:string){tx.objectStore('syncTransfers').delete(key);tx.objectStore('syncTransferChunks').delete(IDBKeyRange.bound([key,0],[key,Number.MAX_SAFE_INTEGER]));}
export async function finishTransfer(kind:'source'|'asset',id:string,blob:Blob){
  const record=await contentRecord(kind,id);if(!record)throw new Error('Content was removed while downloading.');
  if(record.byteLength && blob.size!==record.byteLength){await discardTransfer(`${kind}/${id}`);throw new Error('Downloaded file size does not match.');}
  const bytes=kind==='source'||/^[a-f0-9]{64}$/i.test(record.hash)?new Uint8Array(await blob.arrayBuffer()):undefined;
  if(/^[a-f0-9]{64}$/i.test(record.hash)){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==record.hash.toLowerCase()){await discardTransfer(`${kind}/${id}`);throw new Error('Downloaded file checksum does not match.');}}
  const d=await db(),store=kind==='source'?'songSources':'assets',tx=d.transaction([store,'settings','syncTransfers','syncTransferChunks'],'readwrite'),p=done(tx);
  const current=await req(tx.objectStore(store).get(id));
  if(!current || current.hash!==record.hash){tx.abort();await p.catch(()=>{});throw new Error('Content was removed while downloading.');}
  tx.objectStore(store).put({...current,byteLength:blob.size,...(kind==='source'?{source:bytes}:{blob:blob.slice(0,blob.size,current.mime)})});tx.objectStore('settings').delete(`lan:invalid-content:${kind}/${id}`);removeTransfer(tx,`${kind}/${id}`);queueContent(tx,kind,id,undefined);forgetSource(id);await p;
}
export async function cleanTransfers(){const d=await db(),tx=d.transaction(['syncTransfers','syncTransferChunks','changes','settings'],'readwrite'),p=done(tx);const rows=await req(tx.objectStore('syncTransfers').getAll());let bytes=0;for(const row of rows.sort((a,b)=>b.updatedAt-a.updatedAt)){bytes+=row.offset;if(row.updatedAt<Date.now()-7*86400000||bytes>64*1024*1024)removeTransfer(tx,row.key);}const head=Number(await req(tx.objectStore('settings').get('syncHead'))) || 0;if(head>2000)tx.objectStore('changes').delete(IDBKeyRange.upperBound(head-2000));await p;}
