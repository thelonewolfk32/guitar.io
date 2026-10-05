import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AlphaTabApi, model } from '@coderline/alphatab';
import { ArrowUpDown, Undo2, Download, Check, Settings2, RotateCcw } from 'lucide-react';
import type { Range, Song, ScoreAnnotation } from './types';
import { Modal } from './ui';
import { sectionsFor, withSections } from './library-model';
import { download } from './notation';
import { allNotes, changeNote, changeFrets, noteIssue, exportEditedScore, noteFromKey, noteKey, noteLabel, pitchName, readWorkingScore, retuneScore, restoreOriginalTuning, suggestFingerings, type FingeringSuggestion } from './score-editing';
import TuningPicker from './TuningPicker';
import { auditionPitches } from './tunings';
import { compareNotes, notesInRect, type SelectionRect } from './note-selection';
import { enterFretDigit, type FretEntry } from './fret-entry';
import SectionMenu from './SectionMenu';
import SheetAnnotation, { type VisibleAnnotation } from './SheetAnnotation';
import {fretOnString} from './score-editing';

type Box = { bar: number; x: number; y: number; width: number; height: number };
type NoteBox = { key: string; note: model.Note; x: number; y: number; width: number; height: number };
type EditKind = 'fret' | 'fingering';
type Snapshot = { time?:number } & Partial<Pick<Song, 'noteEdits' | 'tempoEdits' | 'bpm' | 'tuningEdits' | 'tuningCompensation' | 'tuningNoteCompensation' | 'sourceTunings' | 'annotations' | 'annotationPositions' | 'sectionsByTrack' | 'tracks' | 'tuning'>>;

export default function NotationTools({ song, score, api, boxes, revision, rendering, range, onSave, notify, selectionRevision, onRange, container, toolbar, settingsOpen, sectionUndoTime, onUndoSection }: { song: Song; score: model.Score | null; api: AlphaTabApi | null; boxes: Box[]; revision: number; rendering: boolean; range: Range; onSave: (song: Song) => Promise<void>; notify: (text: string, error?: boolean) => void; toolbar: HTMLDivElement | null; settingsOpen:boolean; sectionUndoTime:number; onUndoSection:()=>Promise<void>; selectionRevision: number; onRange: (r: Range) => void; container: HTMLDivElement | null }) {
  const [keys, setKeys] = useState<string[]>([]), [action, setAction] = useState<EditKind | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [tuningOpen,setTuningOpen]=useState(false),[newAnnotation,setNewAnnotation]=useState<ScoreAnnotation | null>(null),[busy,setBusy]=useState(false);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const latest = useRef(song), pending = useRef(0), queue = useRef(Promise.resolve());
  if (!pending.current) latest.current = song;
  const entry = useRef<FretEntry | null>(null);
  useEffect(() => { setKeys([]); entry.current = null; }, [selectionRevision]);
  useEffect(() => {
    const typeFret = (event: KeyboardEvent) => {
      if (!/^\d$/.test(event.key) || !keys.length || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]') || document.querySelector('[role="dialog"],[role="menu"]')) return;
      event.preventDefault();
      entry.current = enterFretDigit(entry.current, event.key, performance.now(), keys.join(','));
      try {
        const before = latest.current, next = changeFrets(before, keys, Number(entry.current.digits));
        const working = readWorkingScore(next);
        void auditionPitches(keys.flatMap(key => { const note = noteFromKey(working, key); return note && note.realValue >= 0 && note.realValue <= 127 ? [note.realValue] : []; }), working.tracks[song.trackIndex]?.playbackInfo.program ?? 25).catch(() => notify('Note preview is unavailable. Try again.', true));
        api?.pause(); void commit(next).catch(e => notify(String(e), true));
      } catch (e) { notify(String(e), true); }
    };
    window.addEventListener('keydown', typeFret);
    return () => window.removeEventListener('keydown', typeFret);
  }, [keys, api, onSave, notify]);
  const noteAnchor = useRef('');
  const noteBoxes = useMemo(() => {
    const result: NoteBox[] = [];
    if (!score || !api || rendering) return result;
    for (const n of allNotes(score).filter(n => n.beat.voice.bar.staff.track.index === song.trackIndex).sort(compareNotes)) {
      for (const beat of api.boundsLookup?.findBeats?.(n.beat) || []) for (const b of beat.notes || []) if (b.note === n || b.note.id === n.id) result.push({ key: noteKey(n), note: n, x: b.noteHeadBounds.x, y: b.noteHeadBounds.y, width: Math.max(b.noteHeadBounds.w, 12), height: Math.max(b.noteHeadBounds.h, 16) });
    }
    return result;
  }, [score, api, revision, rendering, song.trackIndex]);
  const [marquee, setMarquee] = useState<SelectionRect | null>(null);
  const suppressClick = useRef(false);
  const gestureState = useRef({ keys, noteBoxes, onRange, boxes });
  gestureState.current = { keys, noteBoxes, onRange, boxes };
  useEffect(() => {
    if (!container || rendering) return;
    let drag: { startX: number; startY: number; clientX: number; clientY: number; pointer: number; moved: boolean; base: string[]; boxes: NoteBox[]; selected: string[]; startKey: string; startBar?: number; endBar?: number } | null = null;
    let frame = 0;
    const scroller = container.closest('.score-paper') as HTMLElement | null;
    const update = () => {
      if (!drag?.moved) return;
      const bounds = container.getBoundingClientRect();
      const x = drag.clientX - bounds.left, y = drag.clientY - bounds.top;
      const rect = { x: Math.min(drag.startX, x), y: Math.min(drag.startY, y), width: Math.abs(x - drag.startX), height: Math.abs(y - drag.startY) };
      setMarquee(rect);
      drag.selected = [...new Set([...drag.base, ...(drag.startKey ? [drag.startKey] : []), ...notesInRect(drag.boxes, rect)])];
      drag.endBar = gestureState.current.boxes.find(b => x >= b.x && x <= b.x + b.width && y >= b.y - 6 && y <= b.y + b.height + 6)?.bar || drag.endBar;
      setKeys(drag.selected);
    };
    const scroll = () => {
      if (!drag?.moved) return;
      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        const distance = drag.clientY < bounds.top + 35 ? -10 : drag.clientY > bounds.bottom - 35 ? 10 : 0;
        if (distance) { scroller.scrollTop += distance; update(); }
      }
      frame = requestAnimationFrame(scroll);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('.sheet-annotation,a') || !container.contains(event.target)) return;
      if (!event.target.closest('.note-hit,.bar-overlay')) event.preventDefault();
      const bounds = container.getBoundingClientRect();
      suppressClick.current = false;
      drag = { startX: event.clientX - bounds.left, startY: event.clientY - bounds.top, clientX: event.clientX, clientY: event.clientY, pointer: event.pointerId, moved: false, base: event.ctrlKey || event.metaKey ? [...gestureState.current.keys] : [], boxes: gestureState.current.noteBoxes, selected: [], startKey: event.target.closest<HTMLElement>('.note-hit')?.dataset.noteKey || '', startBar: gestureState.current.boxes.find(b => event.clientX - bounds.left >= b.x && event.clientX - bounds.left <= b.x + b.width && event.clientY - bounds.top >= b.y - 6 && event.clientY - bounds.top <= b.y + b.height + 6)?.bar };
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 5) return;
      if (!drag.moved) { drag.moved = true; container.setPointerCapture(event.pointerId); frame = requestAnimationFrame(scroll); }
      event.preventDefault();
      drag.clientX = event.clientX; drag.clientY = event.clientY; update();
    };
    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      cancelAnimationFrame(frame);
      if (drag.moved) {
        suppressClick.current = true;
        if (drag.selected.length) {
          noteAnchor.current = drag.startKey || drag.selected[0]; entry.current = null;
          const bars = drag.selected.map(k => Number(k.split(':')[2]) + 1);
          gestureState.current.onRange({ start: Math.min(...bars), end: Math.max(...bars) });
        } else if (drag.startBar && drag.endBar) {
          gestureState.current.onRange({ start: Math.min(drag.startBar, drag.endBar), end: Math.max(drag.startBar, drag.endBar) });
        }
        if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      }
      drag = null; setMarquee(null);
    };
    container.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    return () => { cancelAnimationFrame(frame); container.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, [container, rendering]);
  const selected = keys;
  const sections = sectionsFor(song);
  const annotations: VisibleAnnotation[] = [];
  for (const section of sections) {
    const box = boxes.find(b => b.bar === section.start);
    if (box && section.notes.trim()) annotations.push({ id: `section:${song.trackIndex}:${section.id}`, text: section.notes, color: section.color, anchor: { x: box.x + 35, y: box.y - 65 }, name: section.name });
  }
  for (const annotation of [...(song.annotations || []), ...(newAnnotation ? [newAnnotation] : [])]) {
    if (annotation.track !== song.trackIndex) continue;
    const bar = boxes.find(b => b.bar === annotation.bar), note = annotation.noteKey && noteBoxes.find(b => b.key === annotation.noteKey);
    if (bar) annotations.push({ id: annotation.id, text: annotation.text, color: annotation.color, anchor: annotation.free ? {x:8,y:8} : note ? { x: note.x + 20, y: note.y - 65 } : { x: bar.x + 35, y: bar.y - 65 }, name: 'Text' });
  }
  function commit(next: Song) {
    const before: Snapshot = { time: Date.now() };
    for (const key of ['noteEdits', 'tempoEdits', 'bpm', 'tuningEdits', 'tuningCompensation', 'tuningNoteCompensation', 'sourceTunings', 'annotations', 'annotationPositions', 'sectionsByTrack', 'tracks', 'tuning'] as const) if (next[key] !== latest.current[key]) Object.assign(before, { [key]: latest.current[key] });
    // Keep following gestures on this edit while its IndexedDB save is pending.
    latest.current = next; pending.current++; setBusy(true);
    const saving = queue.current.then(async () => {
      await onSave(next);
      setUndo(previous => [...previous.slice(-19), before]);
    }).finally(() => { pending.current--; if (!pending.current) setBusy(false); });
    queue.current = saving.catch(() => {});
    return saving;
  }
  async function undoEdit() {
    const previous=undo.at(-1);if(busy)return;
    if(sectionUndoTime && sectionUndoTime>=(previous?.time || 0)){await onUndoSection();return;}
    if(!previous)return;
    setBusy(true);
    try {
      const {time:_time,...snapshot}=previous;const restored={...song,...snapshot}; readWorkingScore(restored);
      await onSave(restored);
      setUndo(v => v.slice(0, -1)); notify('Notation edit undone.');
    } catch (e) { notify(String(e), true); } finally { setBusy(false); }
  }
  function selectNote(key: string, event: React.MouseEvent, context = false) {
    if (suppressClick.current && !context) { suppressClick.current = false; return; }
    if (context && selected.includes(key)) return;
    entry.current = null;
    const ordered = [...new Set(noteBoxes.map(b => b.key))];
    let next: string[];
    if (event.shiftKey && noteAnchor.current && ordered.includes(noteAnchor.current)) {
      const a = ordered.indexOf(noteAnchor.current), b = ordered.indexOf(key); next = ordered.slice(Math.min(a, b), Math.max(a, b) + 1);
    } else if (event.ctrlKey || event.metaKey) { next = keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]; noteAnchor.current = key; }
    else { next = [key]; noteAnchor.current = key; }
    setKeys(next);
    const bars = (next.length ? next : [key]).map(k => Number(k.split(':')[2]) + 1);
    onRange({ start: Math.min(...bars), end: Math.max(...bars) });
  }
  function annotate(point?:{x:number;y:number;bar?:number}) {
    const bounds=container?.getBoundingClientRect();
    const box=boxes.find(b=>b.bar===range.start);
    const annotation:ScoreAnnotation={id:`annotation:${crypto.randomUUID()}`,track:song.trackIndex,bar:point?.bar || range.start,text:'',color:'#efc666',free:true};
    const position={x:Math.max(0,point && bounds?point.x-bounds.left-8:(box?.x || 0)+35),y:Math.max(0,point && bounds?point.y-bounds.top-8:(box?.y || 60)-55)};
    setNewAnnotation(annotation);
    void commit({...latest.current,annotationPositions:{...latest.current.annotationPositions,[annotation.id]:position}}).catch(e=>notify(String(e),true));
  }
  useEffect(()=>{const add=(e:Event)=>annotate((e as CustomEvent).detail);window.addEventListener('guitario-annotate',add);return()=>window.removeEventListener('guitario-annotate',add);},[container,range,boxes]);
  async function updateAnnotation(item:VisibleAnnotation,patch:{text?:string;color?:string}) {
    const base=latest.current,section=sectionsFor(base).find(s=>`section:${base.trackIndex}:${s.id}`===item.id);
    const original=(base.annotations || []).find(a=>a.id===item.id) || newAnnotation;
    const text=patch.text ?? original?.text ?? section?.notes ?? item.text,color=patch.color ?? original?.color ?? item.color;
    const next=section?withSections(base,sectionsFor(base).map(s=>s.id===section.id?{...s,notes:text}:s)):{...base,annotations:[...(base.annotations || []).filter(a=>a.id!==item.id),...(text.trim() && original?[{...original,text:text.trim(),color}]:[])]};
    try{await commit(next);if(newAnnotation?.id===item.id)setNewAnnotation(null);}catch(e){notify(String(e),true);}
  }
  return <>
    {toolbar && createPortal(<><button className={`icon-button ${tuningOpen?'is-active':''}`} aria-label="Change instrument tuning" title="Change instrument tuning" disabled={!score || busy} onClick={()=>setTuningOpen(true)}><ArrowUpDown size={18}/></button><button className="icon-button" aria-label="Undo notation edit" title="Undo notation edit" disabled={(!undo.length && !sectionUndoTime) || busy} onClick={undoEdit}><Undo2 size={18}/></button></>,toolbar)}
    {tuningOpen && score && <TuningDialog song={song} score={score} onSave={commit} onClose={()=>setTuningOpen(false)}/>}
    
    {container && !rendering && createPortal(<>
      {marquee && <div className="note-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />}
      {noteBoxes.map((b, i) => <button key={`${b.key}:${i}`} data-note-key={b.key} className={`note-hit ${selected.includes(b.key) ? 'selected' : ''} ${noteIssue(b.note, song) ? 'invalid-note' : ''}`} aria-label={`Select note: ${noteLabel(b.note)}`} aria-pressed={selected.includes(b.key)} title={noteIssue(b.note, song) || noteLabel(b.note)} style={{ left: b.x - 3, top: b.y - 3, width: b.width + 6, height: b.height + 6 }} onClick={e => selectNote(b.key, e)} onDoubleClick={() => setAction('fret')} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); selectNote(b.key, e, true); setMenu({ x: e.clientX, y: e.clientY }); }} />)}
      {annotations.map(item=><SheetAnnotation key={item.id} item={item} position={song.annotationPositions?.[item.id]} onText={text=>updateAnnotation(item,{text})} onColor={color=>updateAnnotation(item,{color})} onMove={async position=>{await commit({...latest.current,annotationPositions:{...latest.current.annotationPositions,[item.id]:position}}).catch(e=>notify(String(e),true));}}/>)}
    </>, container)}
    {menu && <SectionMenu label="Note actions" x={menu.x} y={menu.y} onClose={() => setMenu(null)} actions={[
      { label: 'Edit fret / string', disabled: selected.length !== 1, run: () => setAction('fret') },
      { label: 'Suggest alternate fingerings', disabled: !selected.length, run: () => setAction('fingering') },
      { label: 'Add text note', run: ()=>annotate(menu) },
      { label: 'Clear note selection', run: () => setKeys([]) },
    ]} />}
    {action && score && <NoteEditDialog key={action} action={action} song={song} score={score} selected={selected} range={range} onSave={commit} onClose={() => setAction(null)} />}

  </>;
}

function NoteEditDialog({ action, song, score, selected, range, onSave, onClose }: { action: EditKind; song: Song; score: model.Score; selected: string[]; range: Range; onSave: (song: Song) => Promise<void>; onClose: () => void }) {
  const notes = allNotes(score), first = selected[0] ? noteFromKey(score, selected[0]) : undefined;
  const staff = score.tracks[song.trackIndex]?.staves.find(s => s.tuning.length);
  const [fret, setFret] = useState(first?.fret || 0), [string, setString] = useState(first?.string || 1);
  const [minFret, setMinFret] = useState(0), [maxFret, setMaxFret] = useState(12);
  const [suggestion, setSuggestion] = useState<FingeringSuggestion | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function apply() {
    setError(''); setBusy(true);
    try {
      const next = action === 'fret' ? changeNote(song, selected[0], fret, string) : action === 'fingering' ? suggestion?.song : undefined;
      if (!next) throw new Error('Preview a fingering suggestion first.');
      await onSave(next); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const title = action === 'fret' ? 'Edit note' : 'Alternate fingerings';
  function moveString(value:number){
    if(!first)return;
    try{
      if(first.harmonicType===window.alphaTab.model.HarmonicType.Natural)throw new Error('A natural harmonic needs its node adjusted when moving strings. Choose a non-harmonic note for automatic pitch preservation.');
      const adjusted=fretOnString(first.beat.voice.bar.staff.tuning,string,fret,value);
      changeNote(song,selected[0],adjusted,value);setString(value);setFret(adjusted);setError('');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  }
  return <Modal title={title} subtitle={first ? noteLabel(first) : score.tracks[song.trackIndex]?.name} onClose={() => { if (!busy) onClose(); }} wide={action === 'fingering'}><form onSubmit={e => { e.preventDefault(); void apply(); }}>
    {action === 'fret' && <>{first?.isStringed ? <><div className="range-inputs"><label>String<select aria-label="Note string" value={string} onChange={e => moveString(Number(e.target.value))}>{first.beat.voice.bar.staff.tuning.map((pitch, index, pitches) => <option key={index} value={pitches.length - index}>{index + 1} · {pitchName(pitch)}</option>)}</select></label><label>Fret<input aria-label="Note fret" type="number" min="-1000" max="1000" value={fret} onChange={e => setFret(Number(e.target.value))} /></label></div><p className="import-explainer">Changing strings adjusts the fret to keep the same pitch in the current tuning. Editing the fret changes the pitch. Connected ties are updated together.</p>{(fret<0 || fret>36) && <p className="form-error">Keeping this pitch requires fret {fret}, outside the playable 0–36 range. Choose another string or adjust the note.</p>}</> : <p>Direct fret editing requires tablature.</p>}</>}
    {action === 'fingering' && <><div className="range-inputs"><label>Lowest fret<input aria-label="Lowest fret" type="number" min="0" max="36" value={minFret} onChange={e => { setMinFret(Number(e.target.value)); setSuggestion(null); }} /></label><label>Highest fret<input aria-label="Highest fret" type="number" min="0" max="36" value={maxFret} onChange={e => { setMaxFret(Number(e.target.value)); setSuggestion(null); }} /></label></div><p className="import-explainer">Keeps the same pitches and favours smaller hand movements inside this neck region. Chords cannot share a string. Suggestions are a starting point; they don't model your hand or playing style.</p><button type="button" className="button secondary" onClick={() => { setError(''); try { setSuggestion(suggestFingerings(song, selected, minFret, maxFret)); } catch (e) { setSuggestion(null); setError(e instanceof Error ? e.message : String(e)); } }}>Preview fingerings</button>{suggestion && <><p>{suggestion.changes.length ? `${suggestion.changes.length} ${suggestion.changes.length === 1 ? 'note' : 'notes'} will move.` : 'The current fingering already fits this suggestion.'}</p><div className="fingering-preview">{suggestion.changes.slice(0, 30).map(c => <p key={c.key}>{c.from} → <strong>{c.to}</strong></p>)}{suggestion.changes.length > 30 && <p>…and {suggestion.changes.length - 30} more.</p>}</div></>}{staff && maxFret >= minFret && maxFret - minFret <= 24 && <Fretboard tuning={staff.tuning} min={minFret} max={maxFret} song={suggestion?.song || song} keys={selected} />}</>}

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || (action === 'fingering' && !suggestion) || (action === 'fret' && !first?.isStringed)}><Check size={15} />{busy ? 'Saving…' : 'Apply notation edit'}</button></div>
  </form></Modal>;
}
function TuningDialog({song,score,onSave,onClose}:{song:Song;score:model.Score;onSave:(s:Song)=>Promise<void>;onClose:()=>void}) {
  const track=score.tracks[song.trackIndex],staff=track?.staves.find(s=>s.tuning.length);
  const [tuning,setTuning]=useState([...(staff?.tuning || [])].reverse()),[keepPitch,setKeepPitch]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function apply(restore=false){setBusy(true);setError('');try{await onSave(restore?restoreOriginalTuning(song):retuneScore(song,tuning,keepPitch));onClose();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  return <Modal title="Change instrument tuning" onClose={()=>{if(!busy)onClose();}}><form onSubmit={e=>{e.preventDefault();void apply();}}>
    {staff && <div className="tuning-string-count" role="group" aria-label="Instrument strings"><span>Strings</span>{(track.playbackInfo.program>=32 && track.playbackInfo.program<=39?[4,5,6]:[6,7,8]).map(count=><button type="button" key={count} aria-label={`${count} strings`} aria-pressed={tuning.length===count} onClick={()=>{const pitches=[...tuning].reverse();while(pitches.length<count)pitches.push(Math.max(0,pitches.at(-1)!-5));setTuning(pitches.slice(0,count).reverse());}}>{count}</button>)}</div>}
    {staff ? <TuningPicker pitches={tuning} onChange={setTuning} bass={track.playbackInfo.program>=32 && track.playbackInfo.program<=39} quiet/> : <p>Select a guitar or bass instrument first.</p>}
    <details className="tuning-options"><summary aria-label="Tuning options"><Settings2 size={18}/></summary><label>When changing tuning<select aria-label="Retuning behavior" value={keepPitch?'pitch':'shape'} onChange={e=>setKeepPitch(e.target.value==='pitch')}><option value="pitch">Keep pitches; adjust fret numbers</option><option value="shape">Keep fret numbers; change pitches</option></select></label><p className="import-explainer">Changes all fretted instruments. Other string counts retain their intervals and follow the lowest string's shift. The selected instrument can change string count. Other parts retain their counts. Capo remains unchanged. Red notes need review. Recordings retain their original pitch.</p><button className="text-button" type="button" onClick={()=>{try{download(`${song.title}-edited.gp`,new Uint8Array(exportEditedScore(song)),'application/octet-stream');}catch(e){setError(String(e));}}}><Download size={14}/>Export edited GP</button></details>
    {Object.keys(song.tuningEdits || {}).length>0 && <button type="button" className="text-button restore-tuning" disabled={busy} onClick={()=>void apply(true)}><RotateCcw size={15}/>Restore original tuning</button>}
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !staff}><Check size={15}/>{busy?'Saving…':'Apply tuning'}</button></div>
  </form></Modal>;
}
function Fretboard({ tuning, min, max, song, keys }: { tuning: number[]; min: number; max: number; song: Song; keys: string[] }) {
  const score = readWorkingScore(song), notes = keys.map(k => noteFromKey(score, k)).filter((n): n is model.Note => !!n);
  const frets = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return <div className="fretboard" aria-label="Selected notes on fretboard" style={{ gridTemplateColumns: `45px repeat(${frets.length},minmax(24px,1fr))` }}><span />{frets.map(f => <span key={f}>{f}</span>)}{tuning.flatMap((pitch, index) => [<strong key={`string-${index}`}>{pitchName(pitch)}</strong>, ...frets.map(f => <span key={`${index}:${f}`} className={`fret-cell ${notes.some(n => n.string === tuning.length - index && n.fret === f) ? 'occupied' : ''}`}>{notes.some(n => n.string === tuning.length - index && n.fret === f) ? '●' : '─'}</span>)])}</div>;
}
