import {NativeModules} from 'react-native';import {FileSystem} from 'react-native-file-access';import type {NativeRepository} from './repository';
export async function migrateLegacy(repo:NativeRepository){
 if(await repo.setting('legacy-migrated-v1'))return;
 if(!NativeModules.GuitarPlatform)throw Error('Add the native platform module using configure-ios.rb.');
 const snapshot=await NativeModules.GuitarPlatform.legacySnapshot(),lines=(await FileSystem.readFile(snapshot.recordsPath)).split('\n').filter(Boolean);
 if(lines.length!==snapshot.records)throw Error('Migration record count does not match.');
 const files=Object.values(snapshot.files) as {path:string;hash:string;size:number}[];if(files.reduce((n,f)=>n+f.size,0)!==snapshot.totalBytes)throw Error('Migration byte count does not match.');
 for(const file of files)if((await FileSystem.stat(file.path)).size!==file.size||await FileSystem.hash(file.path,'SHA-256')!==file.hash)throw Error('Migration file verification failed.');
 const records=lines.map(line=>JSON.parse(line));
 await repo.sql.transaction(async tx=>{for(const r of records){const key=typeof r.key==='string'?r.key:JSON.stringify(r.key);await repo.put(r.store,key,r.value,tx);}});
 for(const r of records){if(r.store==='songSources'&&r.value.source?.__nativeFile){const f=snapshot.files[r.value.source.__nativeFile],song=await repo.get('songs',r.value.id);await repo.adoptFile('source',r.value.id,f.path,song?.hash);}if(r.store==='assets'&&r.value.blob?.__nativeFile){const f=snapshot.files[r.value.blob.__nativeFile];await repo.adoptFile('asset',r.value.id,f.path,f.hash,r.value.name,r.value.mime);}}
 const rows=await repo.list('syncEntities');if(!rows.length)for(const r of records.filter(r=>r.store==='songs'))await repo.saveSong(r.value,[],false);
 await repo.set('legacy-migrated-v1',{records:snapshot.records,bytes:snapshot.totalBytes,at:new Date().toISOString()});
 // The original WebKit database and keychain remain intact for recovery.
}
