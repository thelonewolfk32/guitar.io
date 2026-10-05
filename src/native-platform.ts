import {Capacitor,registerPlugin} from '@capacitor/core';
import type {LanStatus,LanConfig} from './lan-sync';
import type {SongsterrImportResult,SongsterrSyncResult} from './songsterr-score';

const native=registerPlugin<{configure:(options:LanConfig)=>Promise<LanStatus>;status:()=>Promise<LanStatus>;request:(options:{endpoint:string;body:string})=>Promise<{body:string}>;fetchJSON:(options:{url:string})=>Promise<{body:string}>}>('GuitarLocal');
async function json(url:string){return JSON.parse((await native.fetchJSON({url})).body);}
function songId(value:string){const url=new URL(value);if(url.protocol!=='https:'||!['www.songsterr.com','songsterr.com'].includes(url.hostname)||url.username||url.password)throw new Error('Use a Songsterr song URL.');const id=Number(/-s(\d+)(?:t\d+)?(?:\/|$)/.exec(url.pathname)?.[1]);if(!Number.isSafeInteger(id)||id<1)throw new Error('The link does not contain a Songsterr song.');return id;}
async function songsterr(value:string,tracks=false):Promise<SongsterrImportResult|SongsterrSyncResult>{
  const id=songId(value),meta=await json(`https://www.songsterr.com/api/meta/${id}`),revisionId=meta.revisionId;
  if(!Number.isSafeInteger(revisionId)||!Array.isArray(meta.tracks)||meta.tracks.length>64||!meta.image)throw new Error('Songsterr metadata is unavailable.');
  let videos:SongsterrSyncResult['videos']=[],syncWarning='';try{const list=await json(`https://www.songsterr.com/api/video-points/${id}/${revisionId}/list`);const seen=new Set();videos=list.filter((v:any)=>v.status==='done'&&[null,undefined,'alternative','backing'].includes(v.feature)&&/^[\w-]{11}$/.test(v.videoId)&&Array.isArray(v.points)&&v.points.length>=2&&v.points.length<=20000&&v.points.every((p:any)=>Number.isFinite(p)&&p>=0&&p<=604800)).sort((a:any,b:any)=>(a.feature==='backing'?2:a.feature?1:0)-(b.feature==='backing'?2:b.feature?1:0)).filter((v:any)=>{if(seen.has(v.videoId))return false;seen.add(v.videoId);return true;}).slice(0,10).map((v:any)=>({videoId:v.videoId,purpose:v.feature==='backing'?'backing':'full',points:v.points,tracks:v.tracks}));}catch{syncWarning='No recording timestamps were available.';}
  const result:SongsterrSyncResult={url:value,songId:id,revisionId,videos};if(!tracks)return result;
  const downloaded=[];let total=0;for(let i=0;i<meta.tracks.length;i++){
    let data:any,error:unknown;for(const host of meta.image.endsWith('-stage')?['d3d3l6a6rcgkaf']:['dqsljvtekg760','d34shlm8p2ums2','d3cqchs6g3b5ew'])try{data=await json(`https://${host}.cloudfront.net/${id}/${revisionId}/${meta.image}/${i}.json`);break;}catch(e){error=e;}
    if(!data)throw error || new Error('The tab could not be downloaded.');total+=JSON.stringify(data).length;if(total>30*1024*1024)throw new Error('This tab exceeds 30 MB.');downloaded.push({...meta.tracks[i],...data});
  }
  return {...result,meta:{title:meta.title,artist:typeof meta.artist==='string'?meta.artist:meta.artist?.name || 'Unknown artist'},tracks:downloaded,syncWarning};
}
export function installNativePlatform(){
  if(!Capacitor.isNativePlatform())return;
  document.documentElement.classList.add('native-ios');
  window.guitarLan={configure:config=>native.configure(config),status:()=>native.status(),request:async(endpoint,body)=>JSON.parse((await native.request({endpoint,body:JSON.stringify(body)})).body)};
  window.guitarIO={lookupSongTempo:async()=>undefined,downloadSongsterr:async url=>await songsterr(url,true) as SongsterrImportResult,songsterrSync:async url=>await songsterr(url) as SongsterrSyncResult,openLearn:async id=>{location.href=`?learn=1&song=${encodeURIComponent(id)}`;},updateLearn:()=>{},onLearnContext:()=>()=>{}};
}
