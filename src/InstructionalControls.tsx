import { useEffect, useState } from 'react';
import { Play, Pause, Gauge } from 'lucide-react';
import type { MediaAdapter } from './media-bridge';
import { formatTimestamp } from './instructional';

export default function InstructionalControls({ adapter }: { adapter?: MediaAdapter }) {
  const [position,setPosition]=useState(0), [playing,setPlaying]=useState(false), [duration,setDuration]=useState(0), [rate,setRate]=useState(1);
  useEffect(()=>{
    const update=()=>{setPosition(adapter?.currentTime || 0);setPlaying(!!adapter && !adapter.paused);setDuration(adapter?.duration || 0);setRate(adapter?.playbackRate || 1);};
    update();const timer=setInterval(update,150);
    const key=(event:KeyboardEvent)=>{if(event.code!=='Space' || event.ctrlKey || event.altKey || event.metaKey)return;event.preventDefault();event.stopImmediatePropagation();if(!event.repeat && adapter){if(adapter.paused)void adapter.play();else adapter.pause();update();}};
    window.addEventListener('keydown',key,true);
    return ()=>{clearInterval(timer);window.removeEventListener('keydown',key,true);};
  },[adapter]);
  return <div className="instructional-transport" aria-label="Instructional playback">
    <button className="play-button" aria-label={playing?'Pause instructional video':'Play instructional video'} disabled={!adapter} onClick={()=>{if(adapter?.paused)void adapter.play();else adapter?.pause();}}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button>
    <span className="instructional-time">{formatTimestamp(position)} <span>/ {formatTimestamp(duration)}</span></span>
    <input className="scrubber" aria-label="Scrub instructional video" type="range" min="0" max={duration || 1} step="1" value={Math.min(position,duration || 1)} disabled={!adapter || !duration} onChange={e=>{const value=Number(e.target.value);adapter?.seek(value);setPosition(value);}}/>
    <label className="speed-control"><Gauge size={15}/><select aria-label="Instructional playback speed" value={rate} disabled={!adapter} onChange={e=>{if(adapter)adapter.playbackRate=Number(e.target.value);setRate(Number(e.target.value));}}>{(adapter?.playbackRates?.length?adapter.playbackRates:[0.25,0.5,0.75,1,1.25,1.5,2]).map(value=><option key={value} value={value}>{Math.round(value*100)}%</option>)}</select></label>
  </div>;
}
