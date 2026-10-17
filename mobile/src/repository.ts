import {open,type DB,type Transaction} from '@op-engineering/op-sqlite';
import {Dirs,FileSystem} from 'react-native-file-access';
import {toByteArray} from 'base64-js';
import {mergeSyncRow,validateSyncRows,type SyncRow} from '../../src/sync-model';
import type {SyncChange} from '../../src/types';
import {mobileAccount as account} from './api';import {featureAccess,canAddEntries} from '../../src/plans';
export class NativeRepository {
 readonly sql:DB;private serial=Promise.resolve();
 constructor(readonly scope:string){if(scope&&!/^[a-f0-9-]{36}$/i.test(scope))throw Error('Invalid library scope.');this.sql=open({name:'guitario-'+(scope||'local')+'.sqlite'});this.sql.executeSync('create table if not exists kv(store text not null,key text not null,value text not null,primary key(store,key))');}
 async get<T=any>(store:string,key:string):Promise<T|undefined>{const r=await this.sql.execute('select value from kv where store=? and key=?',[store,key]);return r.rows[0]?JSON.parse(String(r.rows[0].value)):undefined;}
 async list<T=any>(store:string):Promise<T[]>{const r=await this.sql.execute('select value from kv where store=?',[store]);return r.rows.map(row=>JSON.parse(String(row.value)));}
 async put(store:string,key:string,value:unknown,tx?:Transaction){await (tx||this.sql).execute('insert into kv values(?,?,?) on conflict(store,key) do update set value=excluded.value',[store,key,JSON.stringify(value)]);}
 async remove(store:string,key:string){await this.sql.execute('delete from kv where store=? and key=?',[store,key]);}
 async setting<T=any>(key:string){return this.get<T>('settings',key);}
 async set(key:string,value:unknown){await this.put('settings',key,value);}
 async device(){let id=await this.setting<string>('deviceId');if(!id){id=crypto.randomUUID();await this.set('deviceId',id);}return id;}
 async file(kind:string,id:string){return this.get<{path:string;hash:string;size:number;name?:string;mime?:string}>('files',kind+'/'+id);}
 async putFile(kind:string,id:string,base64:string,expected?:string,name?:string,mime?:string){
  const dir=Dirs.DocumentDir+'/GuitarIO/'+(this.scope||'local');await FileSystem.mkdir(dir);const temp=dir+'/'+crypto.randomUUID()+'.part';await FileSystem.writeFile(temp,base64,'base64');const stat=await FileSystem.stat(temp),hash=await FileSystem.hash(temp,'SHA-256');
  if(stat.size>30*1024*1024||expected&&hash!==expected){await FileSystem.unlink(temp);throw Error('File size or checksum does not match.');}
  const path=dir+'/'+hash;if(await FileSystem.exists(path))await FileSystem.unlink(temp);else await FileSystem.mv(temp,path);await this.put('files',kind+'/'+id,{path,hash,size:stat.size,name,mime});return {path,hash,size:stat.size};
 }
 async adoptFile(kind:string,id:string,path:string,expected?:string,name?:string,mime?:string){
  const stat=await FileSystem.stat(path),hash=await FileSystem.hash(path,'SHA-256');if(expected&&hash!==expected)throw Error('Migration checksum mismatch.');const dir=Dirs.DocumentDir+'/GuitarIO/'+(this.scope||'local');await FileSystem.mkdir(dir);const target=dir+'/'+hash;if(!await FileSystem.exists(target))await FileSystem.cp(path,target);if((await FileSystem.stat(target)).size!==stat.size||await FileSystem.hash(target,'SHA-256')!==hash)throw Error('Migration copy verification failed.');await this.put('files',kind+'/'+id,{path:target,hash,size:stat.size,name,mime});
 }
 private exclusive<T>(task:()=>Promise<T>):Promise<T>{const result=this.serial.then(task);this.serial=result.then(()=>{},()=>{});return result;}
 async apply(input:unknown,checkpoint?:{key:string;cursor:number}){return this.exclusive(()=>this.applyRows(input,checkpoint));}
 private async applyRows(input:unknown,checkpoint?:{key:string;cursor:number}){
  const rows=validateSyncRows(input);await this.sql.transaction(async tx=>{
   const read=async(store:string,key:string)=>{const r=await tx.execute('select value from kv where store=? and key=?',[store,key]);return r.rows[0]?JSON.parse(String(r.rows[0].value)):undefined;};let revision=Number(await read('settings','syncHead'))||0;
   for(const incoming of rows){const old=await read('syncEntities',incoming.key),merged=mergeSyncRow(old,incoming,revision+1);if(!merged)continue;if(merged.operation==='upsert'&&['song','source'].includes(merged.entity)&&old?.patch?.hash&&old.patch.hash!==merged.patch?.hash)throw Error('Immutable GP content changed.');merged.revision=++revision;await this.put('syncEntities',merged.key,merged,tx);}
   await this.put('settings','syncHead',revision,tx);if(checkpoint)await this.put('settings',checkpoint.key,checkpoint.cursor,tx);
  });
 }
 async journal(changes:Omit<SyncChange,'deviceId'|'timestamp'>[]){return this.exclusive(()=>this.journalRows(changes));}
 private async journalRows(changes:Omit<SyncChange,'deviceId'|'timestamp'>[]){
  const deviceId=await this.device(),at=Math.max(Date.now(),Number(await this.setting('syncClock'))+1||0);let revision=Number(await this.setting('syncHead'))||0;const rows:SyncRow[]=[];
  for(const c of changes){const incoming={...c,deviceId,timestamp:new Date(at).toISOString()},old=await this.get<SyncRow>('syncEntities',c.entity+'/'+c.entityId),merged=mergeSyncRow(old,incoming,++revision);if(merged)rows.push({...merged,complete:true});}
  await this.applyRows(rows);await this.set('syncClock',at);
 }
 async songs(){const rows=await this.list<SyncRow>('syncEntities'),result:any[]=[];
  for(const row of rows.filter(r=>r.entity==='song'&&r.operation==='upsert')){
   const song:any={...row.patch,id:row.entityId,sectionsByTrack:{},sections:[],annotations:[],media:{recordings:[]}};for(const [name,values]of Object.entries(row.mapPatches||{}))song[name]=Object.fromEntries(Object.entries(values).filter(([,v])=>v!==null));
   for(const child of rows.filter(r=>['section','recording','annotation'].includes(r.entity)&&r.operation==='upsert'&&r.patch?.songId===song.id)){const value={...child.patch,id:child.entityId.split(':').at(-1)};if(child.entity==='section'){const track=String(child.patch!.trackIndex);(song.sectionsByTrack[track]||=[]).push(value);}else if(child.entity==='recording')song.media.recordings.push(value);else song.annotations.push(value);}
   song.sections=song.sectionsByTrack[song.trackIndex]||[];result.push(song);
  }return result;
 }
 async saveSong(song:any,assets:any[]=[],enforceAllowance=true){
  const all=await this.songs(),pending=await this.list<any>('pending'),before=all.find(s=>s.id===song.id),limit=featureAccess(account.entitlement).limits.songs;
  if(enforceAllowance&&!before&&!pending.some(e=>e.id===song.id)&&!canAddEntries(all.length+pending.length,1,account.entitlement))throw Error('Your saved-song allowance is full.');
  if(enforceAllowance&&before&&limit!==null&&all.length+pending.length>limit){const active=(await this.setting<any[]>('entries')||[]).filter(e=>e.active);if(active.length>limit||!active.some(e=>e.id===song.id))throw Error('This song is archived. Choose your active entries first.');}
  const changes:Omit<SyncChange,'deviceId'|'timestamp'>[]=[];
  const push=(entity:SyncChange['entity'],entityId:string,patch:Record<string,unknown>)=>changes.push({entity,entityId,operation:'upsert',fields:Object.keys(patch),patch});
  const maps=['spliceEdits','noteEdits','tempoEdits','tuningEdits','sourceTunings','tuningCompensation','tuningNoteCompensation','annotationPositions'];
  const excluded=['source','sections','sectionsByTrack','annotations','media','fieldUpdatedAt','updatedAt',...maps],patch=Object.fromEntries(Object.entries(song).filter(([key])=>!excluded.includes(key))),oldPatch=Object.fromEntries(Object.entries(before||{}).filter(([key])=>!excluded.includes(key)));
  const changed=Object.fromEntries([...new Set([...Object.keys(oldPatch),...Object.keys(patch)])].filter(k=>JSON.stringify(oldPatch[k])!==JSON.stringify(patch[k])).map(k=>[k,patch[k]??null]));
  const mapPatches:Record<string,Record<string,unknown>>={};for(const key of maps){const old=before?.[key]||{},next=song[key]||{},keys=[...new Set([...Object.keys(old),...Object.keys(next)])].filter(k=>JSON.stringify(old[k])!==JSON.stringify(next[k]));if(keys.length)mapPatches[key]=Object.fromEntries(keys.map(k=>[k,next[k]??null]));}
  if(Object.keys(changed).length||Object.keys(mapPatches).length)changes.push({entity:'song',entityId:song.id,operation:'upsert',fields:Object.keys(changed),patch:changed,mapPatches});
  const lists=(entity:'section'|'recording'|'annotation',old:any[],next:any[],track?:string)=>{for(const item of next){const id=song.id+':'+(track===undefined?'':track+':')+item.id;if(JSON.stringify(old.find(o=>o.id===item.id))!==JSON.stringify(item))push(entity,id,{...item,songId:song.id,...(track===undefined?{}:{trackIndex:Number(track)})});}for(const item of old)if(!next.some(n=>n.id===item.id))changes.push({entity,entityId:song.id+':'+(track===undefined?'':track+':')+item.id,operation:'delete',fields:[]});};
  for(const key of new Set([...Object.keys(before?.sectionsByTrack||{}),...Object.keys(song.sectionsByTrack||{})]))lists('section',before?.sectionsByTrack?.[key]||[],song.sectionsByTrack?.[key]||[],key);
  lists('recording',before?.media?.recordings||[],song.media?.recordings||[]);lists('annotation',before?.annotations||[],song.annotations||[]);
  const original=await this.file('source',song.id);if(!original)throw Error('The original GP file is missing.');if(!before)push('source',song.id,{hash:original.hash,byteLength:original.size});
  for(const asset of assets){const f=await this.putFile('asset',asset.id,asset.base64,undefined,asset.name,asset.mime);push('asset',asset.id,{id:asset.id,kind:asset.kind,name:asset.name,mime:asset.mime,byteLength:f.size});}
  await this.journal(changes);await this.remove('pending',song.id);
 }
 async deleteSong(id:string){await this.journal([{entity:'song',entityId:id,operation:'delete',fields:[]},{entity:'source',entityId:id,operation:'delete',fields:[]}]);}
}
