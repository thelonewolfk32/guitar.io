import {useState} from 'react';
import {Download,Plus,Trash2,Link} from 'lucide-react';
import type {Song,Recording,YouTubeSync} from './types';
import {videoSync} from './songsterr-score';

export default function YouTubeSyncEditor({song,recording,value,onChange,disabled}:{song:Song;recording:Recording;value:YouTubeSync|undefined;onChange:(v:YouTubeSync|undefined)=>void;disabled:boolean}){
  const [url,setUrl]=useState(song.songsterr?.url || ''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  if(recording.kind!=='youtube' || recording.purpose==='instructional')return null;
  const videoId=recording.videoId;
  async function fetchPoints(){
    if(!window.guitarIO?.songsterrSync){setMessage('Sync lookup is available in the desktop app.');return;}
    setBusy(true);setMessage('');
    try {
      const data=await window.guitarIO.songsterrSync(url),video=data.videos.find(v=>v.videoId===videoId);
      if(!video)throw new Error('No published sync points match this exact YouTube video. You can add your own bar timestamps below.');
      if(song.songsterr && data.revisionId!==song.songsterr.revisionId)throw new Error('The Songsterr arrangement has changed since import. Import the new revision separately, or add timestamps for your current tab.');
      const sync=videoSync(data,video,song.bars);if(sync.points.length<2)throw new Error('No usable bar timestamps were found.');
      onChange(sync);setMessage('Loaded '+sync.points.length+' bar timestamps. Check the arrangement before saving.');
    }catch(e){setMessage(e instanceof Error?e.message:'Sync lookup is unavailable.');}finally{setBusy(false);}
  }
  function edit(index:number,key:'bar'|'seconds'|'occurrence',number:number){
    if(!value)return;onChange({...value,source:'manual',points:value.points.map((p,i)=>i===index?{...p,[key]:number}:p)});
  }
  return <details className="youtube-sync-editor" aria-label="YouTube sync points">
    <summary title="Expand YouTube sync points"><Link size={16}/>YouTube sync points<span>{value?.points.length || 0}</span></summary><div className="sync-editor-content">
    <div className="youtube-sync-fetch"><input aria-label="Songsterr link for YouTube sync" type="url" placeholder="Songsterr URL" value={url} onChange={e=>setUrl(e.target.value)}/><button className="icon-button" title="Fetch sync points" aria-label="Fetch sync points" disabled={disabled || busy || !url.trim()} onClick={fetchPoints}><Download size={18}/></button></div>
    {value && <label className="online-tempo-choice"><input type="checkbox" aria-label="Use YouTube sync points" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/>Use bar timestamps · {value.points.length} points</label>}
    {value && <div className="youtube-sync-list"><div className="youtube-sync-row heading"><span>Bar</span><span>Pass</span><span>Video seconds</span><span/></div>{value.points.map((p,i)=><div className="youtube-sync-row" key={i}><input aria-label={'Sync bar '+(i+1)} type="number" min="1" max={song.bars} value={p.bar} onChange={e=>edit(i,'bar',Number(e.target.value))}/><input aria-label={'Sync pass '+(i+1)} type="number" min="1" max="100" value={(p.occurrence || 0)+1} onChange={e=>edit(i,'occurrence',Number(e.target.value)-1)}/><input aria-label={'Sync seconds '+(i+1)} type="number" min="-3600" max="604800" step=".01" value={p.seconds} onChange={e=>edit(i,'seconds',Number(e.target.value))}/><button className="icon-button" aria-label={'Remove sync point '+(i+1)} title="Remove sync point" onClick={()=>onChange({...value,source:'manual',points:value.points.filter((_,n)=>n!==i)})}><Trash2 size={15}/></button></div>)}</div>}
    <button className="button secondary" disabled={disabled || busy || (value?.points.length || 0)>=20000} onClick={()=>onChange(value?{...value,source:'manual',points:[...value.points,{bar:Math.min(song.bars,(value.points.at(-1)?.bar || 0)+1),seconds:(value.points.at(-1)?.seconds || recording.offsetSeconds)+2}]}:{source:'manual',enabled:true,videoId:recording.videoId,points:[{bar:1,seconds:Math.max(0,recording.offsetSeconds)}]})}><Plus size={16}/>Add sync point</button>
    {value?.points.length && value.points.at(-1)!.bar<song.bars?<p className="media-help">Bars after {value.points.at(-1)!.bar} use the last measured timing interval.</p>:null}
    {message && <p role="status" className="media-help">{message}</p>}
  </div></details>;
}
