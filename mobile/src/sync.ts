import {FileSystem,Dirs} from 'react-native-file-access';import {toByteArray} from 'base64-js';
import {mobileAccount as account} from './api';import {config} from './config';import {NativeRepository} from './repository';import {featureAccess} from '../../src/plans';import {validateSyncRows,type SyncRow} from '../../src/sync-model';
export class MobileCloudSync {
 busy=false;
 constructor(private repo:NativeRepository){}
 async active(id:string){const limit=featureAccess(account.entitlement).limits.songs;if(limit===null)return true;const entries=await this.repo.setting<any[]>('entries')||[],local=[...await this.repo.songs(),...await this.repo.list<any>('pending')];if(new Set([...entries.map(e=>e.id),...local.map(e=>e.id)]).size<=limit)return true;const active=entries.filter(e=>e.active);return active.length<=limit&&active.some(e=>e.id===id);}
 private async allowed(row:SyncRow){if(row.operation==='delete')return true;const parent=['song','source'].includes(row.entity)?row.entityId:['section','recording','annotation'].includes(row.entity)?row.entityId.split(':')[0]:undefined;return !parent||await this.active(parent);}
 async run(report:(text:string)=>void){
  if(this.busy)return;if(!account.session||account.session.user.id!==this.repo.scope)throw Error('Open your account library before syncing.');
  this.busy=true;const generation=account.generation;const check=()=>{if(generation!==account.generation)throw Error('Account changed.');};
  try{
   await account.refresh();check();const {entries}=await account.request('entries');check();await this.repo.set('entries',entries.filter((e:any)=>!e.deleted));for(const entry of entries){if(entry.kind==='pending'&&!entry.deleted)await this.repo.put('pending',entry.id,{...entry.details,id:entry.id,kind:'pending'});else await this.repo.remove('pending',entry.id);}
   let sent=Number(await this.repo.setting('cloud-push'))||0;const rows=(await this.repo.list<SyncRow>('syncEntities')).filter(r=>r.revision>sent).sort((a,b)=>a.revision-b.revision);
   for(let i=0;i<rows.length;i+=100){const page=rows.slice(i,i+100),allowed=[];for(const row of page)if(await this.allowed(row))allowed.push({...row,complete:true});if(allowed.length){report('Uploading metadata…');await account.request('cloud-push',{rows:allowed});check();}sent=page.at(-1)!.revision;await this.repo.set('cloud-push',sent);}
   await this.files(true,report);let after=Number(await this.repo.setting('cloud-pull'))||0;
   for(let i=0;i<100;i++){report('Downloading library changes…');const page=await account.request('cloud-pull',{after});check();validateSyncRows(page.rows);if(!Number.isSafeInteger(page.cursor)||page.cursor<after||page.more&&page.cursor===after)throw Error('Invalid sync checkpoint.');await this.repo.apply(page.rows,{key:'cloud-pull',cursor:page.cursor});after=page.cursor;if(!page.more)break;if(i===99)throw Error('More changes remain; sync will continue.');}
   await this.files(false,report);check();await this.flushPractice();report('Active songs and attachments are saved for offline use.');
  }finally{this.busy=false;}
 }
 private async files(upload:boolean,report:(message:string)=>void){
  const rows=await this.repo.list<SyncRow>('syncEntities'),songs=await this.repo.songs(),activeSongs=[];for(const s of songs)if(await this.active(s.id))activeSongs.push(s);
  const assetIds=new Set(activeSongs.flatMap(s=>[s.artworkAssetId,...Object.values(s.collectionArt||{}),...(s.media?.recordings||[]).filter((r:any)=>r.kind==='audio').map((r:any)=>r.assetId)]));
  for(const g of rows.filter(r=>r.entity==='guitar'&&r.operation==='upsert'))if(g.patch?.artworkAssetId)assetIds.add(g.patch.artworkAssetId);
  let missing=0;
  for(const row of rows.filter(r=>['source','asset'].includes(r.entity)&&r.operation==='upsert')){
   if(row.entity==='source'?!await this.active(row.entityId):!assetIds.has(row.entityId))continue;
   const file=await this.repo.file(row.entity,row.entityId),body={kind:row.entity,id:row.entityId};
   if(upload){if(!file||await this.repo.setting('uploaded:'+row.key)===file.hash)continue;report('Uploading '+(file.name||row.entityId)+'…');const reservation=await account.request('cloud-reserve',{...body,hash:file.hash,size:file.size});if(reservation.path!==this.repo.scope+'/blobs/'+file.hash)throw Error('Invalid upload path.');if(!reservation.ready){const data=toByteArray(await FileSystem.readFile(file.path,'base64')),r=await fetch(config.url+'/storage/v1/object/library/'+reservation.path,{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+await account.token(),'Content-Type':file.mime||'application/octet-stream'},body:data.buffer as ArrayBuffer});if(!r.ok&&![400,409].includes(r.status))throw Error('File upload failed.');await account.request('cloud-finish',body);}await this.repo.set('uploaded:'+row.key,file.hash);
   }else if(!file||!await FileSystem.exists(file.path)){const info=await account.request('cloud-file',body);if(info.missing){missing++;continue;}if(!/^[a-f0-9]{64}$/.test(info.hash)||info.path!==this.repo.scope+'/blobs/'+info.hash||!Number.isSafeInteger(info.size)||info.size<1||info.size>30*1024*1024)throw Error('Invalid download descriptor.');report('Downloading '+(row.patch?.name||row.entityId)+'…');const target=Dirs.CacheDir+'/'+crypto.randomUUID()+'.part',r=await FileSystem.fetch(config.url+'/storage/v1/object/authenticated/library/'+info.path,{path:target,headers:{apikey:config.key,Authorization:'Bearer '+await account.token()}});if(!r.ok)throw Error('Download failed.');const stat=await FileSystem.stat(target);if(stat.size!==info.size||await FileSystem.hash(target,'SHA-256')!==info.hash){await FileSystem.unlink(target);throw Error('Download checksum does not match.');}await this.repo.putFile(row.entity,row.entityId,await FileSystem.readFile(target,'base64'),info.hash,String(row.patch?.name||row.entityId),String(row.patch?.mime||'application/octet-stream'));await FileSystem.unlink(target);}
  }if(missing)throw Error(missing+' files need uploading from their source device. Sync will retry.');
 }
 async flushPractice(){const events=await this.repo.list<any>('practice');for(let i=0;i<events.length;i+=100){const page=events.slice(i,i+100);await account.request('practice',{events:page});for(const e of page)await this.repo.remove('practice',e.id);}}
}
