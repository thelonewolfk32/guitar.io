import {account} from './account';
import {serviceConfig} from './service-config';
import {refreshEntries,isEntryActive} from './library-access';
import {readLibraryIndex,storageScope} from './storage';
import {syncPage,syncBaselines,syncSetting,setSyncSetting,applySyncPage,initializeContentQueue,pendingSyncContent,contentRecord,finishTransfer,clearPendingContent} from './sync-storage';
import {validateSyncRows} from './sync-model';
type FileRef={kind:'source'|'asset';id:string};
export class CloudSyncEngine{
  busy=false;private stopping=false;private accountId?:string;private controller?:AbortController;
  private async request(route:string,body:unknown={}){if(account.session?.user.id!==this.accountId)throw Error('Cloud account changed. Sign in and sync again.');const data=await account.request(route,body,this.controller?.signal);if(account.session?.user.id!==this.accountId)throw Error('Cloud account changed. Sign in and sync again.');return data;}
  constructor(private canApply:()=>boolean,private changed:()=>void){}
  async pauseForUpdate(){this.stopping=true;this.controller?.abort();const deadline=Date.now()+30000;while(this.busy){if(Date.now()>deadline)throw Error('Cloud sync is finishing. Try installing again shortly.');await new Promise(r=>setTimeout(r,100));}}
  resumeAfterUpdate(){this.stopping=false;}
  async run(report:(text:string)=>void){
    if(this.busy)return;if(this.stopping||!this.canApply())throw Error('Close the player and editors before cloud sync.');
    this.busy=true;this.controller=new AbortController();try{
    await account.refreshEntitlement(this.controller.signal);if(!account.session||storageScope()!==account.session.user.id)throw Error('Open your account library before syncing.');await refreshEntries(this.controller.signal);
    const user=account.session!.user.id,peer='cloud:'+user,queueKey='cloud-files:'+user;this.accountId=user;
      let sent=Number(await syncSetting('push:'+peer)) || 0;
      for(let pageCount=0;pageCount<20;pageCount++){
        if(!this.canApply())throw Error('Cloud sync paused while the library is in use.');
        const page=await syncPage(sent);if(!page.rows.length){await setSyncSetting('push:'+peer,page.cursor);break;}
        report('Uploading library metadata…');const baselines=await syncBaselines(page.rows.map(r=>r.key)),rows=[];for(const row of baselines)if(await this.rowActive(row))rows.push(row);if(rows.length)await this.request('cloud-push',{rows});
        const queue=await syncSetting<FileRef[]>(queueKey) || [],add=rows.filter(r=>['source','asset'].includes(r.entity)&&r.operation==='upsert').map(r=>({kind:r.entity as FileRef['kind'],id:r.entityId}));
        await setSyncSetting(queueKey,[...new Map([...queue,...add].map(f=>[f.kind+'/'+f.id,f])).values()]);sent=page.cursor;await setSyncSetting('push:'+peer,sent);if(!page.more)break;
      }
      await this.uploadFiles(user,queueKey,report);
      let after=Number(await syncSetting('pull:'+peer)) || 0;
      for(let pageCount=0;pageCount<20;pageCount++){
        if(!this.canApply())throw Error('Cloud sync paused while the library is in use.');
        report('Downloading library metadata…');const page=await this.request('cloud-pull',{after});const rows=validateSyncRows(page.rows);
        if(!Number.isSafeInteger(page.cursor)||page.cursor<after||page.cursor>page.head||page.more&&page.cursor===after)throw Error('Invalid cloud checkpoint.');
        await applySyncPage(rows,{peer,cursor:page.cursor});after=page.cursor;this.changed();if(!page.more)break;
      }
      await initializeContentQueue();let remaining=0;
      for(const file of await pendingSyncContent()){
        if(!await this.fileActive(file))continue;
        const existing=await contentRecord(file.kind,file.id);if(existing?.source || existing?.blob){await clearPendingContent(file.kind,file.id);continue;}
        const info=await this.request('cloud-file',file);if(info.missing){remaining++;continue;}
        if(!/^[a-f0-9]{64}$/.test(info.hash)||info.path!==user+'/blobs/'+info.hash||!Number.isSafeInteger(info.size)||info.size>30*1024*1024)throw Error('Invalid cloud file response.');
        report('Downloading '+file.name+'…');const response=await fetch(serviceConfig.url+'/storage/v1/object/authenticated/library/'+info.path,{headers:{apikey:serviceConfig.key,Authorization:'Bearer '+await account.token()},signal:AbortSignal.any([this.controller!.signal,AbortSignal.timeout(120000)])});if(!response.ok)throw Error('Cloud file download failed.');const bytes=await response.arrayBuffer();if(bytes.byteLength!==info.size||await this.hash(bytes)!==info.hash)throw Error('Cloud file verification failed.');if(account.session?.user.id!==user||storageScope()!==user||this.controller.signal.aborted)throw Error('Cloud account changed.');await finishTransfer(file.kind,file.id,new Blob([bytes]));
      }
      await this.uploadFiles(user,queueKey,report);this.changed();report(remaining?`${remaining} files still need uploading from their source device.`:'Cloud files saved for offline use.');
    }finally{this.busy=false;this.controller=undefined;}
  }
  private async rowActive(row:any){if(row.operation==='delete')return true;const id=['song','source'].includes(row.entity)?row.entityId:['section','recording','annotation'].includes(row.entity)?row.entityId.split(':')[0]:undefined;return !id||await isEntryActive(id);}
  private async fileActive(file:FileRef){if(file.kind==='source')return isEntryActive(file.id);const index=await readLibraryIndex();if(index.guitars.some(g=>g.artworkAssetId===file.id))return true;for(const s of index.songs)if(s.assetIds.includes(file.id)&&await isEntryActive(s.id))return true;return false;}
  private async hash(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
  private async uploadFiles(user:string,key:string,report:(text:string)=>void){
    for(const file of await syncSetting<FileRef[]>(key) || []){
      if(!await this.fileActive(file))continue;
      const record=await contentRecord(file.kind,file.id);if(!record){await this.removeQueued(key,file);continue;}const blob=record.blob || (record.source?new Blob([record.source]):undefined);if(!blob)continue;
      if(blob.size>30*1024*1024)throw Error('Cloud beta supports files up to 30 MB. This file stays available locally.');
      report('Uploading '+(record.name || 'Guitar Pro file')+'…');const hash=await this.hash(await blob.arrayBuffer()),reserved=await this.request('cloud-reserve',{...file,hash,size:blob.size});if(reserved.path!==user+'/blobs/'+hash)throw Error('Invalid cloud upload path.');
      if(!reserved.ready){const response=await fetch(serviceConfig.url+'/storage/v1/object/library/'+reserved.path,{method:'POST',headers:{apikey:serviceConfig.key,Authorization:'Bearer '+await account.token(),'Content-Type':'application/octet-stream','x-upsert':'false'},body:blob,signal:AbortSignal.any([this.controller!.signal,AbortSignal.timeout(120000)])});if(!response.ok&&![400,409].includes(response.status))throw Error('Cloud upload failed.');await this.request('cloud-finish',file);}
      await this.removeQueued(key,file);
    }
  }
  private async removeQueued(key:string,file:FileRef){await setSyncSetting(key,(await syncSetting<FileRef[]>(key) || []).filter(f=>f.kind!==file.kind||f.id!==file.id));}
}
