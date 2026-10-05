import {useEffect,useRef,useState} from 'react';
import type {model} from '@coderline/alphatab';
import {ArrowLeft,ArrowRight,Check,Dna,RotateCcw,Upload,Download,Layers,Replace,X} from 'lucide-react';
import type {Song} from './types';
import {Modal} from './ui';
import {ACCEPT,readScore} from './notation';
import {readWorkingScore} from './score-editing';
import {sectionsFor} from './library-model';
import {songsterrScore} from './songsterr-score';
import {spliceParts,commitSplice,undoSplice,type SpliceResult} from './splicing';
import SpliceComparison from './SpliceComparison';

export default function Splicer({song,dark,onSave,onClose}:{song:Song;dark:boolean;onSave:(song:Song)=>Promise<void>;onClose:()=>void}){
  const [score,setScore]=useState(()=>readWorkingScore(song)),[left,setLeft]=useState(song.trackIndex),[right,setRight]=useState(()=>song.tracks.find(t=>t.index!==song.trackIndex && t.strings)?.index ?? song.trackIndex);
  const [external,setExternal]=useState<{score:model.Score;name:string}>(),[url,setUrl]=useState(''),[start,setStart]=useState(1),[end,setEnd]=useState(song.bars),[sourceStart,setSourceStart]=useState(1);
  const [mode,setMode]=useState<'merge'|'overwrite'>('overwrite'),[preview,setPreview]=useState<SpliceResult>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [importOpen,setImportOpen]=useState(false),[jumpSection,setJumpSection]=useState('');
  const anchor=useRef(1);
  const scroll=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  const rightScore=external?.score || score,parts=(s:model.Score)=>s.tracks.filter(t=>t.staves[0]?.tuning.length && !t.isPercussion),sections=sectionsFor(song,left);
  const rightOffset=external && Number.isInteger(sourceStart) && sourceStart>=1 && sourceStart<=rightScore.masterBars.length && Number.isInteger(start) && start>=1 && start<=song.bars?sourceStart-start:0;
  const reset=()=>{setPreview(undefined);setError('');};
  function selectBars(bar:number,shift:boolean){
    if(preview || busy)return;
    const from=shift?Math.min(anchor.current,bar):bar,to=shift?Math.max(anchor.current,bar):bar;
    if(!shift)anchor.current=bar;
    setStart(from);setEnd(to);setJumpSection('');if(!external)setSourceStart(from);reset();
  }
  function jumpTo(id:string){
    const section=sections.find(s=>s.id===id);if(!section)return;
    anchor.current=section.start;setStart(section.start);setEnd(section.end);setJumpSection(id);if(!external)setSourceStart(section.start);reset();
    requestAnimationFrame(()=>scroll.current?.querySelector<HTMLElement>(`[data-bar="${section.start}"]`)?.scrollIntoView({block:'start',behavior:'smooth'}));
  }
  async function upload(file:File){
    reset();setBusy(true);
    try {if(file.size>30*1024*1024 || !ACCEPT.split(',').some(ext=>file.name.toLowerCase().endsWith(ext)))throw new Error('Choose a supported tab smaller than 30 MB.');const imported=readScore(new Uint8Array(await file.arrayBuffer()),file.name),first=parts(imported)[0];if(!first)throw new Error('This tab has no fretted instrument.');if(mounted.current){setExternal({score:imported,name:file.name});setRight(first.index);setSourceStart(1);}}
    catch(e){setError(e instanceof Error?e.message:'Could not read this tab.');}finally{if(mounted.current)setBusy(false);}
  }
  async function fetchTab(value=url){
    if(busy)return;reset();setBusy(true);
    try {if(!window.guitarIO?.downloadSongsterr)throw new Error('Songsterr import is available in the desktop app.');const data=await window.guitarIO.downloadSongsterr(value),imported=songsterrScore(data),first=parts(imported)[0];if(!first)throw new Error('This tab has no fretted instrument.');if(mounted.current){setExternal({score:imported,name:data.meta.title});setRight(first.index);setSourceStart(1);}}
    catch(e){setError(e instanceof Error?e.message:'Could not import this tab.');}finally{if(mounted.current)setBusy(false);}
  }
  function compare(direction:'left'|'right'){
    reset();
    try {
      if(!external && left===right)throw new Error('Choose two different instruments.');
      if(direction==='right' && external)throw new Error('The imported tab supplies notes to this song. Choose the left arrow.');
      const result=spliceParts(score,direction==='left'?rightScore:score,{destinationTrack:direction==='left'?left:right,sourceTrack:direction==='left'?right:left,start,end,sourceStart:external?sourceStart:start,mode});
      setPreview(result);
    }catch(e){setError(e instanceof Error?e.message:'Could not splice these parts.');}
  }
  async function save(){
    if(!preview)return;setBusy(true);
    try {await onSave(commitSplice(song,preview));onClose();}
    catch(e){setError(e instanceof Error?e.message:'Could not save this splice.');}finally{if(mounted.current)setBusy(false);}
  }
  async function undo(){
    if(preview){reset();return;}if(!song.spliceUndo)return;setBusy(true);
    try{const restored=undoSplice(song);await onSave(restored);setScore(readWorkingScore(restored));setError('');}
    catch(e){setError(e instanceof Error?e.message:'Could not undo this splice.');}finally{if(mounted.current)setBusy(false);}
  }
  const target=preview?.edit.track;
  return <Modal title="Splicer" subtitle={song.title} onClose={()=>{if(!busy)onClose();}} wide><div className="splicer">
    <div className="splicer-toolbar"><div className="segmented" aria-label="Splice mode">{(['overwrite','merge'] as const).map(value=><button key={value} className={mode===value?'active':''} disabled={busy || !!preview} aria-pressed={mode===value} title={value==='merge'?'Combine notes, omitting exact duplicates':'Replace the selected destination bars'} onClick={()=>{setMode(value);reset();}}>{value==='merge'?<Layers size={17}/>:<Replace size={17}/>} {value==='merge'?'Merge notes':'Overwrite bars'}</button>)}</div>
      <label>From bar<input aria-label="Splice start bar" type="number" min="1" max={song.bars} value={start} disabled={!!preview} onChange={e=>{setStart(Number(e.target.value));anchor.current=Number(e.target.value);setJumpSection('');if(!external)setSourceStart(Number(e.target.value));reset();}}/></label><label>To bar<input aria-label="Splice end bar" type="number" min={start} max={song.bars} value={end} disabled={!!preview} onChange={e=>{setEnd(Number(e.target.value));setJumpSection('');reset();}}/></label>
      <label>Jump to section<select aria-label="Splicer jump to section" disabled={!!preview} value={jumpSection} onChange={e=>jumpTo(e.target.value)}><option value="">Choose section</option>{sections.map(s=><option key={s.id} value={s.id}>{s.name} · {s.start}–{s.end}</option>)}</select></label>
      <button className={'icon-button '+(importOpen?'is-active':'')} title="Import a separate tab" aria-label="Import a separate tab" aria-expanded={importOpen} disabled={busy || !!preview} onClick={()=>setImportOpen(v=>!v)}><Upload size={20}/></button>
      <button className="icon-button" title="Undo merge" aria-label="Undo merge" disabled={busy || !preview && !song.spliceUndo} onClick={undo}><RotateCcw size={19}/></button>
    </div>
    {!preview && <><div className="splicer-parts"><label>Left part<select aria-label="Splicer left part" value={left} onChange={e=>{setLeft(Number(e.target.value));reset();}}>{parts(score).map(t=><option key={t.index} value={t.index}>{t.name}</option>)}</select></label><div className="splicer-arrows"><button className="icon-button" aria-label="Splice into left part" title="Preview splice into left part" disabled={busy} onClick={()=>compare('left')}><ArrowLeft size={22}/></button><Dna size={24}/><button className="icon-button" aria-label="Splice into right part" title={external?'Imported notes are copied into this song':'Preview splice into right part'} disabled={busy || !!external} onClick={()=>compare('right')}><ArrowRight size={22}/></button></div><label>Right part<select aria-label="Splicer right part" value={right} onChange={e=>{setRight(Number(e.target.value));reset();}}>{parts(rightScore).map(t=><option key={t.index} value={t.index}>{t.name}</option>)}</select></label></div>
    <input ref={fileInput} className="hidden" type="file" aria-label="Splicer separate tab file" accept={ACCEPT} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/>
    {importOpen && <div className="splicer-import"><button className="button secondary" disabled={busy} onClick={()=>fileInput.current?.click()}><Upload size={16}/>Upload separate tab</button><input aria-label="Splicer Songsterr URL" type="url" placeholder="Or paste a Songsterr URL" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)} onPaste={e=>{const value=e.clipboardData.getData('text').trim();if(value){e.preventDefault();setUrl(value);void fetchTab(value);}}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void fetchTab();}}}/><button className="icon-button" aria-label="Import separate Songsterr tab" title="Import separate Songsterr tab" disabled={busy || !url.trim()} onClick={()=>fetchTab()}><Download size={18}/></button></div>}
    {external && <div className="splicer-external"><span>{external.name}</span><label>Source starts at bar<input aria-label="Splicer imported start bar" type="number" min="1" max={rightScore.masterBars.length} value={sourceStart} onChange={e=>{setSourceStart(Number(e.target.value));reset();}}/></label><button className="icon-button" title="Use song parts" aria-label="Use song parts" onClick={()=>{setExternal(undefined);setRight(parts(score).find(t=>t.index!==left)?.index ?? left);reset();}}><X size={18}/></button></div>}</>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <div className="splicer-result-heading"><strong>Preview · {preview.score.tracks[target!].name} · bars {start}–{end}</strong>{preview.warnings.length>0 && <span className="form-error" role="status">{preview.warnings.length} bars highlighted for overlap or fingering review</span>}</div>}
    <div className={'splicer-scroll '+(preview?'result':'comparison')} ref={scroll}><SpliceComparison leftScore={preview?.score || score} leftTrack={target ?? left} rightScore={preview?undefined:rightScore} rightTrack={right} rightOffset={preview?0:rightOffset} start={start} end={end} dark={dark} onSelect={preview?undefined:selectBars}/></div>
    {preview && <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={reset}><ArrowLeft size={16}/>Back to comparison</button><button className="button primary" disabled={busy} onClick={save}><Check size={16}/>Save splice</button></div>}
  </div></Modal>;
}
