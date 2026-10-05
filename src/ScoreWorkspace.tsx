import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AlphaTabApi, model } from '@coderline/alphatab';
import { ChevronLeft, ChevronRight, ChevronDown, Settings2, Play, Pause, Plus, Pencil, Check, X, Trash2, Volume2, VolumeX, Minus, Maximize2, RotateCcw, Gauge, ArrowLeft, Dna, Map, Sparkles, Moon, Sun } from 'lucide-react';
import type { Song, Section, Range, NotationMode, Asset, MediaSource } from './types';
import { COLORS, STATUS } from './types';
import { normaliseRange, playbackTicks, sectionError } from './domain.mjs';
import { sectionsFor, withSections, withLearningPercent, learnedPercent } from './library-model';
import { StatusMark } from './ui';
import { SongMap, SuggestionDialog } from './SectionDialogs';
import ScorePlayhead from './ScorePlayhead';
import MediaPanel from './MediaPanel';
import SectionMenu from './SectionMenu';
import { splitSection, mergeSection, mergeSelection, insertSection } from './section-editing';
import LoopControls from './LoopControls';
import BarRange from './BarRange';
import SectionNameSelect from './SectionNameSelect';
import { instructionalsFor, formatTimestamp, parseTimestamp, type InstructionalSeek } from './instructional';
import NotationTools from './NotationTools';
import { readWorkingScore } from './score-editing';
import Splicer from './Splicer';
import SpeedControl from './SpeedControl';
import {steppedRate} from './playback-timing';
import {applyScoreColors} from './score-colors';

type Props = { song: Song; onPlayed?: (bar: number) => void; onSave: (song: Song, assets?: Asset[]) => Promise<void>; onEdit: () => void; onBack: () => void; notify: (text: string, error?: boolean) => void };
type BarBox = { bar: number; x: number; y: number; width: number; height: number };
type Draft = Section & { isNew?: boolean };

export default function ScoreWorkspace({ song, onPlayed, onSave, onEdit, onBack, notify }: Props) {
  const scoreElement = useRef<HTMLDivElement>(null), transportElement=useRef<HTMLDivElement>(null);
  const sheetElement = useRef<HTMLDivElement>(null);
  const scrollElement = useRef<HTMLDivElement>(null);
  const api = useRef<AlphaTabApi | null>(null),displayFrame=useRef(0),appliedDark=useRef<boolean | null>(null);
  const score = useRef<model.Score | null>(null);
  const [engine, setEngine] = useState<AlphaTabApi | null>(null);
  const [spliceOpen,setSpliceOpen]=useState(false);
  const [mapOpen, setMapOpen] = useState(false), [suggestOpen, setSuggestOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [mediaSource, setMediaSource] = useState<MediaSource>('synth'), [mediaAvailable, setMediaAvailable] = useState(true);
  const [youtubeSectionSpeeds,setYoutubeSectionSpeeds]=useState(false);
  const [spacing,setSpacing]=useState(1.25),[dark,setDark]=useState(()=>window.localStorage.getItem('guitario-dark-score')==='on');
  const sections = sectionsFor(song);
  const [ready, setReady] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [renderRevision, setRenderRevision] = useState(0);
  const [hasSelection, setHasSelection] = useState(false), [selectionRevision, setSelectionRevision] = useState(0);
  const appliedTrack = useRef(song.trackIndex);
  const notationVersion = JSON.stringify([song.noteEdits, song.tuningEdits, song.sourceTunings,song.tempoEdits,song.spliceEdits]);
  const appliedNotation = useRef(notationVersion);
  const [loadError, setLoadError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(1);
  const [selection, setSelection] = useState<Range>({ start: 1, end: 1 });
  const selectionRef = useRef(selection);
  const anchor = useRef(1);
  const dragging = useRef(false);
  const [loop, setLoop] = useState(false);
  const [loopError, setLoopError] = useState('');
  const [midiRevision, setMidiRevision] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.75);
  const [metronome, setMetronome] = useState(false);
  const [mode, setMode] = useState<NotationMode>(() => (song.tracks.find(t => t.index === song.trackIndex)?.strings || 0) > 0 ? 'tab' : 'score');
  const [zoom, setZoom] = useState(1);
  const [sectionsCollapsed,setSectionsCollapsed]=useState(false),[countIn,setCountIn]=useState(false);
  const [rates,setRates]=useState<number[] | undefined>(),[bpm,setBpm]=useState(song.bpm || 120);
  const [draft, setDraft] = useState<Draft | null>(null);
  const instructionalVideos = instructionalsFor(song);
  const [instructionalId,setInstructionalId] = useState(''), [instructionalSeek,setInstructionalSeek] = useState<InstructionalSeek>();
  const [timestampVideo,setTimestampVideo] = useState(''), [timestampText,setTimestampText] = useState('');
  const timestampId = instructionalVideos.some(r=>r.id===timestampVideo) ? timestampVideo : instructionalVideos[0]?.id || '';
  useEffect(()=>{setTimestampVideo(instructionalId || instructionalVideos[0]?.id || '');},[draft?.id]);
  useEffect(()=>{const value=draft?.instructionalTimestamps?.[timestampId];setTimestampText(value===undefined?'':formatTimestamp(value));},[draft?.id,timestampId]);
  const [boxes, setBoxes] = useState<BarBox[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; bar: number } | null>(null);
  const [undo, setUndo] = useState<{ track: number; sections: Section[]; time:number }[]>([]);
  const selectedTrack = song.tracks.find(t => t.index === song.trackIndex) || song.tracks[0];
  const activeSection = sections.find(s => s.start <= currentBar && s.end >= currentBar);
  const playbackState = useRef({ speed, sections, mediaSource, youtubeSectionSpeeds, rates, currentBar, onPlayed, playing: false });
  playbackState.current = { ...playbackState.current, speed, sections, mediaSource, youtubeSectionSpeeds, rates, currentBar, onPlayed };
  function applyBarSpeed(bar: number) {
    const state = playbackState.current, factor = state.mediaSource === 'synth' || state.mediaSource==='youtube' && state.youtubeSectionSpeeds ? state.sections.find(s => s.start<=bar && s.end>=bar)?.speed ?? 1 : 1;
    const target=steppedRate(state.speed*factor,state.mediaSource==='youtube'?state.rates:undefined,state.mediaSource==='youtube'?.25:.1);
    if (api.current?.isReadyForPlayback && api.current.playbackSpeed!==target) api.current.playbackSpeed=target;
  }
  selectionRef.current = selection;

  function requestDisplayRender() {
    if(displayFrame.current)return;
    displayFrame.current=requestAnimationFrame(()=>{displayFrame.current=0;const instance=api.current;if(instance){instance.updateSettings();instance.render();}});
  }

  useEffect(()=>{
    if(!engine || appliedDark.current===dark)return;
    applyScoreColors(engine.settings,dark);appliedDark.current=dark;requestDisplayRender();
  },[dark,engine]);

  useEffect(() => {
    const a = window.alphaTab;
    if (!scoreElement.current || !scrollElement.current) return;
    let disposed = false;
    let owned: AlphaTabApi | null = null,startFrame=0;
    try {
      const settings = new a.Settings();
      settings.core.scriptFile = new URL('./vendor/alphatab/alphaTab.js', document.baseURI).href;
      settings.core.fontDirectory = new URL('./vendor/alphatab/font/', document.baseURI).href;
      settings.core.useWorkers = false;
      settings.core.enableLazyLoading = false;
      settings.core.includeNoteBounds = true;
      settings.display.scale = zoom;
      settings.display.staveProfile = mode === 'score' ? a.StaveProfile.Score : a.StaveProfile.Tab;
      settings.display.barsPerRow = -1;
      settings.display.systemsLayoutMode = a.SystemsLayoutMode.Automatic;
      settings.display.stretchForce = spacing;
      settings.display.padding = [28, 44, 28, 36];
      settings.display.systemPaddingTop = 34;
      settings.display.firstSystemPaddingTop = 24;
      applyScoreColors(settings,dark);appliedDark.current=dark;
      settings.player.playerMode = a.PlayerMode.EnabledSynthesizer;
      settings.player.soundFont = new URL('./vendor/alphatab/soundfont/sonivox.sf2', document.baseURI).href;
      settings.player.scrollElement = scrollElement.current;
      settings.player.scrollOffsetY = -70;
      settings.player.enableUserInteraction = false;
      settings.player.enableCursor = true;
      for (const key of ['ScoreTitle', 'ScoreSubTitle', 'ScoreArtist', 'ScoreAlbum', 'ScoreWords', 'ScoreMusic', 'ScoreWordsAndMusic', 'ScoreCopyright', 'GuitarTuning', 'EffectMarker'] as const) {
        const element = a.NotationElement[key];
        if (element !== undefined) settings.notation.elements.set(element, false);
      }
      const instance = new a.AlphaTabApi(scoreElement.current, settings);
      owned = instance; api.current = instance; setEngine(instance);
      instance.masterVolume = volume;
      instance.renderStarted.on(() => { if (!disposed) setRendering(true); });
      instance.postRenderFinished.on(() => {
        if (disposed) return;
        const found: BarBox[] = [];
        for (let i = 0; i < song.bars; i++) {
          const bar = instance.boundsLookup?.findMasterBarByIndex(i);
          if (bar) {
            const b = bar.lineAlignedBounds;
            found.push({ bar: i + 1, x: b.x, y: b.y, width: b.w, height: Math.max(b.h, 50) });
          }
        }
        setBoxes(found); setRendering(false); setRenderRevision(n => n + 1);
      });
      instance.playerReady.on(() => { if (!disposed) { setReady(true); setMidiRevision(n => n + 1); } });
      instance.playerStateChanged.on(e => { if (!disposed) { const playing=e.state === a.synth.PlayerState.Playing; if (playing || playbackState.current.playing) playbackState.current.onPlayed?.(playbackState.current.currentBar); playbackState.current.playing=playing; setPlaying(playing); } });
      instance.playedBeatChanged.on(beat => { if (!disposed) { const bar=beat.voice.bar.index+1; playbackState.current.currentBar=bar; queueMicrotask(()=>{if(!disposed)applyBarSpeed(bar);}); setCurrentBar(bar); } });
      instance.playerPositionChanged.on(e => {
        if (disposed) return;
        const bar = instance.tickCache?.masterBars.find(b => e.currentTick >= b.start && e.currentTick < b.end);
        if (bar) { const value=bar.masterBar.index+1; playbackState.current.currentBar=value; queueMicrotask(()=>{if(!disposed)applyBarSpeed(value);}); setCurrentBar(value); }
      });
      instance.error.on(error => {
        if (!disposed) { setLoadError(error.message || 'The score could not be loaded.'); setRendering(false); }
      });
      score.current = readWorkingScore(song);
      // alphaTab installs its display-reset hooks in the constructor's first frame.
      // Wait for that frame, including when cached fonts allow synchronous rendering.
      startFrame=requestAnimationFrame(()=>{if(!disposed && score.current)instance.renderScore(score.current,[appliedTrack.current]);});
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not open this score.'); setRendering(false);
    }
    return () => { disposed = true; if(playbackState.current.playing) playbackState.current.onPlayed?.(playbackState.current.currentBar); cancelAnimationFrame(startFrame);cancelAnimationFrame(displayFrame.current);displayFrame.current=0;owned?.destroy(); if (api.current === owned) api.current = null; };
  }, [song.id]);

  useEffect(() => {
    const instance = api.current;
    if (!instance || appliedNotation.current === notationVersion) return;
    instance.pause();
    try {
      const next = readWorkingScore(song);
      const tick = instance.tickPosition;
      const restorePosition = () => { instance.playerReady.off(restorePosition); queueMicrotask(() => { if (api.current === instance) instance.tickPosition = tick; }); };
      instance.playerReady.on(restorePosition);
      score.current = next; appliedNotation.current = notationVersion;
      instance.renderScore(next, [song.trackIndex]);
    } catch (e) { notify(e instanceof Error ? e.message : 'Could not apply notation edits.', true); }
  }, [notationVersion]);

  useEffect(() => {
    const instance = api.current;
    if (!instance || !score.current || appliedTrack.current === song.trackIndex) return;
    appliedTrack.current = song.trackIndex; setHasSelection(false); setSelectionRevision(n => n + 1);
    if (!(song.tracks.find(t => t.index === song.trackIndex)?.strings || 0)) {
      setMode('score');
      instance.settings.display.staveProfile = window.alphaTab.StaveProfile.Score;
      instance.updateSettings();
    }
    instance.pause();
    setDraft(null); setFormError(''); setContext(null); setSelection({ start: 1, end: 1 }); setLoop(false);
    instance.renderTracks([score.current.tracks[song.trackIndex]]);
  }, [song.trackIndex]);

  useEffect(() => {
    const instance = api.current;
    if (!instance) return;
    const range = loop ? playbackTicks(instance.tickCache?.masterBars || [], selection.start, selection.end) : null;
    setLoopError(loop && !range ? 'This selection crosses a score jump without a complete pass. Choose another range.' : '');
    instance.playbackRange = range;
    instance.isLooping = loop && !!range;
    if (range && (instance.tickPosition < range.startTick || instance.tickPosition >= range.endTick)) instance.tickPosition = range.startTick;
  }, [loop, selection, ready, mediaSource, mediaAvailable, midiRevision]);

  useEffect(() => {
    const instance = api.current;
    if (!instance?.isReadyForPlayback) return;
    applyBarSpeed(currentBar); instance.masterVolume = volume;
    instance.metronomeVolume = mediaSource === 'synth' && metronome ? 0.4 : 0;
    instance.countInVolume = mediaSource === 'synth' && countIn ? .65 : 0;
  }, [speed, activeSection?.speed, currentBar, volume, metronome, mediaSource, youtubeSectionSpeeds, mediaAvailable, ready, countIn, rates]);

  useEffect(() => {
    const end = () => { dragging.current = false; };
    window.addEventListener('pointerup', end);
    window.addEventListener('blur', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('blur', end); };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (mediaSource === 'instructional') return;
      if (event.code === 'Space' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat && ready && mediaAvailable) api.current?.playPause();
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('textarea,select,input:not([type="range"]),[contenteditable="true"]') || document.querySelector('[role="dialog"],[role="menu"]')) return;
      if (event.key === 'Escape') { setDraft(null); setLoop(false); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [ready, mediaAvailable, mediaSource]);

  function seek(bar: number, scroll = true) {
    const value = Math.min(song.bars, Math.max(1, bar));
    setCurrentBar(value);
    const instance = api.current;
    if (instance?.tickCache && score.current) {
      const range = loop ? playbackTicks(instance.tickCache.masterBars, selection.start, selection.end) : null;
      const occurrence = instance.tickCache.masterBars.find(b => b.masterBar.index === value - 1 && (!range || (b.start >= range.startTick && b.start < range.endTick)));
      instance.tickPosition = occurrence?.start ?? instance.tickCache.getMasterBarStart(score.current.masterBars[value - 1]);
    }
    if (scroll) {
      const bounds = instance?.boundsLookup?.findMasterBarByIndex(value - 1)?.realBounds;
      if (bounds && scrollElement.current) scrollElement.current.scrollTo({ top: Math.max(0, bounds.y - 55), behavior: 'smooth' });
    }
  }

  function chooseBar(bar: number, extend = false) {
    setHasSelection(true); setSelectionRevision(n => n + 1);
    if (!extend) anchor.current = bar;
    const range = normaliseRange(anchor.current, bar, song.bars);
    setSelection(range); setDraft(null); setFormError('');
    seek(bar, false);
  }

  function chooseSection(section: Section) {
    setHasSelection(true); setSelectionRevision(n => n + 1);
    setSelection({ start: section.start, end: section.end });
    anchor.current = section.start; setDraft(null); seek(section.start);
    const time=section.instructionalTimestamps?.[instructionalId];if(mediaSource==='instructional' && time!==undefined)setInstructionalSeek({recordingId:instructionalId,seconds:time,request:Date.now()});
  }

  function makeSection() {
    setDraft({ id: crypto.randomUUID(), name: selection.start===1?'Intro':'Verse', ...selection, color: COLORS[sections.length % COLORS.length], status: 'new', learnedPercent: 0, notes: '', isNew: true });
    setFormError(''); setRemoveConfirm(false);
  }

  async function saveSection() {
    if (!draft) return;
    let timestamps = { ...draft.instructionalTimestamps };
    if(timestampId){try{const time=parseTimestamp(timestampText);if(time===undefined)delete timestamps[timestampId];else timestamps[timestampId]=time;}catch(e){setFormError(String(e instanceof Error?e.message:e));return;}}
    const error = sectionError(draft, [], song.bars);
    if (error) { setFormError(error); return; }
    setSaving(true);
    try {
      const { isNew: _isNew, ...section } = draft;
      section.speed=steppedRate(section.speed ?? 1,undefined,.25,1);
      section.name = section.name.trim();section.instructionalTimestamps=Object.keys(timestamps).length?timestamps:undefined;
      const updatedSections = insertSection(sections, section);
      await onSave(withSections(song, updatedSections));
      setUndo(previous => [...previous.slice(-9), { track: song.trackIndex, sections, time:Date.now() }]);
      setSelection({ start: section.start, end: section.end });
      setDraft(null); notify(`${section.name} saved · bars ${section.start}–${section.end}`);
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Could not save this section.'); }
    finally { setSaving(false); }
  }

  async function deleteSection() {
    if (!draft) return;
    setSaving(true);
    try { await onSave(withSections(song, sections.filter(s => s.id !== draft.id))); setUndo(previous => [...previous.slice(-9), { track: song.trackIndex, sections, time:Date.now() }]); setDraft(null); setRemoveConfirm(false); notify('Section removed. Undo is available.'); }
    catch (e) { setFormError(e instanceof Error ? e.message : 'Could not remove this section.'); }
    finally { setSaving(false); }
  }

  function updateDisplay(nextMode: NotationMode, nextZoom: number) {
    setMode(nextMode); setZoom(nextZoom);
    const instance = api.current;
    if (!instance) return;
    const a = window.alphaTab;
    instance.settings.display.staveProfile = nextMode === 'both' ? a.StaveProfile.ScoreTab : nextMode === 'score' ? a.StaveProfile.Score : a.StaveProfile.Tab;
    instance.settings.display.scale = nextZoom;
    instance.updateSettings(); instance.render();
  }

  function openContext(event: React.MouseEvent, bar: number) {
    event.preventDefault(); dragging.current = false;
    setHasSelection(true); setSelectionRevision(n => n + 1);
    if (bar < selection.start || bar > selection.end) { setSelection({ start: bar, end: bar }); anchor.current = bar; }
    setContext({ x: event.clientX, y: event.clientY, bar });
  }
  async function changeSections(next: Section[]) {
    if (saving) return;
    setSaving(true);
    try { await onSave(withSections(song, next)); setUndo(previous => [...previous.slice(-9), { track: song.trackIndex, sections, time:Date.now() }]); setDraft(null); notify('Sections updated. Undo is available.'); }
    catch (e) { notify(String(e), true); } finally { setSaving(false); }
  }
  const menuSection = sections.find(s => context && context.bar >= s.start && context.bar <= s.end);
  const ordered = [...sections].sort((a, b) => a.start - b.start);
  const menuIndex = ordered.findIndex(s => s.id === menuSection?.id);
  const splitAt = menuSection && context ? context.bar > menuSection.start ? context.bar : Math.floor((menuSection.start + menuSection.end) / 2) + 1 : 0;
  function editFromMenu(remove = false) {
    if (!menuSection) return;
    chooseSection(menuSection); setDraft({ ...menuSection }); setFormError(''); setRemoveConfirm(remove);
  }

  const sectionEditor = draft ? <form className="section-editor" style={{'--section-color':draft.color} as CSSProperties} onSubmit={e => { e.preventDefault(); saveSection(); }}>
          <label>Section<SectionNameSelect value={draft.name} onChange={name=>setDraft({...draft,name})}/></label>
          <BarRange value={draft} total={song.bars} onChange={range=>setDraft({...draft,...range})}/>
          <label className="section-speed">Section speed <output title="Section speed multiplier">{Math.round(steppedRate(draft.speed ?? 1,undefined,.25,1)*100)}%</output><input aria-label="Section playback speed" type="range" min="25" max="100" step="5" value={steppedRate(draft.speed ?? 1,undefined,.25,1)*100} onChange={e=>setDraft({...draft,speed:steppedRate(Number(e.target.value)/100,undefined,.25,1)})}/></label>
          {!draft.isNew && <div className="section-learning-control"><div className="section-control-label"><span>Learning</span><div><StatusMark section={draft}/>{draft.status!=='learning' && <output>{learnedPercent(draft)}%</output>}</div></div><input aria-label="Percentage learnt" type="range" min="0" max="100" step="1" value={learnedPercent(draft)} aria-valuetext={`${learnedPercent(draft)}% ${STATUS[draft.status]}`} onChange={e=>setDraft(withLearningPercent(draft,Number(e.target.value)))}/></div>}
          {instructionalVideos.length>0 && <div className="section-timestamp">{instructionalVideos.length>1 && <label>Video<select aria-label="Section instructional video" value={timestampId} onChange={e=>{try{const time=parseTimestamp(timestampText),timestamps={...draft.instructionalTimestamps};if(time===undefined)delete timestamps[timestampId];else timestamps[timestampId]=time;setDraft({...draft,instructionalTimestamps:timestamps});setTimestampVideo(e.target.value);setFormError('');}catch(error){setFormError(String(error instanceof Error?error.message:error));}}}>{instructionalVideos.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}<label>Timestamp in instructional<input aria-label="Timestamp in instructional" inputMode="numeric" value={timestampText} placeholder="m:ss" maxLength={16} onChange={e=>setTimestampText(e.target.value)}/></label></div>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="section-colors" role="group" aria-label="Section colour">{COLORS.map(color=><button type="button" key={color} aria-label={`Colour ${color}`} aria-pressed={draft.color===color} style={{background:color}} onClick={()=>setDraft({...draft,color})}>{draft.color===color && <Check size={12}/>}</button>)}</div>
          <div className="section-editor-actions"><button className="icon-button section-confirm" type="submit" disabled={saving} aria-label="Save section" title="Save section"><Check size={20}/></button><button className="icon-button" type="button" aria-label="Cancel section edit" title="Cancel" onClick={()=>setDraft(null)}><X size={20}/></button>{!draft.isNew && <button className="icon-button section-remove" type="button" aria-label="Remove section" title="Remove section" onClick={()=>setRemoveConfirm(true)}><Trash2 size={16}/></button>}</div>
          {removeConfirm && <div className="delete-confirm"><span>Remove this section?</span><button type="button" className="text-button danger" disabled={saving} onClick={deleteSection}>Remove section</button><button type="button" className="text-button" onClick={()=>setRemoveConfirm(false)}>Keep it</button></div>}
        </form> : null;

  return <main className={`workspace ${dark?'dark-score':''} ${sectionsCollapsed?'sections-collapsed':''}`}>
    <div className="practice-nav"><button className="icon-button back-button" aria-label="Return to library" title="Return to library" onClick={onBack}><ArrowLeft size={26}/></button>
    <div className="song-heading"><div><div className="song-title-row"><h1>{song.title}</h1><button className="icon-button" aria-label="Song details" title="Song details & tags" onClick={onEdit}><Pencil size={18} /></button></div><div className="song-byline">{song.artist}<span>·</span>{selectedTrack?.tuning || song.tuning}</div></div></div><button className="icon-button sections-toggle" aria-label={sectionsCollapsed?'Show song sections':'Collapse song sections'} title={sectionsCollapsed?'Show song sections':'Collapse song sections'} aria-expanded={!sectionsCollapsed} onClick={()=>{setSectionsCollapsed(v=>!v);requestDisplayRender();}}><Map size={19}/></button></div>
    <div className="workspace-columns"><div className="score-column">
        <MediaPanel song={song} api={engine} source={mediaSource} playbackSpeed={speed} currentBar={currentBar} onTiming={(nextRates,nextBpm)=>{setRates(nextRates);setBpm(nextBpm);}} setSource={setMediaSource} onSave={onSave} onAvailable={setMediaAvailable} onSectionSpeedAvailable={setYoutubeSectionSpeeds} onRate={setSpeed} onInstructionalChange={setInstructionalId} instructionalSeek={instructionalSeek}>
          <div className="transport" ref={transportElement}>
            <div className="transport-play"><button className="icon-button" aria-label="Previous bar" onClick={() => seek(currentBar - 1)}><ChevronLeft size={18} /></button><button className="play-button" aria-label={playing ? 'Pause' : 'Play'} disabled={!ready || !mediaAvailable} onClick={() => api.current?.playPause()}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="icon-button" aria-label="Next bar" onClick={() => seek(currentBar + 1)}><ChevronRight size={18} /></button></div>
            <LoopControls range={selection} total={song.bars} enabled={loop} onRange={range => { anchor.current = range.start; setSelection(range); setHasSelection(true); }} onToggle={() => { if (!loop && (!hasSelection || selection.start === selection.end)) { setSelection({ start: currentBar, end: currentBar }); anchor.current = currentBar; } setLoop(v => !v); }} onRestart={() => seek(selection.start)} error={loopError} />
            <div className="bar-position"><strong>{currentBar}</strong><span>/ {song.bars}</span></div>
            <input aria-label="Scrub through bars" className="scrubber" type="range" min="1" max={song.bars} value={currentBar} onChange={e => { setLoop(false); setHasSelection(false); seek(Number(e.target.value)); }} />
            {((mediaSource==='synth' || mediaSource==='youtube'&&youtubeSectionSpeeds) && activeSection?.speed && activeSection.speed!==1) ? <small className="section-rate-badge" title="Section speed multiplier">×{activeSection.speed}</small> : null}<SpeedControl speed={speed} bpm={bpm} rates={mediaSource==='youtube'?rates:undefined} onChange={setSpeed}/>
            <button disabled={mediaSource !== 'synth'} className={"icon-button " + (metronome ? "is-active" : "")} aria-label="Metronome" title="Metronome" aria-pressed={metronome} onClick={() => setMetronome(!metronome)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 20h12L15 4H11L7 20Z M10 20L19 3 M13 12h5 M9 17h8" /></svg></button>
            <button className="icon-button" aria-label={volume ? 'Mute' : 'Unmute'} title={volume ? 'Mute' : 'Unmute'} onClick={() => setVolume(volume ? 0 : 0.75)}>{volume ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button className={"icon-button " + (settingsOpen ? "is-active" : "")} aria-label="Player settings" title="Player settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(v => !v)}><Settings2 size={18} /></button>
            
          </div>
          {settingsOpen && <div className="player-settings" aria-label="Player settings panel">
            <button className={"icon-button " + (countIn?"is-active":"")} aria-label="Count in" title="One bar count-in before MIDI playback" aria-pressed={countIn} disabled={mediaSource!=='synth'} onClick={()=>setCountIn(v=>!v)}><span className="count-in-icon">1·2·3·4</span></button><label>Instrument<select aria-label="Instrument track" value={song.trackIndex} onChange={e => onSave({ ...song, trackIndex: Number(e.target.value), tuning: song.tracks.find(t=>t.index===Number(e.target.value))?.tuning || song.tuning }).catch(err => notify(err.message, true))}>{song.tracks.map(t => <option key={t.index} value={t.index}>{t.name}</option>)}</select></label>
            <button className="icon-button" aria-label="Splicer" title="Splicer" onClick={()=>{api.current?.pause();setSpliceOpen(true);}}><Dna size={22}/></button>
            <label className="spacing-slider">Spacing<input aria-label="Notation spacing" type="range" min="1.25" max="2.5" step="0.01" value={spacing} onChange={e=>{const value=Number(e.target.value);setSpacing(value);if(api.current){api.current.settings.display.stretchForce=value;requestDisplayRender();}}}/><span className="spacing-labels"><span>Natural</span><span>Extra roomy</span></span></label>
            <div className="segmented" aria-label="Notation display">{(['tab', 'score', 'both'] as const).map(m => <button key={m} className={mode === m ? 'active' : ''} onClick={() => updateDisplay(m, zoom)}>{m === 'tab' ? 'Tab' : m === 'both' ? 'Both' : 'Notation'}</button>)}</div>
            <div className="zoom-control"><button className="icon-button" aria-label="Zoom out" onClick={() => updateDisplay(mode, Math.max(0.55, +(zoom - 0.1).toFixed(2)))}><Minus size={13} /></button><span>{Math.round(zoom * 100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={() => updateDisplay(mode, Math.min(1.5, +(zoom + 0.1).toFixed(2)))}><Plus size={13} /></button><button className="icon-button" aria-label="Reset zoom" onClick={() => updateDisplay(mode, 1)}><RotateCcw size={13} /></button></div>
            <button className="icon-button" aria-label="Fullscreen score" title="Fullscreen" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector<HTMLElement>('.workspace')?.requestFullscreen();}catch(e){notify(e instanceof Error?e.message:'Fullscreen is unavailable.',true);}}}><Maximize2 size={18}/></button><button className="icon-button" aria-label="Dark mode" title="Dark mode" aria-pressed={dark} onClick={()=>{setDark(v=>{window.localStorage.setItem('guitario-dark-score',v?'off':'on');return !v;});}}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
          </div>}
        <div className={settingsOpen ? 'notation-settings' : ''}><NotationTools key={"notation-tools:" + song.trackIndex} song={song} score={score.current} api={engine} boxes={boxes} revision={renderRevision} rendering={rendering} range={selection} onSave={onSave} notify={notify} toolbar={transportElement.current} settingsOpen={settingsOpen} sectionUndoTime={undo.at(-1)?.time || 0} onUndoSection={async()=>{const last=undo.at(-1);if(!last || saving)return;setSaving(true);try{await onSave(withSections(song,last.sections,last.track));setUndo(previous=>previous.slice(0,-1));setDraft(null);}catch(e){notify(String(e),true);}finally{setSaving(false);}}} selectionRevision={selectionRevision} onRange={range => { setSelection(range); setHasSelection(true); seek(range.start, false); }} container={sheetElement.current} /></div>
        </MediaPanel>
        <div className="score-paper" ref={scrollElement}>
          {loadError && <div className="score-error"><strong>This score couldn’t be opened</strong><p>{loadError}</p><p>Your imported file is still safely stored. Try a Guitar Pro or MusicXML export.</p></div>}
          {rendering && !loadError && <div className="loading-score">Preparing your score…</div>}
          <div className="score-sheet" ref={sheetElement}><div ref={scoreElement} className="alpha-score" />
            {!rendering && boxes.map(box => {
              const section = sections.find(s => box.bar >= s.start && box.bar <= s.end);
              const isSelected = hasSelection && box.bar >= selection.start && box.bar <= selection.end;
              return <button key={box.bar} className={`bar-overlay ${isSelected ? 'selected' : ''} ${currentBar === box.bar ? 'playing-bar' : ''}`} aria-label={`Select bar ${box.bar}`} aria-pressed={isSelected} title={`Bar ${box.bar}${section ? ' · ' + section.name : ''} · Shift-click to extend`} style={{ left: box.x, top: box.y - 6, width: Math.max(box.width, 10), height: box.height + 12, '--bar-color': section?.color || '#cbd0d3' } as CSSProperties}
                onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); dragging.current = true; chooseBar(box.bar, e.shiftKey); }}
                onContextMenu={e => openContext(e, box.bar)}
                onPointerEnter={() => { if (dragging.current) { setSelection(normaliseRange(anchor.current, box.bar, song.bars)); setDraft(null); } }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); chooseBar(box.bar, e.shiftKey); } }}>
                {section && section.start === box.bar && <span className="score-section-label" style={{ background: section.color }}>{section.name}</span>}
              </button>;
            })}
            <ScorePlayhead api={engine} trackIndex={song.trackIndex} rendering={rendering} external={mediaSource !== 'synth'} />
          </div>
        </div>

      </div>
      <aside className="sections-panel" hidden={sectionsCollapsed}>
        <div className="sections-heading"><h2>Song sections</h2><button className="icon-button" aria-label="Create section" title="Create section from selected bars" onClick={makeSection}><Plus size={19}/></button><button className="icon-button" aria-label="Song map" title="Song map" onClick={() => setMapOpen(true)}><Map size={18} /></button><button className="icon-button" aria-label="Suggest sections" title="Suggest sections" disabled={!score.current} onClick={() => setSuggestOpen(true)}><Sparkles size={17} /></button></div>
        {draft?.isNew && sectionEditor}
        <div className="section-list">{sections.map((section, i) => <div className="section-group" key={section.id}>
          <div onContextMenu={e => openContext(e, section.start)} aria-current={activeSection?.id === section.id ? true : undefined} className={"section-card " + (activeSection?.id === section.id ? "active" : activeSection ? "upcoming" : "")} style={{ '--section-color': section.color } as CSSProperties}>
            <button className="section-select" onClick={() => chooseSection(section)}><span className="section-number">{String(i + 1).padStart(2, '0')}</span><div><strong>{section.name}</strong><span>Bars {section.start}–{section.end}{instructionalId && section.instructionalTimestamps?.[instructionalId]!==undefined ? ` · ${formatTimestamp(section.instructionalTimestamps[instructionalId])}` : ''}</span></div></button>
            <button className="section-progress-button" aria-label={"Update " + section.name + " progress"} onClick={() => { setDraft({ ...section }); setFormError(''); setRemoveConfirm(false); }}><StatusMark section={section} /></button>
            <button className="section-edit icon-button" aria-label={"Edit " + section.name} aria-expanded={draft?.id === section.id} onClick={() => { setDraft(draft?.id === section.id ? null : { ...section }); setFormError(''); setRemoveConfirm(false); }}><ChevronDown size={17} /></button>
          </div>
          {draft?.id === section.id && sectionEditor}
        </div>)}</div>
      </aside>
    </div>
    {mapOpen && <SongMap song={song} currentBar={currentBar} onChoose={(start, end) => { setHasSelection(true); setSelectionRevision(n => n + 1); setSelection({ start, end }); anchor.current = start; setDraft(null); seek(start); }} onClose={() => setMapOpen(false)} />}
    {spliceOpen && <Splicer song={song} dark={dark} onSave={onSave} onClose={()=>setSpliceOpen(false)}/>}
    {suggestOpen && score.current && <SuggestionDialog song={song} score={score.current} onSave={async updated => { await onSave(updated); setUndo(previous => [...previous.slice(-9), { track: song.trackIndex, sections, time:Date.now() }]); }} onClose={() => setSuggestOpen(false)} />}
    {context && <SectionMenu x={context.x} y={context.y} onClose={() => setContext(null)} actions={[
      { label: 'New section from selection', disabled: saving || sections.some(s => selection.start <= s.end && selection.end >= s.start), run: makeSection },
      { label: 'Edit section', disabled: saving || !menuSection, run: () => editFromMenu() },
      { label: 'Add text note', run: ()=>window.dispatchEvent(new CustomEvent('guitario-annotate',{detail:{x:context.x,y:context.y,bar:context.bar}})) },
      { label: `Split before bar ${splitAt || context.bar}`, disabled: saving || !menuSection || menuSection.start === menuSection.end, run: () => { if (menuSection) void changeSections(splitSection(sections, menuSection.id, splitAt)); } },
      { label: 'Merge into previous section', disabled: saving || !menuSection || ordered[menuIndex - 1]?.end !== menuSection.start - 1, run: () => { if (menuSection) void changeSections(mergeSection(sections, menuSection.id, -1)); } },
      { label: 'Merge into next section', disabled: saving || !menuSection || ordered[menuIndex + 1]?.start !== menuSection.end + 1, run: () => { if (menuSection) void changeSections(mergeSection(sections, menuSection.id, 1)); } },
      { label: 'Merge selection', disabled: saving || sections.filter(s=>s.start<=selection.end && s.end>=selection.start).length<2, run:()=>void changeSections(mergeSelection(sections,selection)) },
      { label: 'Loop selection', run: () => { setLoop(true); seek(selection.start); } },
      { label: 'Delete section…', disabled: saving || !menuSection, run: () => editFromMenu(true) },
    ]} />}
  </main>;
}
