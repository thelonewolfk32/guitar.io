import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import type { SongsterrImportResult, SongsterrSyncResult } from './songsterr-score';

declare global { interface Window { guitarIO?: { lookupSongTempo:(song:{title:string;artist:string;album?:string;bpm:number})=>Promise<import('./types').OnlineTempo | undefined>; downloadSongsterr: (url: string) => Promise<SongsterrImportResult>; songsterrSync:(url:string)=>Promise<SongsterrSyncResult>; youtubeRate?:(videoId:string,rate:number,request:number)=>Promise<number>; openLearn:(id:string)=>Promise<void>; updateLearn:(id:string)=>void; onLearnContext:(callback:(id:string)=>void)=>()=>void } } }

export default function SongsterrImport({ onImport, disabled }: { onImport:(data:SongsterrImportResult) => Promise<void>; disabled:boolean }) {
  const [url,setUrl] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const mounted = useRef(true), inFlight=useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function download(value=url) {
    if(disabled || inFlight.current)return;
    setError('');
    let parsed: URL;
    try { parsed = new URL(value.trim()); if (parsed.protocol !== 'https:' || !['songsterr.com','www.songsterr.com'].includes(parsed.hostname) || parsed.username || parsed.password || parsed.port) throw new Error(); }
    catch { setError('Paste an HTTPS Songsterr song link.'); return; }
    if (!window.guitarIO) { setError('Songsterr link import is available in the desktop app for Windows and Mac.'); return; }
    inFlight.current=true;setBusy(true);
    try { const data = await window.guitarIO.downloadSongsterr(parsed.href); if (mounted.current) await onImport(data); }
    catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : 'Could not download this tab.'); }
    finally { inFlight.current=false;if(mounted.current)setBusy(false); }
  }
  return <section className="songsterr-import"><h3>Songsterr</h3><div className="songsterr-entry"><input aria-label="Songsterr song link" placeholder="Paste a Songsterr URL to add the song" type="url" value={url} disabled={busy || disabled} onChange={e => setUrl(e.target.value)} onPaste={e=>{const value=e.clipboardData.getData('text').trim();if(value){e.preventDefault();setUrl(value);void download(value);}}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void download();}}}/><button className="button primary" disabled={busy || disabled || !url.trim()} onClick={() => void download()}><Download size={16}/>{busy ? 'Importing…' : 'Import'}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</section>;
}
