// Direct public-data import, adapted from teaqu/guitar-pro-youtube-sync (MIT).
const { gunzipSync } = require('node:zlib');
const MAX_TAB_BYTES = 30 * 1024 * 1024;
const CDNS = ['dqsljvtekg760', 'd34shlm8p2ums2', 'd3cqchs6g3b5ew'];
const LEGACY = ['d3rrfvx08uyjp1', 'dodkcbujl0ebx', 'dj1usja78sinh'];
const pending = new Map();
function songsterrUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Paste a Songsterr song link.'); }
  if (typeof value !== 'string' || value.length > 2048 || url.protocol !== 'https:' || !['www.songsterr.com','songsterr.com'].includes(url.hostname) || url.port || url.username || url.password || !(/^\/a\/wsa\/.+-s\d+(?:t\d+)?\/?$/.test(url.pathname) || (url.pathname === '/a/wa/song' && /^\d+$/.test(url.searchParams.get('id') || '')))) throw new Error('Paste an HTTPS link to a song on songsterr.com.');
  url.hash = ''; return url.href;
}
function songId(value) {
  const url = new URL(songsterrUrl(value));
  const id=Number(/-s(\d+)(?:t\d+)?\/?$/.exec(url.pathname)?.[1] || url.searchParams.get('id'));
  if(!Number.isSafeInteger(id) || id<=0)throw new Error('Invalid Songsterr song ID.');return id;
}
async function json(fetcher, url, budget) {
  const response = await fetcher(url, {redirect:'error',credentials:'omit',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
  if (!response.ok) throw Object.assign(new Error('Songsterr returned '+response.status+'. Please try again later.'),{status:response.status});
  if (Number(response.headers.get('content-length')) > budget.left) throw new Error('This song exceeds the 30 MB import limit.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Songsterr returned an empty response.');
  const chunks=[]; let length=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done)break;length+=value.length;if(length>budget.left)throw new Error('This song exceeds the 30 MB import limit.');chunks.push(value); } }
  catch(e){await reader.cancel();throw e;}
  let bytes=Buffer.concat(chunks,length);
  if(bytes[0]===0x1f && bytes[1]===0x8b) bytes=gunzipSync(bytes,{maxOutputLength:budget.left});
  budget.left-=bytes.length;if(budget.left<0)throw new Error('This song exceeds the 30 MB import limit.');
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Songsterr returned invalid song data.'); }
}
function videosFrom(data) {
  if(!Array.isArray(data))return [];
  const seen=new Set();
  return data.filter(v=>v && v.status==='done' && /^[\w-]{11}$/.test(v.videoId) && [null,undefined,'alternative','backing'].includes(v.feature) && Array.isArray(v.points) && v.points.length>=2 && v.points.length<=20000 && v.points.every(p=>Number.isFinite(p) && p>=0 && p<=604800))
    .sort((a,b)=>(a.feature==='backing'?2:a.feature?1:0)-(b.feature==='backing'?2:b.feature?1:0))
    .filter(v=>{if(seen.has(v.videoId))return false;seen.add(v.videoId);return true;})
    .slice(0,10).map(v=>({videoId:v.videoId,purpose:v.feature==='backing'?'backing':'full',points:v.points,tracks:Array.isArray(v.tracks)?v.tracks.filter(Number.isInteger):undefined}));
}
async function metadata(value,fetcher,budget) {
  const url=songsterrUrl(value),id=songId(url),meta=await json(fetcher,'https://www.songsterr.com/api/meta/'+id,budget);
  if(!meta || !Number.isSafeInteger(meta.revisionId) || meta.revisionId<=0 || !Array.isArray(meta.tracks) || !meta.tracks.length || meta.tracks.length>64 || typeof meta.title!=='string' || typeof meta.artist!=='string' || meta.title.length>1000 || meta.artist.length>1000 || meta.image && !/^[\w-]{1,200}$/.test(meta.image))throw new Error('This Songsterr song has no supported score.');
  return {url,songId:id,revisionId:meta.revisionId,meta};
}
async function getVideos(info,fetcher,budget) {
  return videosFrom(await json(fetcher,'https://www.songsterr.com/api/video-points/'+info.songId+'/'+info.revisionId+'/list',budget));
}
async function downloadSongsterr(value,fetcher=fetch) {
  const budget={left:MAX_TAB_BYTES},info=await metadata(value,fetcher,budget),tracks=[];
  const hosts=info.meta.image?.endsWith('-stage')?['d3d3l6a6rcgkaf']:info.meta.image?CDNS:LEGACY;
  let preferred=0;
  for(let part=0;part<info.meta.tracks.length;part++) {
    let track,lastError;
    for(const index of [preferred,...hosts.map((_,i)=>i).filter(i=>i!==preferred)]) {
      const partPath=info.meta.image?info.songId+'/'+info.revisionId+'/'+info.meta.image+'/'+part+'.json':'part/'+info.revisionId+'/'+part;
      try { track=await json(fetcher,'https://'+hosts[index]+'.cloudfront.net/'+partPath,budget);preferred=index;break; }
      catch(e){lastError=e;if(![403,404].includes(e.status))throw e;}
    }
    if(!track)throw lastError;
    if(!Array.isArray(track.measures) || !track.measures.length || track.measures.length>20000)throw new Error('Unsupported Songsterr track data.');
    tracks.push({...info.meta.tracks[part],...track});
  }
  let videos=[],syncWarning;
  try { videos=await getVideos(info,fetcher,budget); } catch { syncWarning='The tab was imported, but YouTube sync points are currently unavailable.'; }
  return {...info,meta:{title:info.meta.title,artist:info.meta.artist},tracks,videos,syncWarning};
}
// Concurrent clicks share one request; completed payloads are released immediately.
function importSongsterr(value,fetcher=fetch) {
  const url=songsterrUrl(value);if(pending.has(url))return pending.get(url);
  const task=downloadSongsterr(url,fetcher).finally(()=>pending.delete(url));pending.set(url,task);return task;
}
async function songsterrSync(value,fetcher=fetch) {
  const budget={left:MAX_TAB_BYTES},info=await metadata(value,fetcher,budget);
  return {url:info.url,songId:info.songId,revisionId:info.revisionId,videos:await getVideos(info,fetcher,budget)};
}
module.exports={songsterrUrl,songId,downloadSongsterr,importSongsterr,songsterrSync,MAX_TAB_BYTES};
