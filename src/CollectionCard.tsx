import { Guitar, Music2, UsersRound, Camera, Pencil, ArrowUpRight } from 'lucide-react';
import { useRef, type CSSProperties } from 'react';
import { useNearViewport } from './useNearViewport';
import { useArtworkTint } from './useArtworkTint';
import type { FilterTab, LibrarySong as Song } from './types';
import { useAssetUrl, GuitarAssignmentMark } from './ui';
import { collectionProgress } from './library-model';

export const collectionKey = (tab: FilterTab, name: string) => `${tab}:${name}`;

export default function CollectionCard({ tab, name, songs, onOpen, onArtwork, onEdit, artworkAssetId, missingGuitar=false }: { missingGuitar?: boolean; artworkAssetId?: string; tab: FilterTab; name: string; songs: Song[]; onOpen: () => void; onArtwork?: (file: File) => void; onEdit?: () => void }) {
  const key = collectionKey(tab, name);
  const imageId = artworkAssetId || songs.find(s => s.collectionArt?.[key])?.collectionArt?.[key] || (tab === 'Artists' ? songs.find(s => s.artworkAssetId)?.artworkAssetId : undefined);
  const card=useRef<HTMLElement>(null),near=useNearViewport(card);
  const artwork = useAssetUrl(near?imageId:undefined);
  const Icon = tab === 'Artists' ? UsersRound : tab === 'Guitars' ? Guitar : Music2;
  const notes = songs.flatMap(s => s.tracks).find(t => t.tuning === name)?.notes;
  const stats = collectionProgress(songs), tint = useArtworkTint(artwork);
  return <article ref={card} className="collection-card" style={{ '--art-tint': tint } as CSSProperties}>
    <button className={`collection-cover collection-${tab.toLowerCase().replaceAll(' ', '-')}`} onClick={onOpen} aria-label={`Open ${name} collection`}>
      {artwork ? <img src={artwork} alt="" draggable={false} /> : <div className="collection-illustration"><Icon size={70} strokeWidth={1} />{tab === 'Tunings' && <div className="tuning-strings">{(notes || '— · — · — · — · — · —').split(' · ').map((n, i) => <div key={i}><i /><span>{n}</span></div>)}</div>}</div>}
      <span className="collection-count">{songs.length} {songs.length === 1 ? 'song' : 'songs'}</span>
    </button>
    <div className="collection-utilities">{onEdit && <button className="icon-button guitar-profile-edit" aria-label={"Edit guitar " + name} onClick={onEdit}><Pencil size={16} /></button>}
    {onArtwork && (songs.length > 0 || tab === 'Guitars') && <label className="collection-camera" tabIndex={0} role="button" aria-label={`Change ${name} picture`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.querySelector('input')?.click(); } }} title={`Change ${name} picture`}><Camera size={16} /><input className="hidden" type="file" aria-label={`Artwork for ${name}`} accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) onArtwork?.(file); e.target.value = ''; }} /></label>}
    </div><button className="collection-card-title" onClick={onOpen}><h2>{name}</h2>{missingGuitar && <GuitarAssignmentMark name={name}/>}<ArrowUpRight size={18} /></button>
    <div className="collection-distribution" aria-label={`${stats.explore} songs to explore, ${stats.progress} songs in progress, ${stats.mastered} songs mastered`}>
      <div className="collection-stats"><span className="explore"><b>{stats.explore}</b> songs to explore</span><span className="progress"><b>{stats.progress}</b> songs in progress</span><span className="mastered"><b>{stats.mastered}</b> songs mastered</span></div>
      <div className="distribution-rail" aria-hidden="true">{(['explore','progress','mastered'] as const).map(state => <i key={state} className={state} style={{width:`${songs.length ? stats[state] / songs.length * 100 : 0}%`}} />)}</div>
    </div>
  </article>;
}
