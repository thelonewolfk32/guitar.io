import {Dirs,FileSystem} from 'react-native-file-access';
import {NativeRepository} from './repository';
import {validateBackup} from '../../src/domain.mjs';
import {validateSyncRows} from '../../src/sync-model';
import type {ScoreRequest} from '../../shared/score-bridge';
import {canAddEntries} from '../../src/plans';
import {mobileAccount as account} from './api';
const chunk=192*1024;
const stores=new Set(['syncEntities','pending','practice','drafts']);
const settings=new Set(['deviceId','syncHead','syncClock','legacy-migrated-v1','section-colours']);
const line=(value:unknown)=>JSON.stringify(value).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n';
export function checkReferences(records:any[],files:any[]){
 const rows=validateSyncRows(records.filter(r=>r.store==='syncEntities').map(r=>r.value)),needed=new Set<string>();
 const songs=new Set(rows.filter(r=>r.entity==='song'&&r.operation==='upsert').map(r=>r.entityId));
 for(const row of rows.filter(r=>r.operation==='upsert')){
  if(row.entity==='recording'&&!songs.has(String(row.patch?.songId||row.entityId.split(':')[0])))continue;
  if(row.entity==='song')needed.add('source/'+row.entityId);
  const p=row.patch||{};for(const id of [p.artworkAssetId,...Object.values(p.collectionArt||{}),p.assetId])if(typeof id==='string'&&id)needed.add('asset/'+id);
 }
 for(const record of records.filter(r=>r.store==='drafts'))needed.add('draft/'+record.key);
 for(const key of needed){const file=files.find(f=>f.key===key);if(!file)throw Error('Download all originals and attachments before a full backup: '+key);const row=rows.find(r=>r.key===key);if(row?.patch?.hash&&row.patch.hash!==file.hash||row?.patch?.byteLength&&row.patch.byteLength!==file.size)throw Error('Backup file does not match library metadata.');}
}
async function* lines(path:string){let offset=0,buffer='';const {size}=await FileSystem.stat(path);while(offset<size){const value=await FileSystem.readFileChunk(path,offset,chunk,'utf8');offset+=value.length;buffer+=value;if(buffer.length>8*1024*1024)throw Error('Backup record is too large.');let end;while((end=buffer.indexOf('\n'))>=0){yield JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);}}if(buffer)throw Error('Backup was interrupted before completion.');}
/** Stream originals in bounded chunks; verify bytes before offering the export. */
export async function exportLibrary(repo:NativeRepository){
 const path=Dirs.CacheDir+'/'+crypto.randomUUID()+'.guitariobak',rows=(await repo.sql.execute('select store,key,value from kv order by store,key')).rows;
 checkReferences(rows.map(r=>({store:r.store,key:r.key,value:JSON.parse(String(r.value))})),rows.filter(r=>r.store==='files').map(r=>({key:String(r.key),...JSON.parse(String(r.value))})));
 await FileSystem.writeFile(path,line({format:'guitario-native',version:1,scope:repo.scope,at:new Date().toISOString()}));let records=0,bytes=0,files=0;
 for(const row of rows){const store=String(row.store),key=String(row.key);if(stores.has(store)||store==='settings'&&settings.has(key)){await FileSystem.appendFile(path,line({type:'record',store,key,value:JSON.parse(String(row.value))}));records++;}}
 for(const row of rows.filter(r=>r.store==='files')){const file=JSON.parse(String(row.value)),key=String(row.key),stat=await FileSystem.stat(file.path);if(stat.size!==file.size||await FileSystem.hash(file.path,'SHA-256')!==file.hash)throw Error('A source file failed backup verification: '+key);
  await FileSystem.appendFile(path,line({type:'file',key,hash:file.hash,size:file.size,name:file.name,mime:file.mime}));
  for(let offset=0;offset<stat.size;offset+=chunk)await FileSystem.appendFile(path,line({type:'chunk',data:await FileSystem.readFileChunk(file.path,offset,Math.min(chunk,stat.size-offset),'base64')}));
  await FileSystem.appendFile(path,line({type:'file-end'}));bytes+=stat.size;files++;
 }
 await FileSystem.appendFile(path,line({type:'end',records,files,bytes}));const verified=await inspectBackup(path);await FileSystem.unlink(verified.stage);return path;
}
async function inspectBackup(path:string){
 const stage=Dirs.CacheDir+'/restore-'+crypto.randomUUID();await FileSystem.mkdir(stage);let header:any,end:any,current:any,records:any[]=[],files:any[]=[],total=0;
 try{for await(const value of lines(path)){
  if(!header){if(value.format!=='guitario-native'||value.version!==1||typeof value.scope!=='string')throw Error('Unsupported library backup.');header=value;continue;}
  if(end)throw Error('Data follows the backup footer.');
  if(value.type==='record'){if(current||!stores.has(value.store)&&!(value.store==='settings'&&settings.has(value.key))||typeof value.key!=='string'||value.key.length>2000)throw Error('Invalid backup record.');records.push(value);}
  else if(value.type==='file'){if(current||typeof value.key!=='string'||!/^((source|asset|draft)\/).+/.test(value.key)||!/^[a-f0-9]{64}$/.test(value.hash)||!Number.isSafeInteger(value.size)||value.size<0||value.size>1024**4||files.some(f=>f.key===value.key))throw Error('Invalid backup file.');current={...value,path:stage+'/'+crypto.randomUUID()};await FileSystem.writeFile(current.path,'');}
  else if(value.type==='chunk'){if(!current||typeof value.data!=='string'||value.data.length>chunk*2||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data))throw Error('Invalid backup chunk.');await FileSystem.appendFile(current.path,value.data,'base64');if((await FileSystem.stat(current.path)).size>current.size)throw Error('Backup file exceeds declared size.');}
  else if(value.type==='file-end'){if(!current||(await FileSystem.stat(current.path)).size!==current.size||await FileSystem.hash(current.path,'SHA-256')!==current.hash)throw Error('Backup checksum does not match.');files.push(current);total+=current.size;current=undefined;}
  else if(value.type==='end'){if(current||value.records!==records.length||value.files!==files.length||value.bytes!==total)throw Error('Backup totals do not match.');end=value;}
  else throw Error('Unknown backup record.');
 }if(!end)throw Error('Backup was interrupted before completion.');checkReferences(records,files);if(new Set(records.map(r=>r.store+'/'+r.key)).size!==records.length)throw Error('Duplicate backup records.');return {header,records,files,bytes:total,stage};
 }catch(e){await FileSystem.unlink(stage).catch(()=>{});throw e;}
}
export async function restoreLibrary(repo:NativeRepository,path:string){
 if((await repo.songs()).length||(await repo.list('pending')).length)throw Error('Restore into an empty local or account library. Existing libraries are preserved.');
 const backup=await inspectBackup(path);
 try{
  const entries=backup.records.filter(r=>r.store==='syncEntities'&&r.value.entity==='song'&&r.value.operation==='upsert').map(r=>({id:r.value.entityId,kind:'score'}));
  validateSyncRows(backup.records.filter(r=>r.store==='syncEntities').map(r=>r.value));
  entries.push(...backup.records.filter(r=>r.store==='pending').map(r=>({id:r.key,kind:'pending',details:r.value})));
  if(!canAddEntries(0,entries.length,account.entitlement))throw Error('Backup exceeds your saved-song allowance. The backup remains available; request an allowance increase or Premium before restoring.');
  if(repo.scope){if(repo.scope!==account.session?.user.id)throw Error('Account changed.');await account.request('reserve-import',{entries});}
  const dir=Dirs.DocumentDir+'/GuitarIO/'+(repo.scope||'local');await FileSystem.mkdir(dir);
  for(const file of backup.files){const target=dir+'/'+file.hash;if(!await FileSystem.exists(target))await FileSystem.cp(file.path,target);if((await FileSystem.stat(target)).size!==file.size||await FileSystem.hash(target,'SHA-256')!==file.hash)throw Error('Restored bytes do not match.');file.path=target;}
  await repo.sql.transaction(async tx=>{
   for(const row of backup.records){if(row.store==='settings'&&backup.header.scope!==repo.scope&&['deviceId','legacy-migrated-v1'].includes(row.key))continue;if(row.store==='drafts'){const file=backup.files.find(f=>f.key==='draft/'+row.key);if(!file)throw Error('Backup draft file is missing.');row.value.path=file.path;}await repo.put(row.store,row.key,row.value,tx);}
   for(const file of backup.files){const {key,type,...value}=file;await repo.put('files',key,value,tx);}
   await repo.put('settings','cloud-consent',false,tx);await repo.put('settings','lan-enabled',false,tx);
   if(!backup.records.some(r=>r.store==='settings'&&r.key==='legacy-migrated-v1')||backup.header.scope!==repo.scope)await repo.put('settings','legacy-migrated-v1',{restoredBackup:true,at:new Date().toISOString()},tx);
  });
  return {records:backup.records.length,files:backup.files.length,bytes:backup.bytes};
 }finally{await FileSystem.unlink(backup.stage).catch(()=>{});}
}
/** Accept the existing Capacitor/desktop V2 export as a recovery route. */
export async function restoreLegacyBackup(repo:NativeRepository,path:string,inspect:(command:ScoreRequest)=>Promise<any>){
 const value=validateBackup(JSON.parse(await FileSystem.readFile(path))),stage=new NativeRepository(crypto.randomUUID());
 try{
  for(const entry of value.songs){const metadata=await inspect({method:'inspect',fileName:entry.fileName,base64:entry.sourceBase64});if(metadata.hash!==entry.hash)throw Error('Backup original hash does not match.');await stage.putFile('source',entry.id,entry.sourceBase64,entry.hash,entry.fileName);const {sourceBase64,...saved}=entry;await stage.saveSong({...metadata,...saved},[],false);}
  for(const asset of value.assets||[]){const temp=Dirs.CacheDir+'/'+crypto.randomUUID();try{await FileSystem.writeFile(temp,asset.dataBase64,'base64');await stage.adoptFile('asset',asset.id,temp,undefined,asset.name,asset.mime);await stage.journal([{entity:'asset',entityId:asset.id,operation:'upsert',fields:['id','kind','name','mime','byteLength'],patch:{id:asset.id,kind:asset.kind,name:asset.name,mime:asset.mime,byteLength:(await stage.file('asset',asset.id))!.size}}]);}finally{await FileSystem.unlink(temp).catch(()=>{});}}
  for(const [entity,items]of [['folder',value.folders||[]],['guitar',value.guitars||[]]] as const)for(const item of items)await stage.journal([{entity,entityId:item.id,operation:'upsert',fields:Object.keys(item),patch:item}]);
  const backup=await exportLibrary(stage);try{return await restoreLibrary(repo,backup);}finally{await FileSystem.unlink(backup).catch(()=>{});}
 }finally{stage.sql.close();await FileSystem.unlink(Dirs.DocumentDir+'/GuitarIO/'+stage.scope).catch(()=>{});}
}
