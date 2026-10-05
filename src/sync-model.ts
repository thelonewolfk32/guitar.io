import type { SyncChange } from './types';

export type Stamp = { timestamp:string; deviceId:string; sequence:number; revision:number };
export type SyncRow = SyncChange & { key:string; revision:number; versions:Record<string,Stamp>; complete?:boolean };
export const syncKey = (entity:string,id:string) => `${entity}/${id}`;
const safe = (key:string) => !['__proto__','constructor','prototype'].includes(key) && key.length<=500;
export function compareStamp(a:Stamp|undefined,b:Stamp|undefined):number {
  if(!a)return b?-1:0;if(!b)return 1;
  return a.timestamp.localeCompare(b.timestamp) || a.deviceId.localeCompare(b.deviceId) || a.sequence-b.sequence;
}
export function mergeSyncRow(previous:SyncRow|undefined,incoming:SyncChange & {versions?:Record<string,Stamp>},revision:number):SyncRow|undefined {
  // V1.3 journals also contain derived song timestamps. They are rebuilt from
  // field clocks; do not send these old cache fields as independently edited data.
  if(incoming.entity==='song')incoming={...incoming,patch:Object.fromEntries(Object.entries(incoming.patch || {}).filter(([key])=>!['updatedAt','fieldUpdatedAt'].includes(key))),mapPatches:Object.fromEntries(Object.entries(incoming.mapPatches || {}).filter(([key])=>key!=='fieldUpdatedAt'))};
  const result:SyncRow=structuredClone(previous || {key:syncKey(incoming.entity,incoming.entityId),entity:incoming.entity,entityId:incoming.entityId,deviceId:incoming.deviceId,timestamp:incoming.timestamp,operation:'upsert',fields:[],patch:{},mapPatches:{},revision:0,versions:{}});
  let changed=false;
  const stamp=(key:string):Stamp=>incoming.versions?.[key] || {timestamp:incoming.timestamp,deviceId:incoming.deviceId,sequence:incoming.revision || revision,revision};
  const put=(key:string,write:()=>void)=>{const version=stamp(key);if(compareStamp(version,result.versions[key])>0){write();result.versions[key]={...version,revision};changed=true;}};
  if(incoming.operation==='delete'){if(!incoming.versions || incoming.versions.$delete)put('$delete',()=>{});}
  else {
    if(!incoming.versions || incoming.versions.$live)put('$live',()=>{});
    for(const [key,value] of Object.entries(incoming.patch || {}))if(safe(key))put(`f:${key}`,()=>{result.patch![key]=value;});
    for(const [map,values] of Object.entries(incoming.mapPatches || {}))if(safe(map))for(const [key,value] of Object.entries(values))if(safe(key))put(`m:${map}:${key}`,()=>{(result.mapPatches![map] ||= {})[key]=value;});
  }
  if(!changed)return;
  result.operation=compareStamp(result.versions.$delete,result.versions.$live)>=0?'delete':'upsert';
  const latest=Object.values(result.versions).sort(compareStamp).at(-1)!;
  result.timestamp=latest.timestamp;result.deviceId=latest.deviceId;result.revision=revision;result.fields=Object.keys(result.patch || {});
  return result;
}
/** Project just the fields changed since this peer's acknowledged revision. */
export function projectSyncRow(row:SyncRow,after:number):SyncRow {
  const versions=Object.fromEntries(Object.entries(row.versions).filter(([k,v])=>k.startsWith('$') || v.revision>after));
  const patch=Object.fromEntries(Object.entries(row.patch || {}).filter(([k])=>versions[`f:${k}`]));
  const mapPatches=Object.fromEntries(Object.entries(row.mapPatches || {}).map(([name,values])=>[name,Object.fromEntries(Object.entries(values).filter(([k])=>versions[`m:${name}:${k}`]))]).filter(([,v])=>Object.keys(v).length));
  return {...row,patch,mapPatches,fields:Object.keys(patch),versions,complete:after===0};
}
export function validateSyncRows(value:unknown):SyncRow[] {
  if(!Array.isArray(value)||value.length>200)throw new Error('Invalid change page.');
  const entities=['song','source','asset','folder','guitar','section','recording','annotation'];
  for(const row of value){
    if(!row || !entities.includes(row.entity) || typeof row.entityId!=='string' || !row.entityId || row.entityId.length>700 || row.key!==syncKey(row.entity,row.entityId) || !['upsert','delete'].includes(row.operation) || !Number.isSafeInteger(row.revision) || row.revision<1 || !row.versions || typeof row.versions!=='object')throw new Error('Invalid sync entity.');
    for(const [key,s] of Object.entries(row.versions) as [string,Stamp][]){if(!safe(key) || !s || typeof s.timestamp!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s.timestamp) || !Number.isFinite(Date.parse(s.timestamp)) || typeof s.deviceId!=='string' || s.deviceId.length>200 || !Number.isSafeInteger(s.sequence)||s.sequence<1)throw new Error('Invalid sync clock.');}
    if(row.patch && (typeof row.patch!=='object'||Array.isArray(row.patch)))throw new Error('Invalid sync patch.');
    for(const [key] of Object.entries(row.patch || {}))if(!safe(key) || !row.versions[`f:${key}`])throw new Error('Missing field clock.');
    for(const [name,values] of Object.entries(row.mapPatches || {}) as [string,Record<string,unknown>][]){if(!safe(name)||!values||typeof values!=='object'||Array.isArray(values))throw new Error('Invalid keyed change.');for(const key of Object.keys(values))if(!safe(key)||!row.versions[`m:${name}:${key}`])throw new Error('Missing map clock.');}
  }
  return value;
}
