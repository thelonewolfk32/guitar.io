import { useEffect, useRef } from 'react';
export type MenuAction = { label: string; disabled?: boolean; run: () => void };
export default function SectionMenu({ x, y, actions, onClose, label = 'Section actions' }: { x: number; y: number; actions: MenuAction[]; onClose: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    const dismiss = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    window.addEventListener('pointerdown', dismiss); window.addEventListener('resize', onClose); document.addEventListener('wheel', dismiss, true);
    return () => { window.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', onClose); document.removeEventListener('wheel', dismiss, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <div className="section-context-menu" role="menu" aria-label={label} ref={ref} style={{ left: Math.max(8, Math.min(x, window.innerWidth - 268)), top: Math.max(8, Math.min(y, window.innerHeight - 360)) }} onKeyDown={e => {
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onClose(); }
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const at = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
  }}>{actions.map(action => <button role="menuitem" key={action.label} disabled={action.disabled} onClick={() => { onClose(); action.run(); }}>{action.label}</button>)}</div>;
}
