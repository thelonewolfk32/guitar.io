import { useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import type { LibrarySong, Song, Folder, Asset, GuitarProfile } from './types';
import { Modal } from './ui';
import { tuningPresets } from './tunings';
import { correctTuningLabel } from './score-editing';
import DifficultyStars from './DifficultyStars';
import { automaticGuitars } from './guitar-matching';
import ArtworkControls from './ArtworkControls';
import TagsEditor from './TagsEditor';
export const duplicateName = (a:Pick<Song,'title'|'artist'>,b:Pick<Song,'title'|'artist'>) => a.title.trim().toLocaleLowerCase()===b.title.trim().toLocaleLowerCase() && a.artist.trim().toLocaleLowerCase()===b.artist.trim().toLocaleLowerCase();
export default function ImportReview({songs,assets,library=[],folders,guitarNames,guitars,onSave,onClose}:{guitars:GuitarProfile[];songs:Song[];assets:Asset[];library?:LibrarySong[];folders:Folder[];guitarNames:string[];onSave:(songs:Song[],assets:Asset[])=>Promise<void>;onClose:()=>void}) {
  const [drafts,setDrafts]=useState(songs),[index,setIndex]=useState(0),[extra,setExtra]=useState<Asset[]>([]),[busy,setBusy]=useState(false),[looking,setLooking]=useState(false),[error,setError]=useState('');
  const song=drafts[index],matched=automaticGuitars(song,guitars),duplicate=[...library,...drafts.filter((_,i)=>i!==index)].some(s=>duplicateName(song,s));
  function update(patch:Partial<Song>){setDrafts(items=>items.map((s,i)=>i===index?{...s,...patch}:s));}
  return <Modal title="Review import" onClose={()=>{if(!busy && !looking)onClose();}}><form onSubmit={async e=>{e.preventDefault();const missing=drafts.findIndex(s=>!s.title.trim());if(missing>=0){setIndex(missing);setError('Give this song a title.');return;}setBusy(true);setError('');try{await onSave(drafts.map(s=>({...s,title:s.title.trim(),artist:s.artist.trim()||'Unknown artist',album:s.album?.trim()||''})),extra);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}>
    {drafts.length>1 && <label>Review song<select disabled={looking} aria-label="Review song" value={index} onChange={e=>setIndex(Number(e.target.value))}>{drafts.map((s,i)=><option key={s.id} value={i}>{i+1}. {s.title}</option>)}</select></label>}
    <div className="import-file-summary"><strong>{song.fileName}</strong></div>
    <label>Song title<input disabled={looking} aria-label="Import song title" value={song.title} maxLength={200} onChange={e=>update({title:e.target.value})}/></label>
    <label>Artist<input disabled={looking} aria-label="Import artist" value={song.artist} maxLength={200} onChange={e=>update({artist:e.target.value})}/></label>
    {duplicate && <p className="duplicate-warning" role="status"><AlertTriangle size={16}/>This song may already exist. Rename this version to distinguish it.</p>}
    <label>Album<input disabled={looking} aria-label="Import album" value={song.album||''} maxLength={200} onChange={e=>update({album:e.target.value})}/></label>
    <div className="difficulty-editor"><span>Difficulty</span><DifficultyStars value={song.difficulty} onChange={difficulty=>update({difficulty})} clear/></div>
    <ArtworkControls key={song.id} song={song} onBusy={setLooking} assets={[...assets,...extra]} library={library} onChange={(next,added)=>{update({artworkAssetId:next.artworkAssetId,artworkSource:next.artworkSource,collectionArt:{...song.collectionArt,...next.collectionArt},album:song.album || next.album});setExtra(old=>[...old,...added]);}}/>
    <label>Tuning label<select aria-label="Import tuning label" value={song.tuning} onChange={e=>{try{update(correctTuningLabel(song,e.target.value));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}}>{[...new Set([song.tuning,...tuningPresets(song.tracks.find(t=>t.index===song.trackIndex)?.strings||6).map(t=>t.name)])].map(name=><option key={name}>{name}</option>)}</select></label>
    <label>Folder<select aria-label="Import folder" value={song.folderId||''} onChange={e=>update({folderId:e.target.value})}><option value="">Unfiled</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    {!!guitarNames.length && <fieldset className="guitar-choices"><legend>Your guitars</legend>{guitarNames.map(name=><label key={name} title={matched.includes(name)?'Automatically matched by tuning':undefined}><input type="checkbox" disabled={matched.includes(name)} checked={matched.includes(name)||song.guitars.includes(name)} onChange={e=>update({guitars:e.target.checked?[...song.guitars,name]:song.guitars.filter(g=>g!==name)})}/>{name}</label>)}</fieldset>}
    <TagsEditor value={song.tags} onChange={tags=>update({tags})}/>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy || looking} onClick={onClose}>Cancel import</button><button className="button primary" disabled={busy || looking}><Check size={16}/>{busy?'Saving…':`Import ${drafts.length} ${drafts.length===1?'song':'songs'}`}</button></div>
  </form></Modal>;
}
