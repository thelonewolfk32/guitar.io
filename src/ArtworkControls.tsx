import { useEffect, useRef, useState } from 'react';
import { Upload, Search, X, Image } from 'lucide-react';
import type { Asset, Song, LibrarySong } from './types';
import { findArtwork, searchArtwork, imageAsset, type ArtworkCandidate } from './artwork';
import { useAssetUrl } from './ui';
export default function ArtworkControls({song,assets=[],library=[],onChange,onBusy,icons=false}:{song:Song;assets?:Asset[];library?:LibrarySong[];onChange:(song:Song,assets:Asset[])=>void;onBusy?:(busy:boolean)=>void;icons?:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[choices,setChoices]=useState<ArtworkCandidate[]>([]),[images,setImages]=useState<Record<string,Asset>>({});
  const [searching,setSearching]=useState(false),[term,setTerm]=useState(''),[preview,setPreview]=useState('');
  const saved=useAssetUrl(song.artworkAssetId);
  const upload=useRef<HTMLInputElement>(null);
  useEffect(()=>{onBusy?.(busy);},[busy,onBusy]);
  useEffect(()=>{const asset=assets.find(a=>a.id===song.artworkAssetId);if(!asset){setPreview('');return;}const url=URL.createObjectURL(asset.blob);setPreview(url);return()=>URL.revokeObjectURL(url);},[assets,song.artworkAssetId]);
  async function search(findMissing=false){setBusy(true);setError('');setSearching(true);try{
    if(findMissing){const found=await findArtwork(song,library);onChange(found.song,found.assets);}
    const results=await searchArtwork(song,term.trim() || undefined);setChoices(results);
    const loaded=await Promise.allSettled(results.map(async c=>({c,asset:await imageAsset(c.image,c.title)})));
    setImages(Object.fromEntries(loaded.flatMap(r=>r.status==='fulfilled'?[[r.value.c.image,r.value.asset]]:[])));
    if(!results.length || loaded.every(r=>r.status==='rejected'))setError('No artwork found. Try an artist and album search or upload a picture.');
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  const fileInput=<input ref={upload} className="hidden" type="file" disabled={busy} aria-label="Upload artwork" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024){setError('Use a JPG, PNG or WebP smaller than 8 MB.');return;}const asset:Asset={id:crypto.randomUUID(),kind:'artwork',name:f.name,mime:f.type,blob:f};onChange({...song,artworkAssetId:asset.id,artworkSource:undefined},[asset]);setError('');}}/>;
  return <div className="artwork-controls">
    {icons?<div className="artwork-icon-row"><div className="artwork-detail-preview">{preview || saved?<img src={preview || saved} alt="Selected album artwork"/>:<Image size={38} aria-label="No artwork"/>}</div><div className="artwork-icon-actions"><button type="button" className="artwork-icon" aria-label="Find missing artwork" title="Find missing artwork" disabled={busy} onClick={()=>void search(true)}><Search size={28}/></button><button type="button" className="artwork-icon" aria-label="Upload image" title="Upload artwork" disabled={busy} onClick={()=>upload.current?.click()}><Upload size={28}/></button><button type="button" className="artwork-icon" aria-label="Remove artwork" title="Remove artwork" disabled={busy || !song.artworkAssetId} onClick={()=>onChange({...song,artworkAssetId:undefined,artworkSource:undefined},[])}><X size={30}/></button></div>{fileInput}</div>:<><div className="artwork-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>void search(true)}><Search size={14}/>{busy?'Finding artwork…':'Find missing artwork'}</button><label className="button secondary"><Upload size={14}/>Upload artwork{fileInput}</label></div>{(preview || saved) && <div className="chosen-artwork"><img src={preview || saved} alt="Selected album artwork"/><button type="button" className="text-button" disabled={busy} onClick={()=>onChange({...song,artworkAssetId:undefined,artworkSource:undefined},[])}>Remove artwork</button></div>}</>}
    {searching && <><div className="artwork-search"><input aria-label="Artwork search" value={term} placeholder="Artist or album" onChange={e=>setTerm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!busy)void search();}}}/><button type="button" className="icon-button" aria-label="Search artwork" disabled={busy} onClick={()=>void search()}><Search size={17}/></button></div><div className="artwork-candidates">{choices.filter(c=>images[c.image]).map(c=><ArtworkChoice key={c.image} candidate={c} asset={images[c.image]} onChoose={()=>onChange({...song,artworkAssetId:images[c.image].id,artworkSource:c.source,album:song.album || c.title},[images[c.image]])}/>)}</div></>}
    {error && <p className="form-error" role="status">{error}</p>}
  </div>;
}
function ArtworkChoice({candidate,asset,onChoose}:{candidate:ArtworkCandidate;asset:Asset;onChoose:()=>void}) {
  const [url,setUrl]=useState('');useEffect(()=>{const u=URL.createObjectURL(asset.blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[asset]);
  return <button type="button" className="artwork-choice" onClick={onChoose} aria-label={`Choose ${candidate.title} artwork`}><img src={url} alt=""/><strong>{candidate.title}</strong><small>{candidate.artist}</small></button>;
}
