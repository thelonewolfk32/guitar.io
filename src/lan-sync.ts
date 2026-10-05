import {getDeviceId,setMissingContentLoader,readLibraryIndex,db} from './storage';
import {applySyncPage,syncPage,syncHead,syncSetting,setSyncSetting,contentChunk,contentRecord,storeTransfer,transferProgress,transferChunks,finishTransfer,cleanTransfers,missingSyncBases,syncBaselines,withSyncBaselines,req} from './sync-storage';
import {validateSyncRows,type SyncRow} from './sync-model';
import {seal,open,newSecret,parsePairing,pairingCode,unbase64} from '../shared/lan-crypto.mjs';

import {shortCode,pairingIdentity,pairingSession,pairingCommit} from '../shared/lan-pairing.mjs';
export type LanStatus={available:boolean;enabled:boolean;name:string;endpoints:string[];discovered:{id:string;name:string;code?:string;endpoints:string[]}[];error?:string;wifi?:boolean};
export type LanConfig={enabled:boolean;id:string;secret:string;name:string;pairingCode?:string;autoSync?:boolean};
export type Peer={id:string;name:string;secret:string;endpoints:string[];lastSync?:string;error?:string;clientOnly?:boolean};
export type SyncEvent={at:string;stage:string;message:string;error?:boolean;peer?:string;entity?:string};
export type SyncView={enabled:boolean;available:boolean;name:string;code:string;peers:Peer[];busy:boolean;bytes:number;lastSync?:string;error:string;waiting:boolean;autoSync:boolean;events:SyncEvent[];stage:string;incoming?:{id:string;name:string;digits:string}};
declare global {interface Window { guitarLan?:{
  configure:(config:LanConfig)=>Promise<LanStatus>;status:()=>Promise<LanStatus>;request:(endpoint:string,body:unknown)=>Promise<unknown>;
  onRequest?:(callback:(payload:any,deviceId:string)=>Promise<unknown>)=>()=>void;
};}}
const initial:SyncView={enabled:false,available:false,name:'Guitar.io',code:'',peers:[],busy:false,bytes:0,error:'',waiting:false,autoSync:true,events:[],stage:'Idle'};
export class SyncEngine {
  view:SyncView={...initial};private config?:LanConfig;private timer?:ReturnType<typeof setTimeout>;private listeners=new Set<()=>void>();private disconnect?:()=>void;private disposed=false;private busy=false;private wake?:()=>void;private transfers=new Map<string,Promise<void>>();
  private activeDownloads=0;private downloadWaiters:(()=>void)[]=[];private changed?:()=>void;
  private pairing?:{id:string;secret?:string;name:string;expires:number;approved:boolean;identity?:Awaited<ReturnType<typeof pairingIdentity>>;nonce?:string;commit?:string};private attempts:number[]=[];private pairingExpiry?:ReturnType<typeof setTimeout>;
  constructor(private canApply:()=>boolean,private onChanges:()=>void){}
  subscribe=(callback:()=>void)=>{this.listeners.add(callback);return()=>{this.listeners.delete(callback);};};
  private update(patch:Partial<SyncView>){this.view={...this.view,...patch};for(const listener of this.listeners)listener();}
  private log(stage:string,message:string,peer?:string,error=false,entity?:string){const events=[...this.view.events,{at:new Date().toISOString(),stage,message:message.slice(0,700),peer,error,entity}].slice(-120);this.update({events});try{window.localStorage.setItem('guitario-sync-diagnostics',JSON.stringify(events));}catch{}}
  clearDiagnostics(){this.update({events:[]});try{window.localStorage.removeItem('guitario-sync-diagnostics');}catch{}}
  private applied(){this.onChanges();window.dispatchEvent(new Event('guitario:synced'));}
  async diagnostics(){const native=await window.guitarLan?.status(),library=await readLibraryIndex(),d=await db();return {version:'1.4.43',at:new Date().toISOString(),stage:this.view.stage,sessionWireBytes:this.view.bytes,enabled:this.view.enabled,autoSync:this.view.autoSync,network:{endpoints:native?.endpoints || [],discovered:native?.discovered.map(p=>({name:p.name,endpoints:p.endpoints})),error:native?.error},peers:await Promise.all(this.view.peers.map(async p=>({name:p.name,endpoints:p.endpoints,error:p.error,lastSuccessfulSync:p.lastSync,pullCheckpoint:await syncSetting(`pull:${p.id}`),pushCheckpoint:await syncSetting(`push:${p.id}`)}))),catalogue:{songs:library.songs.map(s=>({id:s.id,title:s.title,artist:s.artist,album:s.album,artworkAssetId:s.artworkAssetId,lastOpenedAt:s.lastOpenedAt,lastPlayedAt:s.lastPlayedAt,lastPlayedBar:s.lastPlayedBar})),originalRecords:await req(d.transaction('songSources').objectStore('songSources').count()),attachmentRecords:await req(d.transaction('assets').objectStore('assets').count())},events:this.view.events};}
  async start(){
    try{const saved=JSON.parse(window.localStorage.getItem('guitario-sync-diagnostics') || '[]');if(Array.isArray(saved))this.update({events:saved.slice(-120)});}catch{}
    if(!window.guitarLan)return;const id=await getDeviceId(),saved=await syncSetting<LanConfig>('config');this.config={enabled:saved?.enabled || false,autoSync:saved?.autoSync ?? true,pairingCode:saved?.pairingCode || shortCode(),id,secret:saved?.secret || newSecret(),name:saved?.name || (navigator.userAgent.includes('iPhone')?'iPhone':navigator.userAgent.includes('Mac')?'Mac':'PC')};
    const peers=await syncSetting<Peer[]>('peers') || [];this.update({available:true,enabled:this.config.enabled,name:this.config.name,autoSync:this.config.autoSync ?? true,peers});
    this.disconnect=window.guitarLan.onRequest?.((payload,deviceId)=>this.serve(payload,deviceId));
    this.wake=()=>{if(document.visibilityState==='visible')void this.run(true);};window.addEventListener('online',this.wake);document.addEventListener('visibilitychange',this.wake);
    this.changed=()=>this.schedule(1500);window.addEventListener('guitario:changed',this.changed);
    setMissingContentLoader((kind,id)=>this.fetchContent(kind,id));await cleanTransfers();await this.configure();
    if(this.config.enabled)void this.run(true);
  }
  stop(){this.disposed=true;if(this.pairingExpiry)clearTimeout(this.pairingExpiry);if(this.timer)clearTimeout(this.timer);this.disconnect?.();if(this.wake){window.removeEventListener('online',this.wake);document.removeEventListener('visibilitychange',this.wake);}if(this.changed)window.removeEventListener('guitario:changed',this.changed);setMissingContentLoader(undefined);}
  private schedule(delay:number){if(this.timer)clearTimeout(this.timer);if(!this.disposed&&this.view.autoSync&&this.view.enabled)this.timer=setTimeout(()=>void this.run(true),delay);}
  private async configure(){if(!this.config||!window.guitarLan)return;await setSyncSetting('config',this.config);const status=await window.guitarLan.configure(this.config);this.update({code:this.config.enabled && status.endpoints.length?this.config.pairingCode || '':'',error:status.error || ''});}
  async enable(value:boolean){if(!this.config)return;this.config.enabled=value;this.update({enabled:value,error:''});await this.configure();if(value)await this.run(true);else{this.approvePair(false);if(this.timer)clearTimeout(this.timer);}}
  async rename(name:string){if(!this.config)return;this.config.name=name.trim().slice(0,100) || 'Guitar.io';this.update({name:this.config.name});await this.configure();}
  async resetCode(){if(!this.config)return;this.approvePair(false);this.config.secret=newSecret();const previous=this.config.pairingCode;do{this.config.pairingCode=shortCode();}while(this.config.pairingCode===previous);await this.configure();}
  async setAutoSync(value:boolean){if(!this.config)return;const previous=this.config.autoSync;this.config.autoSync=value;this.update({autoSync:value});try{await setSyncSetting('config',this.config);}catch(error){this.config.autoSync=previous;this.update({autoSync:previous ?? true});throw error;}if(value)await this.run(true);else if(this.timer)clearTimeout(this.timer);}
  approvePair(approve:boolean){if(this.pairingExpiry)clearTimeout(this.pairingExpiry);if(this.pairing&&approve&&this.pairing.expires>Date.now())this.pairing.approved=true;else this.pairing=undefined;this.update({incoming:undefined});}
  async beginPair(code:string){
    if(!this.config?.enabled||!window.guitarLan)throw new Error('Enable local sync first.');
    if(!/^\d{6}$/.test(code.trim()))throw new Error('Enter the six-digit code from your PC or Mac.');
    const status=await window.guitarLan.status(),matches=status.discovered.filter(p=>p.code===code.trim());
    if(matches.length!==1)throw new Error(matches.length?'Two devices have this code. Reset one code and try again.':'Device not found. Enable local sync on both devices and connect them to the same Wi-Fi or LAN.');
    const peer=matches[0],identity=await pairingIdentity(),requestId=crypto.randomUUID(),nonce=newSecret(),commit=await pairingCommit(identity.publicKey,nonce,requestId);let last:unknown;
    for(const endpoint of peer.endpoints){try{
      const answer:any=await window.guitarLan.request(endpoint,{op:'pair:init',code:code.trim(),requestId,name:this.config.name,commit});
      if(answer.id!==peer.id||answer.requestId!==requestId)throw new Error('Pairing identity did not match.');
      const reveal:any=await window.guitarLan.request(endpoint,{op:'pair:reveal',requestId,publicKey:identity.publicKey,nonce});
      if(await pairingCommit(reveal.publicKey,reveal.nonce,requestId)!==answer.commit)throw new Error('Pairing commitment did not match.');
      const session=await pairingSession(identity,reveal.publicKey,requestId,true);
      return {id:peer.id,name:peer.name,endpoint,requestId,secret:session.secret,digits:session.digits};
    }catch(e){last=e;this.log('Pairing failed',`${endpoint}: ${e instanceof Error?e.message:String(e)}`,peer.name,true);}}throw last;
  }
  async finishPair(session:{id:string;endpoint:string;requestId:string;secret:string}){
    if(!window.guitarLan)throw new Error('Local sync is unavailable.');
    const status=await window.guitarLan.status(),body=await seal(session.secret,{requestId:session.requestId,op:'confirm',peer:{id:this.config!.id,name:this.config!.name,secret:this.config!.secret,endpoints:status.endpoints}});
    const answer:any=await window.guitarLan.request(session.endpoint,{op:'pair:finish',requestId:session.requestId,body});
    if(!answer.approved)throw new Error('Confirm the matching digits on the other device, then try again.');
    const result=await open(session.secret,answer.body);
    if(result.requestId!==session.requestId||result.id!==session.id)throw new Error('Pairing identity did not match.');
    await this.pair(result.code);
  }
  async pair(code:string){const item=parsePairing(code);if(!this.config||!this.config.enabled)throw new Error('Enable local sync first.');if(item.id===this.config.id)throw new Error('This is this device’s own code.');const peer:Peer={id:item.id,name:item.name,secret:item.secret,endpoints:item.endpoints};const status=await window.guitarLan!.status();await this.call(peer,{op:'hello',peer:{id:this.config.id,name:this.config.name,secret:this.config.secret,endpoints:status.endpoints}});const peers=[...this.view.peers.filter(p=>p.id!==peer.id),peer];await setSyncSetting('peers',peers);this.update({peers,error:''});await this.run();}
  async remove(id:string){await setSyncSetting(`blocked:${id}`,true);const peers=this.view.peers.filter(p=>p.id!==id);await setSyncSetting('peers',peers);this.update({peers});}
  private async rememberPeer(item:any){
    if(!item||!Array.isArray(item.endpoints))throw new Error('Invalid peer.');
    const parsed=parsePairing(pairingCode({v:1,...item,endpoints:item.endpoints.length?item.endpoints:['http://127.0.0.1:1/sync']}));
    const peer:Peer={id:parsed.id,name:parsed.name,secret:parsed.secret,endpoints:item.endpoints,clientOnly:!item.endpoints.length,lastSync:new Date().toISOString()};
    const peers=[...this.view.peers.filter(p=>p.id!==peer.id),peer];await setSyncSetting('peers',peers);this.update({peers});
  }
  private async call(peer:Peer,payload:unknown):Promise<any>{
    if(!this.config||!window.guitarLan||!this.config.enabled)throw new Error('Local sync is off.');
    const native=await window.guitarLan.status();if(native.wifi===false)throw new Error('Connect to Wi-Fi or Ethernet to sync.');
    const found=native.discovered.find(p=>p.id===peer.id),endpoints=[...new Set([...peer.endpoints,...(found?.endpoints || [])])].sort((a,b)=>Number(a.includes('169.254.'))-Number(b.includes('169.254.')));let last:unknown;
    for(const endpoint of endpoints){let remoteError=false;try{const requestId=crypto.randomUUID(),body=await seal(peer.secret,{deviceId:this.config.id,requestId,at:Date.now(),payload});const encrypted=await window.guitarLan.request(endpoint,body);this.update({bytes:this.view.bytes+JSON.stringify(body).length+JSON.stringify(encrypted).length});const result=await open(peer.secret,encrypted);if(result.requestId!==requestId||result.deviceId!==peer.id)throw new Error('Device identity did not match.');peer.endpoints=[endpoint,...endpoints.filter(e=>e!==endpoint)];if(result.payload.error){remoteError=true;throw new Error(result.payload.error);}return result.payload;}catch(e){last=e;this.log('Connection',`${endpoint}: ${e instanceof Error?e.message:String(e)}`,peer.name,true);if(remoteError)throw e;}}
    throw last || new Error('Paired device is unavailable.');
  }
  async serve(payload:any,_deviceId:string){
    if(!this.config?.enabled)throw new Error('Local sync is off.');
    if(payload?.op==='pair:init'){
      this.attempts=this.attempts.filter(at=>at>Date.now()-60000);
      if(this.attempts.length>=5)throw new Error('Too many pairing attempts. Wait a minute.');this.attempts.push(Date.now());
      if(payload.code!==this.config.pairingCode||typeof payload.name!=='string'||payload.name.length>100||this.pairing&&this.pairing.expires>Date.now())throw new Error('Pairing is unavailable.');
      if(typeof payload.commit!=='string'||unbase64(payload.commit).length!==32||typeof payload.requestId!=='string'||payload.requestId.length>100)throw new Error('Invalid pairing request.');
      const identity=await pairingIdentity(),nonce=newSecret();
      this.pairing={id:payload.requestId,identity,nonce,commit:payload.commit,name:payload.name,expires:Date.now()+120000,approved:false};
      if(this.pairingExpiry)clearTimeout(this.pairingExpiry);this.pairingExpiry=setTimeout(()=>this.approvePair(false),120000);
      return {id:this.config.id,requestId:payload.requestId,commit:await pairingCommit(identity.publicKey,nonce,payload.requestId)};
    }
    if(payload?.op==='pair:reveal'){
      const pending=this.pairing;
      if(!pending||pending.id!==payload.requestId||pending.expires<=Date.now()||!pending.identity||pending.secret)throw new Error('Pairing expired.');
      if(await pairingCommit(payload.publicKey,payload.nonce,payload.requestId)!==pending.commit)throw new Error('Pairing commitment did not match.');
      const session=await pairingSession(pending.identity,payload.publicKey,payload.requestId,false);pending.secret=session.secret;
      this.update({incoming:{id:pending.id,name:pending.name,digits:session.digits}});
      return {publicKey:pending.identity.publicKey,nonce:pending.nonce};
    }
    if(payload?.op==='pair:finish'){
      const session=this.pairing;
      if(!session||!session.secret||session.id!==payload.requestId||session.expires<=Date.now())throw new Error('Pairing expired. Start again.');
      const proof=await open(session.secret,payload.body);if(proof.requestId!==session.id||proof.op!=='confirm')throw new Error('Invalid pairing confirmation.');
      if(!session.approved)return {approved:false};
      const status=await window.guitarLan!.status(),code=pairingCode({v:1,id:this.config.id,name:this.config.name,secret:this.config.secret,endpoints:status.endpoints});
      await this.rememberPeer(proof.peer);await setSyncSetting(`blocked:${proof.peer.id}`,false);
      const body=await seal(session.secret,{id:this.config.id,requestId:session.id,code});this.pairing=undefined;return {approved:true,body};
    }
    if(await syncSetting(`blocked:${_deviceId}`))throw new Error('This device was removed. Pair it again.');
    if(payload?.op==='hello' && payload.peer){if(payload.peer.id!==_deviceId)throw new Error('Invalid peer identity.');await this.rememberPeer(payload.peer);}
    if(payload?.op==='hello'||payload?.op==='head')return {id:this.config.id,name:this.config.name,head:await syncHead(),ready:this.canApply(),protocol:2};
    if(payload?.op==='changes')return syncPage(payload.after,payload.limit);
    if(payload?.op==='baselines')return {rows:await syncBaselines(payload.keys)};
    if(payload?.op==='blob'){if(!['source','asset'].includes(payload.kind)||typeof payload.id!=='string'||payload.id.length>200)throw new Error('Invalid content request.');return contentChunk(payload.kind,payload.id,payload.offset);}
    if(payload?.op==='apply'){if(!this.canApply())return {busy:true};try{const needs=await missingSyncBases(payload.rows);if(needs.length){this.log('Metadata repair',`Requested ${needs.length} missing base records.`);return {needs};}const accepted=await applySyncPage(payload.rows);if(accepted){this.applied();this.logRows('Received',validateSyncRows(payload.rows),accepted);}return {accepted};}catch(error){this.log('Incoming metadata',error instanceof Error?error.message:String(error),undefined,true);throw error;}}
    throw new Error('Unknown sync operation.');
  }
  async run(automatic=false){
    if(automatic&&!this.view.autoSync)return;
    if(this.disposed||this.busy)return;this.busy=true;
    try{
      if(!this.config?.enabled||document.visibilityState==='hidden'&&document.documentElement.classList.contains('native-ios')){return;}
      this.update({busy:true,waiting:!this.canApply(),stage:'Checking device revisions'});this.log('Check',automatic?'Background revision check.':'Manual revision check.');
      for(const peer of this.view.peers){if(peer.clientOnly)continue;try{
        const remote=await this.call(peer,{op:'head'}),after=Number(await syncSetting<number>(`pull:${peer.id}`)) || 0;
        if(after>remote.head)throw new Error('This device was reset. Remove it and pair it again.');
        if(this.canApply()){
          let cursor=after,pages=0;while(cursor<remote.head && pages++<20){this.update({stage:`Receiving metadata from ${peer.name} · revision ${cursor}`});const page=await this.call(peer,{op:'changes',after:cursor,limit:100});if(!Number.isSafeInteger(page.cursor)||page.cursor<=cursor||page.cursor>page.head)throw new Error('Invalid peer checkpoint.');let rows=validateSyncRows(page.rows);const needs=await missingSyncBases(rows);if(needs.length){if(remote.protocol!==2)throw new Error('Update both paired apps to V1.4.3 or later to repair missing song metadata.');const bases:SyncRow[]=[];for(let i=0;i<needs.length;i+=20){const answer=await this.call(peer,{op:'baselines',keys:needs.slice(i,i+20)});bases.push(...validateSyncRows(answer.rows));}rows=withSyncBaselines(rows,bases);if(await missingSyncBases(rows).then(keys=>keys.length))throw new Error('Paired device did not provide the requested base records.');this.log('Metadata repair',`Fetched ${needs.length} missing base records without tab or audio bytes.`,peer.name);}const accepted=await applySyncPage(rows,{peer:peer.id,cursor:page.cursor});cursor=page.cursor;if(accepted){this.applied();this.logRows('Received',rows,accepted,peer.name);}if(!page.more)break;}
        }
        if(remote.ready){let sent=Number(await syncSetting<number>(`push:${peer.id}`)) || 0,pages=0;const head=await syncHead();while(sent<head&&pages++<20){this.update({stage:`Sending metadata to ${peer.name} · revision ${sent}`});const page=await syncPage(sent);let rows=page.rows;if(remote.protocol!==2)rows=await syncBaselines(rows.map(row=>row.key));let result=await this.call(peer,{op:'apply',rows});if(result.needs){rows=withSyncBaselines(rows,await syncBaselines(result.needs));result=await this.call(peer,{op:'apply',rows});}if(result.busy){this.log('Waiting',`${peer.name} is editing a song. Updates will resume from revision ${sent}.`,peer.name);break;}if(result.needs||!Number.isSafeInteger(result.accepted))throw new Error('Paired device did not acknowledge the metadata batch.');sent=page.cursor;await setSyncSetting(`push:${peer.id}`,sent);this.logRows('Sent',rows,result.accepted,peer.name);}}
        peer.lastSync=new Date().toISOString();peer.error='';this.log('Checked','Revision check completed.',peer.name);
      }catch(error){peer.error=error instanceof Error?error.message:String(error);this.log('Sync failed',peer.error,peer.name,true);}}
      await setSyncSetting('peers',this.view.peers);this.update({peers:[...this.view.peers],lastSync:new Date().toISOString()});
    }catch(e){this.update({error:String(e)});this.log('Sync failed',String(e),undefined,true);}finally{this.busy=false;this.update({busy:false,stage:this.view.peers.some(p=>p.error)?'Needs attention':'Idle'});const errors=this.view.peers.some(p=>p.error);this.schedule(errors?60000:30000);}
  }
  private logRows(stage:string,rows:SyncRow[],accepted:number,peer?:string){const songs=rows.filter(r=>r.entity==='song'),activity=songs.filter(r=>'lastPlayedAt' in (r.patch || {}));this.log(stage,`${accepted} changed records; ${songs.length} songs; ${activity.length} playback history updates.`,peer);for(const row of songs)this.log(stage,String(row.patch?.title || row.entityId)+(row.operation==='delete'?' · deleted':''),peer,false,row.key);}
  async fetchContent(kind:'source'|'asset',id:string){
    const key=`${kind}/${id}`;if(this.transfers.has(key))return this.transfers.get(key)!;
    const promise=(async()=>{if(this.activeDownloads>=2)await new Promise<void>(resolve=>this.downloadWaiters.push(resolve));this.activeDownloads++;try{await this.downloadContent(kind,id);}finally{this.activeDownloads--;this.downloadWaiters.shift()?.();await cleanTransfers();}})().finally(()=>this.transfers.delete(key));this.transfers.set(key,promise);return promise;
  }
  private async downloadContent(kind:'source'|'asset',id:string){
    if(!this.view.enabled)throw new Error('Enable local sync and connect a paired device to download this file.');
    const record=await contentRecord(kind,id);if(!record){this.log('File unavailable',`${kind}/${id}: no attachment metadata received yet.`,undefined,true,`${kind}/${id}`);throw new Error('File metadata has not arrived yet. Sync both devices and try again.');}
    this.log('Download',`${record.name || id} · ${kind}`,undefined,false,`${kind}/${id}`);
    const key=`${kind}/${id}`,saved=await transferProgress(key),parts:Uint8Array[]=saved?await transferChunks(key):[];let offset=parts.reduce((n,p)=>n+p.length,0),size=saved?.size || Number(record.byteLength)||0;let last:unknown;
    for(const peer of this.view.peers.filter(p=>!p.clientOnly)){try{
      while(!size||offset<size){const chunk=await this.call(peer,{op:'blob',kind,id,offset}),part=unbase64(chunk.bytes);if(chunk.offset!==offset||!Number.isSafeInteger(chunk.size)||chunk.size<=0||chunk.size>(kind==='source'?30:250)*1024*1024||part.length>512*1024||!part.length||offset+part.length>chunk.size||size && size!==chunk.size)throw new Error('Invalid file chunk.');size=chunk.size;parts.push(part);if(offset+part.length<=64*1024*1024)await storeTransfer(key,part,offset,size);offset+=part.length;}
      await finishTransfer(kind,id,new Blob(parts as BlobPart[]));this.log('Downloaded',`${record.name || id} · ${offset} bytes`,peer.name,false,key);window.dispatchEvent(new CustomEvent('guitario:content-ready',{detail:{kind,id}}));return;
    }catch(error){last=error;this.log('Download failed',`${record.name || id} · ${error instanceof Error?error.message:String(error)}`,peer.name,true,key);}}
    throw new Error('The file is not available from an awake paired device. '+(last instanceof Error?last.message:''));
  }
}
