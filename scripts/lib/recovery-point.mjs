import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function retainedPoints(points,days=30){return [...points].sort((a,b)=>b.localeCompare(a)).slice(0,days);}
export function validateRecoveryPoint(value){
 if(value?.format!=='guitario-cloud'||value.version!==1||!/^[a-z0-9]{20}$/.test(value.project)||!Array.isArray(value.objects)||!Array.isArray(value.database)||value.database.length!==3)throw Error('Invalid recovery point.');
 const seen=new Set();for(const object of [...value.objects,...value.database]){if(!/^[a-f0-9]{64}$/.test(object.hash)||object.key!=='objects/'+object.hash||!Number.isSafeInteger(object.size)||object.size<0)throw Error('Invalid recovery object.');if(object.bucket){if(!['library','feedback-attachments'].includes(object.bucket)||typeof object.path!=='string'||!(/^[a-f0-9-]{36}\//.test(object.path))||object.path.split('/').some(p=>p==='..'||p==='.'||!p))throw Error('Invalid storage path.');const id=object.bucket+'/'+object.path;if(seen.has(id))throw Error('Duplicate recovery object.');seen.add(id);}}
 if(new Set(value.database.map(d=>d.name)).size!==3)throw Error('Duplicate database recovery component.');
 if(!['schema.dump','data.dump','storage-policies.sql'].every(name=>value.database.some(d=>d.name===name)))throw Error('Database recovery set is incomplete.');return value;
}
/** Publish the manifest last. Failed/missing bytes cannot become a recovery point. */
export async function createRecoveryPoint({project,objects,database,read,has,put,now=new Date()}){
 const manifest={format:'guitario-cloud',version:1,project,createdAt:now.toISOString(),objects:[],database:[]};
 for(const [kind,items]of [['objects',objects],['database',database]])for(const item of items){const bytes=await read(item),hash=sha256(bytes);if(item.expectedHash&&item.expectedHash!==hash)throw Error('Source checksum mismatch.');if(item.expectedSize!==undefined&&item.expectedSize!==bytes.length)throw Error('Source byte count mismatch.');const key='objects/'+hash;if(!await has(key,hash,bytes.length))await put(key,bytes,hash);manifest[kind].push({...item,key,hash,size:bytes.length});}
 validateRecoveryPoint(manifest);const bytes=Buffer.from(JSON.stringify(manifest));await put('points/'+now.toISOString().slice(0,10)+'.json',bytes,sha256(bytes));return manifest;
}
