import { useEffect, useMemo, useState } from 'react';
import { AudioLines, RefreshCw, Volume2, ArrowLeft, Check } from 'lucide-react';
import type { Song } from './types';
import { readSong } from './storage';
import { sectionsFor } from './library-model';
import { baseTuning, midiName, PITCH_CLASSES } from './tunings';
import { auditionPitches } from './preview-audio';
import TuningPicker from './TuningPicker';
import { analyseSong, handPositions, noteFit, pitchClass, scalePitches, SCALES, suggestScales } from './learn-model';

export default function Learn() {
  useEffect(()=>{document.title='Learn · Guitar.io';},[]);
  const [songs,setSongs] = useState<Song[]>([]), [songId,setSongId] = useState(new URLSearchParams(location.search).get('song') || ''), [currentId,setCurrentId]=useState(new URLSearchParams(location.search).get('song') || '');
  const [track,setTrack] = useState(0), [section,setSection] = useState(''), [root,setRoot] = useState(0), [scaleId,setScaleId] = useState('ionian');
  const [instrument,setInstrument] = useState('6'), [libraryPitches,setLibraryPitches] = useState(baseTuning(6));
  const [position,setPosition] = useState(0), [usedOnly,setUsedOnly] = useState(false), [intervals,setIntervals] = useState(false), [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useEffect(() => { let alive = true; (songId ? readSong(songId) : Promise.resolve(undefined)).then(song => { if (alive) { setSongs(song ? [song] : []); setError(''); } }).catch(e=>alive && setError(String(e))); return ()=>{alive=false;}; },[revision,songId]);
  useEffect(() => window.guitarIO?.onLearnContext?.(id => {setCurrentId(id || '');setSongId(id || '');setRevision(n=>n+1);}),[]);
  const song = songs.find(s=>s.id===songId);
  useEffect(() => { setTrack(song?.trackIndex || 0); setSection(''); setPosition(0); setUsedOnly(false); },[song?.id,song?.trackIndex]);
  const sections = song ? sectionsFor(song,track) : [], selectedSection = sections.find(s=>s.id===section);
  const result = useMemo(() => { if (!song) return {}; try { return {analysis:analyseSong(song,track,selectedSection?.start,selectedSection?.end)}; } catch(e) { return {error:e instanceof Error ? e.message : 'Could not read this score.'}; } },[song,track,selectedSection]);
  const analysis = result.analysis;
  const matches = useMemo(()=>suggestScales(analysis?.weights || []),[analysis]);
  const best = matches[0];
  useEffect(()=>{ if(analysis?.total && best) {setRoot(best.root);setScaleId(best.scale.id);setPosition(0);} },[analysis,best?.root,best?.scale.id]);
  const bass = instrument === 'bass';
  const tuning = analysis?.tuning.length ? analysis.tuning.map(n=>n+analysis.capo) : [...libraryPitches].reverse();
  const scale = SCALES.find(s=>s.id===scaleId) || SCALES[0], pitches = scalePitches(root,scale.intervals);
  const shownPitches = usedOnly && analysis?.total ? pitches.filter(p=>analysis.weights[p]>0) : pitches;
  const positions = handPositions(tuning,shownPitches,root,analysis?.frets);
  const outside = analysis ? analysis.weights.flatMap((w,p)=>w && !pitches.includes(p) ? [PITCH_CLASSES[p]] : []) : [];
  const percentage = (value: number) => value === 1 ? 100 : Math.min(99.9,Math.round(value*1000)/10);
  const fit = analysis?.total ? percentage(noteFit(analysis.weights,pitches)) : null;
  async function hear(pitch: number) { try { await auditionPitches([pitch],analysis?.program ?? 25); setError(''); } catch(e) {setError(e instanceof Error ? e.message : 'Could not play this note.');} }
  return <main className="learn-window">
    {document.documentElement.classList.contains('native-ios')&&<button className="button secondary" onClick={()=>{location.href='./';}}><ArrowLeft size={16}/>Return to library</button>}
    <header className="learn-header"><div><span className="learn-eyebrow"><AudioLines size={17}/>GUITAR.IO / LEARN</span><h1>Scales & modes</h1></div><label>Mode<select aria-label="Learn song" value={song?.id || ''} onChange={e=>{setSongId(e.target.value);setSection('');}}><option value="">Scale library</option>{currentId && <option value={currentId}>Current song</option>}</select></label></header>
    <div className="learn-context">{song ? <><label>Instrument<select aria-label="Learn instrument" value={track} onChange={e=>{setTrack(Number(e.target.value));setSection('');}}>{song.tracks.map(t=><option key={t.index} value={t.index}>{t.name}</option>)}</select></label><label>Focus<select aria-label="Learn section" value={section} onChange={e=>setSection(e.target.value)}><option value="">Whole song</option>{sections.map(s=><option key={s.id} value={s.id}>{s.name} · bars {s.start}–{s.end}</option>)}</select></label><span>{analysis?.tuning.length ? `${tuning.length} strings${analysis.capo ? ` · capo ${analysis.capo}` : ''} · ${song.tracks.find(t=>t.index===track)?.tuning || song.tuning}` : 'Using a guitar neck for this instrument'}</span><button className="icon-button" aria-label="Refresh song analysis" title="Refresh song analysis" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></button></> : <><label>Instrument<select aria-label="Library instrument" value={instrument} onChange={e=>{setInstrument(e.target.value);setLibraryPitches(baseTuning(e.target.value==='bass'?4:Number(e.target.value),e.target.value==='bass'));setPosition(0);}}><option value="6">6-string guitar</option><option value="7">7-string guitar</option><option value="8">8-string guitar</option><option value="bass">4-string bass</option></select></label><div className="learn-tuning"><span>Tuning</span><TuningPicker pitches={libraryPitches} onChange={setLibraryPitches} bass={bass}/></div></> }</div>
    {(error || result.error) && <p className="form-error" role="alert">{error || result.error}</p>}
    {song && <div className="learn-analysis">{analysis?.total ? <><strong>Closest note match: {PITCH_CLASSES[best.root]} {best.scale.name}</strong><span>{percentage(best.fit)}% of the selected instrument’s note duration fits. Shared notes can suggest several keys; use the chords and the sound of resolution to choose your root.</span><button className="text-button" onClick={()=>{setRoot(best.root);setScaleId(best.scale.id);}}><Check size={16}/>Use this match</button></> : <span>No pitched notes in this selection. Explore a scale below, or choose another instrument or section.</span>}</div>}
    <section className="learn-board-panel">
      <div className="learn-board-heading"><div><span className="learn-eyebrow">FRETBOARD</span><h2>{PITCH_CLASSES[root]} {scale.name}</h2></div><div className="learn-board-options"><label>Scale<select aria-label="Selected scale" value={scaleId} onChange={e=>setScaleId(e.target.value)}>{SCALES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Root<select aria-label="Scale root" value={root} onChange={e=>setRoot(Number(e.target.value))}>{PITCH_CLASSES.map((name,i)=><option value={i} key={i}>{name}</option>)}</select></label><label><input type="checkbox" checked={intervals} onChange={e=>setIntervals(e.target.checked)}/>Intervals</label>{!!analysis?.total && <label><input type="checkbox" checked={usedOnly} onChange={e=>setUsedOnly(e.target.checked)}/>Only notes in the song</label>}</div></div>
      <div className="fretboard-scroll"><div className="learn-fretboard" role="group" aria-label="Interactive guitar fretboard">
        <div className="fret-numbers"><span>STRING</span>{Array.from({length:25},(_,f)=><span key={f}>{f}</span>)}</div>
        {tuning.map((open,string)=><div className="fret-string" key={string} style={{'--string-weight':`${.7+string*.23}px`} as React.CSSProperties}><span className="fret-string-name">{string+1}<small>{midiName(open)}</small></span>{Array.from({length:25},(_,fret)=>{
          const pitch=open+fret, pc=pitchClass(pitch), degree=pitches.indexOf(pc), used=!!analysis?.weights[pc], visible=degree>=0 && (!usedOnly || used) && pitch<=127;
          const inPosition=!position || fret>=position && fret<position+4;
          return <span className={`fret-cell ${fret===0 ? 'open-string' : ''} ${[3,5,7,9,12,15,17,19,21,24].includes(fret) ? 'fret-marker' : ''} ${inPosition ? '' : 'outside-position'}`} key={fret}>{visible && <button className={`fret-note ${pc===root ? 'root-note' : ''} ${used ? 'used-note' : ''}`} aria-label={`String ${string+1}, fret ${fret}, ${midiName(pitch)}, degree ${scale.degrees[degree]}`} title={`${midiName(pitch)} · ${scale.degrees[degree]}${position && inPosition ? ` · finger ${fret-position+1}` : ''}`} onClick={()=>void hear(pitch)}>{intervals ? scale.degrees[degree] : PITCH_CLASSES[pc]}{position>0 && inPosition && <small>{fret-position+1}</small>}</button>}</span>;
        })}</div>)}
      </div></div>
      <div className="fretboard-legend"><span><i className="legend-root"/>Root</span><span><i/>Scale note</span>{!!analysis?.total && <span><i className="legend-used"/>Heard in the song</span>}<span><Volume2 size={14}/>Click a note to hear it</span></div>
      <div className="learn-positions"><span>Hand position</span><button className="button secondary" aria-pressed={!position} onClick={()=>setPosition(0)}>Whole neck</button>{positions.map(p=><button className="button secondary" aria-pressed={position===p.start} key={p.start} onClick={()=>setPosition(p.start)}>Frets {p.start}–{p.end}<small>{p.coverage}/{shownPitches.length} notes</small></button>)}</div>
      {position>0 && <p className="learn-position-hint">Numbers 1–4 suggest index through little finger in this four-fret window. These are starting positions; use comfortable shifts for your hand and the phrase.</p>}
    </section>
    <section className="learn-scale-section"><div className="learn-section-heading"><h2>Choose a scale</h2>{fit!==null && <span>{fit}% note fit{outside.length ? ` · outside this scale: ${outside.join(', ')}` : ' · all analysed notes are included'}</span>}</div><div className="learn-scale-grid">{SCALES.map(s=>{
      const match=analysis?.total ? percentage(noteFit(analysis.weights,scalePitches(root,s.intervals))) : null;
      return <button key={s.id} className={`learn-scale-card ${scaleId===s.id ? 'selected' : ''}`} aria-pressed={scaleId===s.id} onClick={()=>setScaleId(s.id)}><strong>{s.name}</strong><span>{s.degrees.join(' · ')}</span>{match!==null && <small>{match}% note fit</small>}</button>;
    })}</div></section>
    <section className="learn-practice"><span className="learn-eyebrow">TRY A PHRASE</span><h2>Start small. Listen to where it lands.</h2><p>{scale.hint}</p><p>{song ? 'Keep your song playing in the main window. ' : ''}Choose a hand position, play a short idea, then repeat it with a different rhythm. A scale match is a starting point; the chord underneath decides which notes feel settled.</p></section>
  </main>;
}
