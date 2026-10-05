import {useEffect,useState} from 'react';
import {Gauge} from 'lucide-react';
import {steppedRate} from './playback-timing';

export default function SpeedControl({speed,bpm,rates,onChange}:{speed:number;bpm:number;rates?:number[];onChange:(v:number)=>void}){
  const [unit,setUnit]=useState<'percent'|'bpm'>('percent'),[entry,setEntry]=useState('');
  const minimum=rates?.length?rates[0]:.25,maximum=rates?.length?rates.at(-1)!:2;
  const display=(value:number,nextUnit=unit)=>String(Math.round(value*(nextUnit==='bpm'?bpm:100)*10)/10);
  useEffect(()=>setEntry(display(speed)),[speed,bpm,unit]);
  function commit(){const value=Number(entry);if(!Number.isFinite(value)||value<=0){setEntry(display(speed));return;}const next=steppedRate(value/(unit==='bpm'?bpm:100),rates,minimum,maximum);onChange(next);setEntry(display(next));}
  return <div className="speed-control speed-choice"><Gauge size={16}/><input className="speed-slider" aria-label="Playback speed slider" title="Adjust the whole song’s speed" type="range" min={minimum*100} max={maximum*100} step="5" value={speed*100} onChange={e=>onChange(steppedRate(Number(e.target.value)/100,rates,minimum,maximum))}/><input aria-label={unit==='percent'?'Playback speed':'Playback BPM'} title={unit==='bpm'?`Playback BPM · song reference ${Math.round(bpm*10)/10} BPM`:'Playback speed percentage'} type="number" min={minimum*(unit==='bpm'?bpm:100)} max={maximum*(unit==='bpm'?bpm:100)} step={unit==='bpm'?bpm/20:5} value={entry} onChange={e=>setEntry(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}}}/><button className="speed-unit" title="Switch between percentage and BPM" aria-label="Speed display unit" onClick={()=>{const next=unit==='percent'?'bpm':'percent';setUnit(next);setEntry(display(speed,next));}}>{unit==='percent'?'%':'BPM'}</button></div>;
}
