import {useEffect,useState} from 'react';
import ScoreWorkspace from './ScoreWorkspace';
import Learn from './Learn';
import {migrateSong} from './library-model';
import {account} from './account';
import {makeSong,toBase64,fromBase64} from './notation';
import {saveSongs,db,setMissingContentLoader} from './storage';
import {contentRecord,finishTransfer,req,done} from './sync-storage';
import {BridgeAssembler,chunkMessage,type ScoreRequest} from '../shared/score-bridge';
import {seal,open,newSecret} from '../shared/lan-crypto.mjs';
import {pairingIdentity,pairingSession,pairingCommit} from '../shared/lan-pairing.mjs';
const assembler=new BridgeAssembler(),identities=new Map<string,any>(),waiting=new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
function send(value:unknown){const bridge=(window as any).ReactNativeWebView;if(!bridge)return;for(const part of chunkMessage(crypto.randomUUID(),value))bridge.postMessage(JSON.stringify(part));}
function native(type:string,value:unknown){const id=crypto.randomUUID();return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error('The native app did not acknowledge the change.'));},60000);waiting.set(id,{resolve,reject,timer});send({type,id,...value as object});});}
export default function NativeScore(){
 const [song,setSong]=useState<any>(),[learn,setLearn]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  (window as any).guitarNativePractice=(songId:string,kind:string,data:any)=>send({type:'practice',songId,kind,data});
  setMissingContentLoader(async(kind,id)=>{const data=await native('file-get',{kind,fileId:id});await finishTransfer(kind,id,new Blob([new Uint8Array(fromBase64(data.base64))],{type:data.mime}));});
  async function receive(event:MessageEvent){try{const part=JSON.parse(event.data),value:any=part.type==='chunk'?assembler.accept(part):part;if(!value)return;
   if(value.method==='reply'){const w=waiting.get(value.requestId);if(w){waiting.delete(value.requestId);clearTimeout(w.timer);value.error?w.reject(Error(value.error)):w.resolve(value.data);}return;}
   const command=value.request as ScoreRequest;let result:any;
   try{
    if(command.method==='pause'){window.dispatchEvent(new Event('guitario:pause'));result={paused:true};}
    else if(command.method==='inspect'){const parsed=migrateSong(await makeSong(fromBase64(command.base64),command.fileName)),{source,...metadata}=parsed;result=metadata;}
    else if(command.method==='cache'){const bytes=new Uint8Array(fromBase64(command.base64));if(bytes.byteLength>30*1024*1024)throw Error('File exceeds 30 MB.');const hash=toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));const hex=Array.from(fromBase64(hash),b=>b.toString(16).padStart(2,'0')).join('');if(command.hash&&hex!==command.hash)throw Error('GP checksum does not match.');const d=await db(),tx=d.transaction(command.kind==='source'?'songSources':'assets','readwrite'),p=done(tx);tx.objectStore(command.kind==='source'?'songSources':'assets').put(command.kind==='source'?{id:command.fileId,source:bytes}:{id:command.fileId,...command.meta,blob:new Blob([bytes],{type:command.meta?.mime})});await p;result={saved:true};}
    else if(command.method==='load'||command.method==='learn'){
     account.entitlement=command.entitlement||account.entitlement;if(command.sectionColours!==undefined)window.localStorage.setItem('guitario-section-colours',command.sectionColours?'on':'off');const original=await contentRecord('source',command.song.id);if(!original?.source)throw Error('Cache the original GP file before opening this score.');
     const loaded={...command.song,source:original.source};await saveSongs([loaded]);const d=await db();if(command.assets?.length){const tx=d.transaction('assets','readwrite'),p=done(tx);for(const asset of command.assets)if(!await req(tx.objectStore('assets').get(asset.id)))tx.objectStore('assets').put(asset);await p;}
     if(command.method==='learn')history.replaceState(null,'','?song='+encodeURIComponent(loaded.id));setSong(loaded);setLearn(command.method==='learn');result={ready:true};
    }else if(command.method==='crypto'){const args=command.args;if(command.operation==='identity'){const id=crypto.randomUUID(),identity=await pairingIdentity();identities.set(id,identity);result={handle:id,publicKey:identity.publicKey,nonce:newSecret(),secret:newSecret()};}else if(command.operation==='session'){const identity=identities.get(args[0]);if(!identity)throw Error('Pairing identity expired.');result=await pairingSession(identity,args[1],args[2],args[3]);identities.delete(args[0]);}else if(command.operation==='commit')result=await pairingCommit(args[0],args[1],args[2]);else if(command.operation==='seal')result=await seal(args[0],args[1]);else result=await open(args[0],args[1]);}
    else throw Error('Unknown score command.');
    send({type:'result',id:value.id,result});
   }catch(e){send({type:'result',id:value.id,error:e instanceof Error?e.message:String(e)});}
  }catch(e){setNotice(String(e));}}
  const preferences=(e:Event)=>send({type:'preferences',...(e as CustomEvent).detail});window.addEventListener('guitario:display-preference',preferences);window.addEventListener('message',receive);document.addEventListener('message',receive as unknown as EventListener);send({type:'ready'});return()=>{window.removeEventListener('guitario:display-preference',preferences);window.removeEventListener('message',receive);document.removeEventListener('message',receive as unknown as EventListener);setMissingContentLoader(undefined);delete (window as any).guitarNativePractice;};
 },[]);
 if(!song)return <p role="status">{notice||'Score engine ready'}</p>;
 if(learn)return <Learn key={'learn:'+song.id}/>;
 return <><ScoreWorkspace song={song} onPlayed={()=>{}} onSave={async(next,assets=[])=>{const encoded=[];for(const a of assets)encoded.push({...a,blob:undefined,base64:toBase64(new Uint8Array(await a.blob.arrayBuffer()))});const {source,...metadata}=next;await native('save',{song:metadata,assets:encoded});await saveSongs([next],false,assets);setSong(next);}} onEdit={()=>send({type:'edit',id:song.id})} onBack={()=>send({type:'back'})} notify={setNotice}/>{notice&&<p role="status">{notice}</p>}</>;
}
