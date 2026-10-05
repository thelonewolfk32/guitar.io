import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Star, Circle } from 'lucide-react';
import type { Section } from './types';
import { STATUS } from './types';
import { learnedPercent } from './library-model';
import { acquireAssetUrl } from './artwork-cache';

export function Modal({ title, subtitle, onClose, children, wide = false, appearance }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; appearance?: 'story' }) {
  const ref = useRef<HTMLDivElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key === 'Tab' && ref.current) {
        const nodes = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]')].filter(n => n.offsetParent !== null);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  // Escape player/score stacking contexts while staying inside native fullscreen.
  return createPortal(<div className={`modal-backdrop ${appearance === 'story' ? 'story-backdrop' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`modal ${wide ? 'wide' : ''} ${appearance === 'story' ? 'story-window' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    {appearance !== 'story' && <div className="modal-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>}{children}
  </div></div>, document.fullscreenElement || document.body);
}

export function StatusMark({ section, text = false }: { section: Section; text?: boolean }) {
  const title = section.status === 'learning' ? `Learning · ${learnedPercent(section)}%` : STATUS[section.status];
  return <span className={`status-mark ${section.status}`} title={title} aria-label={title}>
    {section.status === 'new' ? <X size={14} /> : section.status === 'comfortable' ? <Check size={15} strokeWidth={3} /> : section.status === 'mastered' ? <Star size={15} fill="currentColor" /> : <Circle size={12} strokeWidth={3} />}
    {text && <span>{title}</span>}{!text && section.status === 'learning' && <span>{learnedPercent(section)}%</span>}
  </span>;
}

export function useAssetUrl(id?: string, original = false) {
  const [assetUrl, setAssetUrl] = useState({ id, url: '' });
  const [retry,setRetry]=useState(0);
  useEffect(()=>{if(!id||assetUrl.id===id&&assetUrl.url)return;const changed=()=>setRetry(n=>n+1);window.addEventListener('guitario:synced',changed);return()=>window.removeEventListener('guitario:synced',changed);},[id,assetUrl]);
  useEffect(() => {
    let disposed = false;
    setAssetUrl({id,url:''});
    const lease=id?acquireAssetUrl(id,original):undefined;
    lease?.promise.then(url=>{if(!disposed)setAssetUrl({id,url});}).catch(()=>{});
    return ()=>{disposed=true;lease?.release();};
  },[id,original,retry]);
  return assetUrl.id === id ? assetUrl.url : '';
}

export function GuitarAssignmentMark({ name }: { name: string }) {
  return <span className="guitar-assignment-warning" role="img" aria-label={`No guitar assigned to ${name}`} title="No guitar assigned">!</span>;
}
