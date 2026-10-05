import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import type { AlphaTabApi } from '@coderline/alphatab';
import { Plus, Pencil, Headphones, Upload, Youtube, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Song, Asset, MediaSource, Recording, YouTubeSync } from './types';
import { useAssetUrl, Modal } from './ui';
import { youtubeVideoId, youtubeError, validOffset } from './media-domain.mjs';
import { connectMedia, type MediaAdapter } from './media-bridge';
import { loadYouTube, type YouTubePlayer } from './youtube';
import { recordingsFor, withRecordings } from './recordings';
import {findOnlineTempo} from './online-tempo';
import YouTubeSyncEditor from './YouTubeSyncEditor';
import {youtubeSyncPoints} from './recording-sync';
import {readWorkingScore} from './score-editing';
import {barSeconds,shiftSync,playbackBpm,steppedRate} from './playback-timing';

import InstructionalControls from './InstructionalControls';
import type { InstructionalSeek } from './instructional';

type Props = { song: Song; api: AlphaTabApi | null; children: ReactNode; source: MediaSource; playbackSpeed: number; currentBar:number; onTiming:(rates:number[]|undefined,bpm:number)=>void; setSource: (s: MediaSource) => void; onSave: (s: Song, assets?: Asset[]) => Promise<void>; onAvailable: (v: boolean) => void; onSectionSpeedAvailable:(v:boolean)=>void; onRate: (v: number) => void; onInstructionalChange: (id: string) => void; instructionalSeek?: InstructionalSeek };
export default function MediaPanel(p: Props) {
  const [minimized,setMinimized]=useState(false);
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [link, setLink] = useState('');
  const [activeId, setActiveId] = useState(''), [offset, setOffset] = useState('0');
  const [label, setLabel] = useState(''), [confirmRemove, setConfirmRemove] = useState(false);
  const [tryOnline,setTryOnline]=useState(true),[useEstimate,setUseEstimate]=useState(true),[tempoMessage,setTempoMessage]=useState('');
  const [sync,setSync]=useState<YouTubeSync>();
  const [purpose,setPurpose]=useState('Full song'),[format,setFormat]=useState<'audio'|'youtube'>('audio');
  const recordingLabel=()=>{const count=recordings.filter(r=>r.label===purpose || r.label.startsWith(purpose+' ')).length;return count?`${purpose} ${count+1}`:purpose;};
  const [ytAdapter, setYtAdapter] = useState<{ id: string; adapter: MediaAdapter } | null>(null);
  const expectedRate=useRef<number | null>(null);
  const [audioReady, setAudioReady] = useState(''), [retry, setRetry] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null), ytContainer = useRef<HTMLDivElement>(null);
  const instructionalRequest = useRef(0);
  const latest = useRef(p); latest.current = p;
  const recordings = recordingsFor(p.song);
  const instructional=p.source==='instructional';
  const media = p.source === 'synth' ? undefined : recordings.find(r => r.id === activeId && (instructional ? r.kind==='youtube' && r.purpose==='instructional' : r.kind === p.source && r.purpose!=='instructional'));
  useEffect(()=>{p.onInstructionalChange(instructional?media?.id || '':'');},[instructional,media?.id]);
  const audioUrl = useAssetUrl(media?.kind === 'audio' ? media.assetId : undefined);
  const videoId = media?.kind === 'youtube' ? media.videoId : undefined;
  const secondsPerBar=useMemo(()=>{const score=readWorkingScore(p.song);return barSeconds(score,media?.youtubeSync?.enabled?playbackBpm(score,1,media.youtubeSync):media?.onlineTempo?.enabled?media.onlineTempo.bpm:undefined);},[p.song.source,p.song.tempoEdits,p.song.spliceEdits,media?.youtubeSync,media?.onlineTempo]);
  // Display the attached song's reference tempo, never the inferred local sync tempo.
  // The media bridge keeps those local tempo slopes and recording anchors internal.
  useEffect(()=>{const score=p.api?.score;if(score)p.onTiming(p.source==='youtube'?ytAdapter?.adapter.playbackRates || [1]:undefined,playbackBpm(score,1));},[p.api,p.source,ytAdapter,p.song.tempoEdits]);
  function changeOffset(bars:number){const value=bars*secondsPerBar;setSync(previous=>shiftSync(previous,value-Number(offset)));setOffset(String(value));}
  useEffect(()=>{setUseEstimate(media?.onlineTempo?.enabled ?? true);setTempoMessage('');},[media?.id,media?.onlineTempo]);
  useEffect(()=>{setSync(media?.youtubeSync);},[media?.id,media?.youtubeSync]);
  useEffect(() => { setOffset(String(media?.offsetSeconds || 0)); setLabel(media?.label || ''); setConfirmRemove(false); setDialog(null); }, [media?.id, media?.offsetSeconds, media?.label, media?.tags.join(',')]);
  useEffect(() => {
    if (!videoId || !media || !ytContainer.current) return;
    let disposed = false;
    let player: YouTubePlayer | undefined;
    let nativeFine=false,actualRate=1,rateRequest=0;
    const acceptRate=(rate:number)=>{
      if(disposed || latest.current.source==='instructional' || !Number.isFinite(rate) || rate<.25 || rate>2)return;
      actualRate=rate;
      if(expectedRate.current!==null && Math.abs(expectedRate.current-rate)<.000001){expectedRate.current=null;return;}
      const chosen=steppedRate(rate,nativeFine?undefined:player?.getAvailablePlaybackRates?.(),.25);
      latest.current.onRate(chosen);
      if(latest.current.api && latest.current.api.playbackSpeed!==chosen)latest.current.api.playbackSpeed=chosen;
    };
    const nativeMessage=(event:MessageEvent)=>{
      const frame=player?.getIframe?.();
      if(!nativeFine || !frame || event.source!==frame.contentWindow || !['https://www.youtube.com','https://www.youtube-nocookie.com'].includes(event.origin))return;
      if(event.data?.type==='guitario-youtube-rate' && event.data.videoId===videoId && event.data.request===rateRequest){
        if(event.data.failed){standardFallback(event.data.rate);setError('YouTube could not retain the fine speed. Standard video speeds are active.');}
        else if(event.data.requested)actualRate=event.data.rate;
        else acceptRate(event.data.rate);
      }
    };
    function standardFallback(value:number){
      nativeFine=false;const target=player;if(!target)return;
      const rates=target.getAvailablePlaybackRates?.() || [1],chosen=rates.reduce((best,r)=>Math.abs(r-value)<Math.abs(best-value)?r:best,rates[0]);
      expectedRate.current=chosen;target.setPlaybackRate(chosen);actualRate=chosen;latest.current.onRate(chosen);
      if(latest.current.api && latest.current.api.playbackSpeed!==chosen)latest.current.api.playbackSpeed=chosen;
      setYtAdapter(previous=>previous?{...previous}:previous);
    }
    window.addEventListener('message',nativeMessage);
    const mount = document.createElement('div'); ytContainer.current.replaceChildren(mount);
    const id = media.id;
    setError('');
    loadYouTube().then(YT => {
      if (disposed) return;
      player = new YT.Player(mount, {
        width: 480, height: 270, videoId,
        playerVars: { playsinline: 1, controls: 1, autoplay: 0, ...(location.protocol.startsWith('http') ? { origin: location.origin } : {}) },
        events: {
          onReady: async ({ target }) => {
            if (disposed) return;
            actualRate=target.getPlaybackRate();
            if(window.guitarIO?.youtubeRate){
              try{expectedRate.current=actualRate;actualRate=await window.guitarIO.youtubeRate(videoId,actualRate,++rateRequest);nativeFine=true;}
              catch{expectedRate.current=null;/* Standard rates remain usable when the native video is unavailable. */}
            }
            if(disposed)return;
            let pending: number | null = null;
            // YouTube removes its API methods on destroy. The bridge effect is
            // cleaned up afterwards, so stale adapters must remain safe to call.
            setYtAdapter({ id, adapter: {
              get duration() { return disposed ? 0 : target.getDuration?.() || 0; },
              get playbackRates() { return disposed ? [1] : nativeFine ? [] : target.getAvailablePlaybackRates?.() || [1]; },
              get currentTime() { return disposed ? 0 : pending ?? target.getCurrentTime(); },
              get paused() { return disposed || ![1, 3].includes(target.getPlayerState()); },
              get playbackRate() { return disposed ? 1 : nativeFine ? actualRate : target.getPlaybackRate(); },
              set playbackRate(v) {
                if(disposed)return;
                if(nativeFine && window.guitarIO?.youtubeRate){
                  const request=++rateRequest;expectedRate.current=v;
                  void window.guitarIO.youtubeRate(videoId,v,request).then(applied=>{if(!disposed && request===rateRequest){actualRate=applied;if(Math.abs(applied-v)>.000001)acceptRate(applied);}}).catch(()=>{
                    if(disposed || request!==rateRequest)return;
                    // Never claim a fine rate succeeded after a native control failure.
                    standardFallback(v);
                    setError('YouTube fine speed control is unavailable. Standard video speeds are active.');
                  });
                }else{const rates=target.getAvailablePlaybackRates?.() || [1],chosen=rates.reduce((best,r)=>Math.abs(r-v)<Math.abs(best-v)?r:best,rates[0]);if(target.getPlaybackRate()!==chosen){expectedRate.current=chosen;target.setPlaybackRate(chosen);}}
              },
              get volume() { return disposed ? 0 : target.getVolume() / 100; }, set volume(v) { if (!disposed) target.setVolume(v * 100); },
              seek(s) { if (disposed) return; if ([1, 2, 3].includes(target.getPlayerState())) { pending = null; target.seekTo(s, true); } else pending = s; },
              play() { if (disposed) return; if (pending !== null) { target.seekTo(pending, true); pending = null; } target.playVideo(); },
              pause() { if (!disposed) target.pauseVideo(); },
            }});
          },
          onError: e => { if (!disposed) { setError(youtubeError(e.data)); latest.current.api?.pause(); latest.current.onAvailable(false); } },
          onPlaybackRateChange: e => { if(!nativeFine)acceptRate(e.data); },
        },
      });
    }).catch(e => { if (!disposed) setError(String(e.message || e)); });
    return () => { disposed = true; expectedRate.current=null;window.removeEventListener('message',nativeMessage);setYtAdapter(null);player?.destroy(); };
  }, [videoId, media?.id, retry]);

  useEffect(() => {
    const api = p.api;
    p.onSectionSpeedAvailable(false);
    if (!api) return;
    if (p.source === 'synth' || instructional) {
      const ready = () => latest.current.onAvailable(latest.current.source==='synth');
      api.playerReady.on(ready);
      if (api.settings.player.playerMode !== window.alphaTab.PlayerMode.EnabledSynthesizer) {
        api.pause(); api.settings.player.playerMode = window.alphaTab.PlayerMode.EnabledSynthesizer; api.updateSettings();
      }
      if(instructional)api.pause();
      p.onAvailable(!instructional && api.isReadyForPlayback);
      return () => api.playerReady.off(ready);
    }
    p.onAvailable(false);
    if (!media) return;
    let adapter = ytAdapter?.id === media.id ? ytAdapter.adapter : undefined;
    if (media.kind === 'audio') {
      const audio = audioRef.current;
      if (!audio || !audioUrl || audioReady !== audioUrl) return;
      adapter = {
        get currentTime() { return audio.currentTime; }, get paused() { return audio.paused; },
        get playbackRate() { return audio.playbackRate; }, set playbackRate(v) { audio.playbackRate = v; },
        get volume() { return audio.volume; }, set volume(v) { audio.volume = v; },
        seek(s) { audio.currentTime = Math.min(s, Number.isFinite(audio.duration) ? audio.duration : s); },
        play() { return audio.play(); }, pause() { audio.pause(); },
      };
    }
    if (!adapter) return;
    try { return connectMedia(api, adapter, media.offsetSeconds, () => {latest.current.onAvailable(true);latest.current.onSectionSpeedAvailable(media.kind==='youtube' && !!media.youtubeSync?.enabled && media.youtubeSync.points.length>=2);}, setError,media.onlineTempo?.enabled?media.onlineTempo.bpm:undefined,latest.current.playbackSpeed,media.kind==='youtube'?media.youtubeSync:undefined); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not connect the recording to the score.'); }
  }, [p.api, p.source, audioReady, audioUrl, ytAdapter, media?.id, media?.offsetSeconds,media?.onlineTempo?.bpm,media?.onlineTempo?.enabled,media?.youtubeSync]);

  function selectRecording(id: string) {
    instructionalRequest.current=p.instructionalSeek?.request || 0;
    p.api?.pause(); setError(''); setActiveId(id);
    const recording=recordings.find(r=>r.id===id);p.setSource(recording?.purpose==='instructional'?'instructional':recording?.kind || 'synth');
  }
  async function addRecording(recording: Recording, assets: Asset[] = []) {
    if (recordings.length >= 200) { setError('A song can hold up to 200 recordings. Remove an unused version first.'); return; }
    setBusy(true); setError(''); selectRecording('synth');
    try {
      if(tryOnline && recording.purpose!=='instructional')recording={...recording,onlineTempo:await findOnlineTempo(p.song)};
      await p.onSave(withRecordings(latest.current.song, [...recordingsFor(latest.current.song), recording]), assets);
      setActiveId(recording.id); p.setSource(recording.purpose==='instructional'?'instructional':recording.kind); setLink('');  setDialog(null);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function saveAudio(file: File) {
    if(instructional || purpose==='Instructional video'){setError('Instructional videos use YouTube links.');return;}
    if (!/\.mp3$/i.test(file.name) || file.size > 100 * 1024 * 1024) { setError('Choose an MP3 smaller than 100 MB.'); return; }
    const asset: Asset = { id: crypto.randomUUID(), kind: 'audio', name: file.name, mime: 'audio/mpeg', blob: new Blob([file], { type: 'audio/mpeg' }) };
    await addRecording({ id: crypto.randomUUID(), kind: 'audio', assetId: asset.id, name: file.name, label: recordingLabel(), tags: [], offsetSeconds: 0, purpose: purpose==='Backing track'?'backing':'full' }, [asset]);
  }
  async function saveLink() {
    const id = youtubeVideoId(link);
    if (!id) { setError('Paste a valid YouTube video link.'); return; }
    await addRecording({ id: crypto.randomUUID(), kind: 'youtube', videoId: id, url: `https://www.youtube.com/watch?v=${id}`, label: recordingLabel(), tags: [], offsetSeconds: 0, purpose: purpose==='Instructional video'?'instructional':purpose==='Backing track'?'backing':'full' });
  }
  async function saveDetails() {
    const value = Number(offset);
    if (!instructional && (!offset.trim() || !validOffset(value))) { setError('Enter an offset between −3600 and 86400 seconds.'); return; }
    if (!media || !label.trim()) { setError('Give this recording a name.'); return; }
    if(sync?.enabled){try{youtubeSyncPoints(readWorkingScore(p.song),sync);}catch(e){setError(e instanceof Error?e.message:'Invalid sync points.');return;}}
    setBusy(true); p.api?.pause();
    try { await p.onSave(withRecordings(p.song, recordings.map(r => r.id === media.id ? { ...r, label: label.trim(), tags: r.tags, offsetSeconds: instructional ? r.offsetSeconds : value,youtubeSync:sync,onlineTempo:r.onlineTempo?{...r.onlineTempo,enabled:useEstimate}:undefined } : r))); setError(''); setDialog(null); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function removeRecording() {
    if (!media) return;
    setBusy(true); selectRecording('synth');
    try { await p.onSave(withRecordings(p.song, recordings.filter(r => r.id !== media.id))); setConfirmRemove(false); setDialog(null); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function lookupTempo(){
    if(!media || instructional)return;
    setBusy(true);p.api?.pause();setTempoMessage('Looking up song tempo…');
    try{
      const estimate=await findOnlineTempo(latest.current.song);
      if(!estimate){setTempoMessage('No confident online tempo match. The GP tempo and offset will be used.');return;}
      await latest.current.onSave(withRecordings(latest.current.song,recordingsFor(latest.current.song).map(r=>r.id===media.id?{...r,onlineTempo:estimate}:r)));
      setTempoMessage(`Found ${estimate.bpm} BPM. This estimate adjusts only this recording’s alignment.`);
    }catch(e){setTempoMessage(e instanceof Error?e.message:'Tempo lookup is unavailable.');}finally{setBusy(false);}
  }
  useEffect(()=>{
    const request=p.instructionalSeek;
    if(!request || request.request===instructionalRequest.current)return;
    if(media?.id!==request.recordingId){const recording=recordings.find(r=>r.id===request.recordingId && r.purpose==='instructional');if(recording){p.api?.pause();setActiveId(recording.id);p.setSource('instructional');}return;}
    if(ytAdapter?.id===request.recordingId){instructionalRequest.current=request.request;ytAdapter.adapter.seek(request.seconds);}
  },[p.instructionalSeek,ytAdapter,media?.id]);
  return <section className="media-panel integrated-player" aria-label="Player" onDragOver={e => { e.preventDefault(); e.stopPropagation(); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f && !busy) void saveAudio(f); }}>
    <div className="recording-tabs" role="tablist" aria-label="Playback sources">
      <button role="tab" aria-selected={p.source === 'synth'} onClick={() => selectRecording('synth')}>MIDI</button>
      {recordings.map(r => <div className="recording-tab" key={r.id}><button role="tab" aria-selected={media?.id === r.id} disabled={busy} title={[r.purpose==='instructional'?'Instructional video':r.kind === 'audio' ? 'MP3' : 'YouTube', ...r.tags].join(' · ')} onClick={() => selectRecording(r.id)}>{r.kind === 'youtube' ? <Youtube size={14} /> : <Headphones size={14} />}{r.label}</button>{media?.id === r.id && <button className="icon-button" aria-label={"Edit recording " + r.label} onClick={() => { setError('');setDialog('edit'); }}><Pencil size={13} /></button>}</div>)}
      <button className="icon-button" aria-label="Add recording" disabled={busy} onClick={() => { setError(''); setDialog('add'); }}><Plus size={17} /></button>
    </div>
    <div className={"youtube-frame " + (minimized?"youtube-minimized":"")} ref={ytContainer} style={{ display: p.source === 'youtube' || instructional ? 'block' : 'none' }} />
    {(p.source==='youtube' || instructional) && <button className="video-collapse icon-button" aria-label={minimized?'Show YouTube player':'Minimize YouTube player'} title={minimized?'Show YouTube player':'Minimize YouTube player'} aria-expanded={!minimized} onClick={()=>setMinimized(v=>!v)}>{minimized?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button>}
    {(p.source === 'youtube' || instructional) && ytAdapter?.id !== media?.id && !error && <p className="media-help">Loading YouTube…</p>}
    {instructional?<InstructionalControls adapter={ytAdapter?.id===media?.id?ytAdapter?.adapter:undefined}/>:p.children}
    <audio key={audioUrl || 'empty'} ref={audioRef} src={audioUrl || undefined} preload="metadata" hidden onLoadedMetadata={() => setAudioReady(audioUrl || '')} onError={() => { if (p.source === 'audio' && audioUrl) { setError('This MP3 could not be played. Try another MP3 export.'); p.onAvailable(false); } }} />

    {dialog === 'edit' && media && <Modal title="Recording settings" onClose={() => { if (!busy) {setDialog(null);} }}> <div className="recording-details">
      <label>Recording name<input aria-label="Recording name" maxLength={200} value={label} onChange={e => setLabel(e.target.value)} /></label>
      {!instructional && <label className="offset-slider">Offset <output>{(Number(offset)/secondsPerBar).toFixed(2).replace(/\.00$/, '')} bars</output><input aria-label="Recording offset in bars" title="Shift this recording and every sync point by up to 16 bars" type="range" min="-16" max="16" step=".01" value={Number(offset)/secondsPerBar} onChange={e=>changeOffset(Number(e.target.value))}/><span className="slider-labels"><span>−16 bars</span><span>0</span><span>+16 bars</span></span></label>}
      {!instructional && <YouTubeSyncEditor song={p.song} recording={media} value={sync} disabled={busy} onChange={v=>{if(v?.points[0]?.seconds!==sync?.points[0]?.seconds && v?.points[0])setOffset(String(v.points[0].seconds));setSync(v);}}/>}
      {!instructional && !sync?.enabled && <div className="online-tempo-settings">{media.onlineTempo && <><label className="online-tempo-choice"><input type="checkbox" aria-label="Use online tempo estimate" checked={useEstimate} onChange={e=>setUseEstimate(e.target.checked)}/>Use online tempo estimate · {media.onlineTempo.bpm} BPM</label><p className="media-help">Source: AcousticBrainz. An estimate for the original song; live versions and custom backing tracks may differ. MIDI tuning and tempo stay unchanged.</p></>}<button className="text-button" disabled={busy} onClick={lookupTempo}>Look up song BPM</button>{tempoMessage && <p className="media-help" role="status">{tempoMessage}</p>}</div>}
      <div className="recording-actions"><button className="icon-button section-confirm" title="Save recording" aria-label="Save recording" disabled={busy} onClick={saveDetails}><Check size={22} /></button><button className="icon-button danger" title="Remove recording" aria-label="Remove recording" disabled={busy} onClick={() => setConfirmRemove(true)}><Trash2 size={21} /></button></div>
      {confirmRemove && <div className="delete-confirm"><p>Remove this recording from this song?</p><button className="button danger-button" disabled={busy} onClick={removeRecording}>Remove recording</button><button className="text-button" onClick={() => setConfirmRemove(false)}>Keep recording</button></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </div></Modal>}

    {dialog === 'add' && <Modal title="Add recording" onClose={() => { if (!busy) setDialog(null); }}>
    <div className="recording-add"><div className="segmented recording-choice" role="group" aria-label="Recording version">{['Full song','Backing track','Instructional video'].map(value=><button type="button" key={value} aria-pressed={purpose===value} className={purpose===value?'active':''} onClick={()=>{setPurpose(value);if(value==='Instructional video')setFormat('youtube');}}>{value}</button>)}</div>{purpose!=='Instructional video' && <><div className="segmented recording-choice" role="group" aria-label="Recording format"><button type="button" className={format==='audio'?'active':''} aria-pressed={format==='audio'} onClick={()=>setFormat('audio')}>MP3</button><button type="button" className={format==='youtube'?'active':''} aria-pressed={format==='youtube'} onClick={()=>setFormat('youtube')}>YouTube link</button></div><label className="online-tempo-choice"><input type="checkbox" aria-label="Try online tempo estimate" checked={tryOnline} onChange={e=>setTryOnline(e.target.checked)}/>Try an online tempo estimate for initial sync</label><p className="media-help">Saved once with this recording. Offset still sets where bar 1 starts.</p></>}
      {format==='audio' && purpose!=='Instructional video'?<label className="button secondary"><Upload size={14}/>Upload MP3<input className="hidden" type="file" accept=".mp3,audio/mpeg" aria-label="Attach MP3" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void saveAudio(f);e.target.value='';}}/></label>:<div className="youtube-input"><label>YouTube link<input aria-label="YouTube video link" value={link} onChange={e=>setLink(e.target.value)}/></label><button className="button primary" disabled={busy} onClick={saveLink}><Youtube size={16}/>Add recording</button></div>}
    </div>

      {error && <p role="alert" className="form-error">{error}</p>}
    </Modal>}
    {error && !dialog && <div role="alert" className="form-error">{error}{(p.source === 'youtube' || instructional) && <button className="text-button" onClick={() => { setError(''); setRetry(v => v + 1); }}>Retry YouTube</button>}</div>}

  </section>;
}
