import {NativeModules} from 'react-native';import {Dirs,FileSystem} from 'react-native-file-access';import {NativeRepository} from './repository';
import {checkReferences} from './backup';
export async function migrateLegacy(repo:NativeRepository){
 if(await repo.setting('legacy-migrated-v1'))return;
 if(!NativeModules.GuitarPlatform)throw Error('Add the native platform module using configure-ios.rb.');
 const snapshot=await NativeModules.GuitarPlatform.legacySnapshot(repo.scope),lines=(await FileSystem.readFile(snapshot.recordsPath)).split('\n').filter(Boolean);
 if(snapshot.scope!==repo.scope)throw Error('Migration account does not match.');
 if(lines.length!==snapshot.records)throw Error('Migration record count does not match.');
 const files=Object.values(snapshot.files) as {path:string;hash:string;size:number}[];if(files.reduce((n,f)=>n+f.size,0)!==snapshot.totalBytes)throw Error('Migration byte count does not match.');
 for(const file of files)if((await FileSystem.stat(file.path)).size!==file.size||await FileSystem.hash(file.path,'SHA-256')!==file.hash)throw Error('Migration file verification failed.');
 const records=lines.map(line=>JSON.parse(line)),stage=new NativeRepository(crypto.randomUUID(),true);
 try{
  if(records.length&&((await repo.list('syncEntities')).length||(await repo.list('pending')).length))throw Error('This native library already contains data. Export it before reviewing a legacy merge.');
  for(const r of records){const key=typeof r.key==='string'?r.key:JSON.stringify(r.key);await stage.put(r.store,key,r.value);}
  for(const r of records){if(r.store==='songSources'&&r.value.source?.__nativeFile){const f=snapshot.files[r.value.source.__nativeFile],song=await stage.get('songs',r.value.id);if(!f||song?.hash&&song.hash!==f.hash)throw Error('Migration GP hash does not match.');await stage.put('files','source/'+r.value.id,{...f,name:song?.fileName});}if(r.store==='assets'&&r.value.blob?.__nativeFile){const f=snapshot.files[r.value.blob.__nativeFile];if(!f)throw Error('Migration attachment is missing.');await stage.put('files','asset/'+r.value.id,{...f,name:r.value.name,mime:r.value.mime});}}
  if(!(await stage.list('syncEntities')).length){for(const r of records.filter(r=>r.store==='songs'))await stage.saveSong(r.value,[],false);for(const [entity,key]of [['guitar','guitars'],['folder','folders']] as const)for(const item of await stage.setting<any[]>(key)||[])await stage.journal([{entity,entityId:item.id,operation:'upsert',fields:Object.keys(item),patch:item}]);}
  for(const song of await stage.songs())if(!await stage.file('source',song.id))throw Error('A legacy GP original is missing. Download it in the old app or restore a full backup before completing migration.');
  const initial=(await stage.sql.execute('select store,key,value from kv')).rows;checkReferences(initial.map(r=>({store:r.store,key:r.key,value:JSON.parse(String(r.value))})),initial.filter(r=>r.store==='files').map(r=>({key:String(r.key),...JSON.parse(String(r.value))})));
  const content=await stage.sql.execute("select key,value from kv where store='files'"),dir=Dirs.DocumentDir+'/GuitarIO/'+(repo.scope||'local');await FileSystem.mkdir(dir);
  for(const row of content.rows){const f=JSON.parse(String(row.value)),target=dir+'/'+f.hash;if(!await FileSystem.exists(target))await FileSystem.cp(f.path,target);if((await FileSystem.stat(target)).size!==f.size||await FileSystem.hash(target,'SHA-256')!==f.hash)throw Error('Migration copy verification failed.');await stage.put('files',String(row.key),{...f,path:target});}
  const all=await stage.sql.execute('select store,key,value from kv');await repo.sql.transaction(async tx=>{for(const row of all.rows)await repo.put(String(row.store),String(row.key),JSON.parse(String(row.value)),tx);await repo.put('settings','legacy-migrated-v1',{records:snapshot.records,bytes:snapshot.totalBytes,at:new Date().toISOString()},tx);});
 }finally{stage.sql.close();}
 // The original WebKit database and keychain remain intact for recovery.
}
