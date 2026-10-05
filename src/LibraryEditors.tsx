import { useState } from 'react';
import { Check, Download, Trash2 } from 'lucide-react';
import type { Song, Folder, Asset } from './types';
import { tuningPresets, TUNING_FAMILIES, tuningFamily } from './tunings';
import { download } from './notation';
import { Modal } from './ui';
import { correctTuningLabel } from './score-editing';
import DifficultyStars from './DifficultyStars';
import ArtworkControls from './ArtworkControls';
import TagsEditor from './TagsEditor';
const FOLDER_COLORS = [['Sage','#a7bf8c'],['Moss','#748d70'],['Teal','#6eaaa1'],['Ocean','#749aaa'],['Slate','#8c99b4'],['Lavender','#ae9fb9'],['Rose','#c399a3'],['Clay','#c3977d'],['Sand','#c8b58b'],['Olive','#acae79']] as const;
export function MetadataEditor({song,folders,guitarNames,tuningLabels,onSave,onClose,automaticGuitars=[]}:{automaticGuitars?:string[];song:Song;folders:Folder[];guitarNames:string[];tuningLabels:string[];onSave:(s:Song,assets?:Asset[])=>Promise<void>;onClose:()=>void}) {
  const [draft,setDraft]=useState(song),[assets,setAssets]=useState<Asset[]>([]),[error,setError]=useState(''),[saving,setSaving]=useState(false),[looking,setLooking]=useState(false);
  const track=draft.tracks.find(t=>t.index===draft.trackIndex);
  const labels=[...new Set([draft.tuning,...tuningLabels,...tuningPresets(track?.strings || 6,!!track && track.strings<6).map(t=>t.name)])];
  return <Modal title="Song details" onClose={()=>{if(!saving && !looking)onClose();}}><form onSubmit={async e=>{e.preventDefault();if(!draft.title.trim()){setError('A song needs a title.');return;}setSaving(true);try{await onSave({...draft,title:draft.title.trim(),artist:draft.artist.trim() || 'Unknown artist'},assets);onClose();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSaving(false);}}}>
    <label>Song title<input disabled={looking} aria-label="Song title" value={draft.title} maxLength={200} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>Artist<input disabled={looking} aria-label="Artist" value={draft.artist} maxLength={200} onChange={e=>setDraft({...draft,artist:e.target.value})}/></label>
    <label>Album<input disabled={looking} aria-label="Album" value={draft.album || ''} maxLength={200} onChange={e=>setDraft({...draft,album:e.target.value})}/></label>
    <div className="difficulty-editor"><span>Difficulty</span><DifficultyStars value={draft.difficulty} onChange={difficulty=>setDraft({...draft,difficulty})} clear/></div>
    <ArtworkControls icons song={draft} assets={assets} onBusy={setLooking} onChange={(next,added)=>{setDraft(current=>({...current,artworkAssetId:next.artworkAssetId,artworkSource:next.artworkSource,collectionArt:{...current.collectionArt,...next.collectionArt},album:current.album || next.album}));setAssets(old=>[...old,...added]);}}/>
    <label>Folder<select aria-label="Song folder" value={draft.folderId || ''} onChange={e=>setDraft({...draft,folderId:e.target.value})}><option value="">Unfiled</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label>Tuning label<select aria-label="Tuning label" value={draft.tuning} onChange={e=>{try{setDraft(correctTuningLabel(draft,e.target.value));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}}>{TUNING_FAMILIES.map(family=><optgroup key={family} label={family}>{labels.filter(name=>tuningFamily(name)===family).sort().map(name=><option key={name}>{name}</option>)}</optgroup>)}</select></label>
    <fieldset className="guitar-choices"><legend>Your guitars</legend>{[...new Set([...guitarNames,...song.guitars])].sort().map(name=><label key={name} title={automaticGuitars.includes(name)?'Automatically matched by tuning':undefined}><input type="checkbox" disabled={automaticGuitars.includes(name)} checked={automaticGuitars.includes(name)||draft.guitars.includes(name)} onChange={e=>setDraft({...draft,guitars:e.target.checked?[...draft.guitars,name]:draft.guitars.filter(g=>g!==name)})}/>{name}</label>)}</fieldset>
    <TagsEditor value={draft.tags} onChange={tags=>setDraft({...draft,tags})}/>
    <div className="file-detail"><div><strong>{song.fileName}</strong><span>{song.bars} bars · {song.tracks.length} instruments</span></div><button type="button" className="icon-button" aria-label="Export original file" onClick={()=>download(song.fileName,new Uint8Array(song.source),'application/octet-stream')}><Download size={16}/></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={saving || looking} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || looking}><Check size={15}/>{saving?'Saving…':'Save changes'}</button></div>
  </form></Modal>;
}

export function FolderEditor({ folder, onSave, onDelete, onClose }: { folder?: Folder; onSave: (f: Folder) => Promise<void>; onDelete: (id: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(folder?.name || ''), [color, setColor] = useState(folder?.color || FOLDER_COLORS[0][1]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  async function perform(remove: boolean) {
    if (!remove && !name.trim()) { setError('Give this folder a name.'); return; }
    setBusy(true);
    try { if (remove && folder) await onDelete(folder.id); else await onSave({ id: folder?.id || crypto.randomUUID(), name: name.trim(), color }); onClose(); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <Modal title={folder ? 'Edit folder' : 'New folder'} onClose={() => { if (!busy) onClose(); }}><form onSubmit={e => { e.preventDefault(); void perform(false); }}><label>Folder name<input aria-label="Folder name" value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label><fieldset className="folder-palette"><legend>Folder colour</legend>{FOLDER_COLORS.map(([name, value]) => <button key={name} type="button" aria-label={name} aria-pressed={color === value} title={name} style={{ background: value }} onClick={() => setColor(value)}>{color === value && <Check size={16} />}</button>)}</fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions">{folder ? <button type="button" className="text-button danger" onClick={() => setConfirm(true)}><Trash2 size={14} />Delete folder</button> : <span />}<button className="button primary" disabled={busy}>Save folder</button></div>{confirm && <div className="delete-confirm"><p>Delete this folder? Its songs will move to Unfiled.</p><button type="button" className="button danger-button" disabled={busy} onClick={() => perform(true)}>Delete folder, keep songs</button></div>}</form></Modal>;
}
