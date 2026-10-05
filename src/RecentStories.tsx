import { useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { LibrarySong } from './types';
import { songProgress } from './library-model';
import { Modal, useAssetUrl } from './ui';
import { StoryPlayer } from './story-player';
import { recentPreviewCache } from './story-cache';
import {SongProgressBar,MasteredStamp} from './SongProgress';

export function recentSongs(songs: LibrarySong[]) {
  return songs.filter(s => s.lastPlayedAt && Number.isFinite(Date.parse(s.lastPlayedAt)))
    .sort((a, b) => b.lastPlayedAt!.localeCompare(a.lastPlayedAt!) || a.id.localeCompare(b.id)).slice(0, 10);
}
function Circle({ song, onClick }: { song: LibrarySong; onClick: () => void }) {
  const art = useAssetUrl(song.artworkAssetId);
  return <button className="recent-story" aria-label={`Preview ${song.title}`} onClick={onClick}><span className="story-ring"><span>{art ? <img src={art} alt=""/> : <AudioLines size={30}/>}</span></span><MasteredStamp song={song}/><span className="story-title" title={song.title}>{song.title}</span></button>;
}
export default function RecentStories({ songs, onOpen }: { songs: LibrarySong[]; onOpen: (song: LibrarySong) => void }) {
  const recent = recentSongs(songs), [session, setSession] = useState<{ids:string[];index:number} | null>(null);
  const [elapsed, setElapsed] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [previewMeta,setPreviewMeta]=useState<{tuning:string;bpm:number}>();
  const player = useRef<StoryPlayer | null>(null), advance = useRef<() => void>(() => {}), elapsedRef = useRef(0);
  useEffect(()=>{recentPreviewCache.setRecent(recent);},[songs]);
  const song = session ? songs.find(s => s.id === session.ids[session.index]) : undefined;
  const art = useAssetUrl(song?.artworkAssetId,true);
  function close() { player.current?.destroy(); player.current = null; setSession(null); }
  function next(direction = 1) {
    if (!session) return;
    const index = session.index + direction;
    if (index < 0) return;
    if (index >= session.ids.length) { close(); return; }
    setSession({...session,index});
  }
  advance.current = () => next();
  useEffect(() => {
    if (!song || !session) return;
    let disposed = false; setReady(false); setPreviewMeta(undefined);setError(''); elapsedRef.current = 0; setElapsed(0); player.current?.cancel();
    recentPreviewCache.load(song).then(async preview => {
      if (disposed) return;
      const meta=await player.current?.load(preview); if (!disposed) {setPreviewMeta(meta);setReady(true);}
    }).catch(e => { if (!disposed) setError(e instanceof Error ? e.message : 'Could not play this preview.'); });
    return () => { disposed = true; player.current?.cancel(); };
  },[song?.id,song?.updatedAt,song?.trackIndex,session?.index]);
  useEffect(() => {
    if (!ready) return;
    let frame = 0, finished=false, previous = performance.now();
    const end=()=>{if(finished)return;finished=true;clearTimeout(timer);cancelAnimationFrame(frame);elapsedRef.current=10;setElapsed(10);advance.current();};
    const timer=setTimeout(end,Math.max(0,(10-elapsedRef.current)*1000));
    const update = (now: number) => {
      elapsedRef.current = Math.min(10, elapsedRef.current + (now - previous) / 1000); previous = now; setElapsed(elapsedRef.current);
      if (elapsedRef.current >= 10) end(); else frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => {clearTimeout(timer);cancelAnimationFrame(frame);};
  },[ready,song?.id]);
  useEffect(() => () => { player.current?.destroy(); player.current = null; },[]);
  return <section className="recent-stories" aria-label="Recently played songs"><div className="recent-label">RECENTLY PLAYED</div>
    {recent.length ? <div className="stories-row">{recent.map(s => <Circle key={s.id} song={s} onClick={() => {
      try { player.current?.destroy(); player.current = new StoryPlayer(); setSession({ids:recent.map(s=>s.id),index:recent.findIndex(r=>r.id===s.id)}); }
      catch(e) { setError(String(e)); }
    }}/>)}</div> : <p className="stories-empty">Play a song to add it here.</p>}
    {session && song && <Modal title={song.title} onClose={close} appearance="story">
      <button className="story-cover" aria-label={`Open ${song.title} in full viewer`} onClick={()=>{close();onOpen(song);}}>{art ? <img src={art} alt={`${song.title} artwork`}/> : <AudioLines size={90}/>}</button>
      <div className="story-shade" aria-hidden="true"/>
      <div className="story-top"><div className="story-segments" aria-label={`Preview ${session.index+1} of ${session.ids.length}`}>{session.ids.map((id,i)=><div key={id} role={i===session.index?'progressbar':undefined} aria-label={i===session.index?'Preview progress':undefined} aria-valuemin={i===session.index?0:undefined} aria-valuemax={i===session.index?100:undefined} aria-valuenow={i===session.index?Math.round(elapsed*10):undefined}><i style={{width:`${i<session.index ? 100 : i===session.index ? elapsed*10 : 0}%`}}/></div>)}</div><div className="story-top-row"><span>RECENTLY PLAYED</span><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div></div>
      <div className="story-bottom"><div className="story-track"><div className="story-title-row"><h2>{song.title}</h2><MasteredStamp song={song}/></div><p>{song.artist}</p><small className="story-music-meta" title={[previewMeta?.tuning || song.tracks.find(t=>t.index===song.trackIndex)?.tuning || song.tuning,...(song.guitars.length?song.guitars:['No guitar assigned'])].join(' | ')}>{[previewMeta?.tuning || song.tracks.find(t=>t.index===song.trackIndex)?.tuning || song.tuning,...(song.guitars.length?song.guitars:['No guitar assigned'])].join(' | ')}</small></div><div className="story-learning"><strong>{songProgress(song)}% learnt</strong></div><SongProgressBar song={song} className="story-learning-bar"/><div className="story-controls"><button className="icon-button" aria-label="Previous preview" disabled={session.index===0} onClick={()=>next(-1)}><ChevronLeft/></button><span role="status">{error?'Preview unavailable':ready?'':'Loading MIDI…'}</span><button className="icon-button" aria-label="Next preview" onClick={()=>next()}><ChevronRight/></button></div>{error && <p className="form-error" role="alert">{error}</p>}</div>
    </Modal>}
  </section>;
}
