import {Star} from 'lucide-react';
import {useEffect,useId,useState,type MouseEvent,type FocusEvent} from 'react';
import {createPortal} from 'react-dom';
import type {LibrarySong,Progress} from './types';
import {songProgressSplit,songIsMastered} from './library-model';

const labels:Record<Progress,string>={mastered:'Mastered',comfortable:'Learnt',learning:'Learning',new:'Not attempted yet'};
export function SongProgressBar({song,className=''}:{song:LibrarySong;className?:string}){
  const split=songProgressSplit(song),states=Object.keys(labels) as Progress[];
  const id=useId(),[tooltip,setTooltip]=useState<{left:number;top:number;below:boolean}>();
  const text=(state:Progress)=>`${labels[state]} ${Number(split[state].toFixed(1))}%`;
  function show(event:MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>){const bounds=event.currentTarget.getBoundingClientRect();setTooltip({left:Math.max(112,Math.min(innerWidth-112,bounds.x+bounds.width/2)),top:bounds.top<130?bounds.bottom+10:bounds.top-10,below:bounds.top<130});}
  useEffect(()=>{if(!tooltip)return;const hide=()=>setTooltip(undefined);window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);return()=>{window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);};},[tooltip]);
  return <><div className={`song-progress-rail ${className}`} role="img" tabIndex={0} aria-label={`Learning progress: ${states.map(text).join(', ')}`} aria-describedby={tooltip?id:undefined} onMouseEnter={show} onMouseLeave={()=>setTooltip(undefined)} onFocus={show} onBlur={()=>setTooltip(undefined)}>
    {states.map(state=><i key={state} data-status={state} style={{width:`${split[state]}%`}} aria-hidden="true"/>)}
  </div>{tooltip && createPortal(<div id={id} role="tooltip" className={`song-progress-tooltip ${tooltip.below?'below':''}`} style={{left:tooltip.left,top:tooltip.top}}>{states.map(state=><div key={state}><i data-status={state}/><span>{labels[state]}</span><strong>{Number(split[state].toFixed(1))}%</strong></div>)}</div>,document.fullscreenElement || document.body)}</>;
}
export function MasteredStamp({song}:{song:LibrarySong}){
  return songIsMastered(song)?<span className="mastered-stamp" role="img" aria-label={`${song.title} fully mastered`} title="Fully mastered"><Star size={22} fill="currentColor"/></span>:null;
}
