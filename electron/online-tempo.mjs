const normal=value=>String(value || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu,'');
const quote=value=>`"${value.replace(/[\\"]/g,' ')}"`;
let queue=Promise.resolve(),lastLookup=0;

export function tempoCandidates(recordings,song) {
  return recordings.filter(r=>Number(r.score)>=95 && /^[0-9a-f-]{36}$/i.test(r.id) && normal(r.title)===normal(song.title) && r['artist-credit']?.some(a=>normal(a.artist?.name || a.name)===normal(song.artist)) && !/live|demo|cover|karaoke|instrumental/i.test(r.disambiguation || '') && (!song.album || r.releases?.some(a=>normal(a.title)===normal(song.album))))
    .sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,2);
}
export function closestTempo(bpm,reference) {
  if(!Number.isFinite(bpm) || bpm<20 || bpm>400 || !Number.isFinite(reference) || reference<20 || reference>400)return;
  const value=[bpm/2,bpm,bpm*2].filter(n=>n>=20&&n<=400).sort((a,b)=>Math.abs(Math.log(a/reference))-Math.abs(Math.log(b/reference)))[0];
  if(value/reference<.75 || value/reference>1.25)return;
  return Math.round(value*100)/100;
}
/** Best-effort metadata lookup; never analyses, captures or changes audio/GP.
 * @returns {Promise<import('../src/types').OnlineTempo | undefined>}
 */
export async function lookupSongTempo(song,request=fetch) {
  if(!song || typeof song.title!=='string' || !song.title.trim() || song.title.length>500 || typeof song.artist!=='string' || !song.artist.trim() || song.artist==='Unknown artist' || song.artist.length>500 || typeof song.album!=='string' && song.album!==undefined || (song.album?.length || 0)>500 || !Number.isFinite(song.bpm) || song.bpm<20 || song.bpm>400)return;
  const task=queue.catch(()=>{}).then(async()=>{
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,lastLookup+1100-Date.now())));lastLookup=Date.now();
    const signal=AbortSignal.timeout(12000),query=new URLSearchParams({query:`recording:${quote(song.title)} AND artist:${quote(song.artist)}`,fmt:'json',limit:'10'});
    const options={signal,credentials:'omit',headers:{Accept:'application/json'}};
    const response=await request(`https://musicbrainz.org/ws/2/recording/?${query}`,options);
    if(!response.ok)return;
    const result=await response.json();
    const matches=tempoCandidates(Array.isArray(result.recordings)?result.recordings:[],song);
    if(!matches.length)return;
    const features=new URLSearchParams({recording_ids:matches.map(m=>m.id).join(';'),features:'rhythm.bpm'});
    const acoustic=await request(`https://acousticbrainz.org/api/v1/low-level?${features}`,options);
    if(!acoustic.ok)return;
    const data=await acoustic.json();
    for(const match of matches){
      const bpm=closestTempo(data[match.id]?.['0']?.rhythm?.bpm,song.bpm);
      if(bpm)return{bpm,recordingId:match.id,source:'AcousticBrainz',fetchedAt:new Date().toISOString(),enabled:true};
    }
  }).catch(()=>undefined);
  queue=task;return task;
}
