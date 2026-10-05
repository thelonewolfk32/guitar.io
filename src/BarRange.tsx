import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Range } from './types';

/** Two native keyboard-accessible thumbs plus nearest-thumb track dragging. */
export default function BarRange({ value, total, onChange }: { value: Range; total: number; onChange: (value: Range) => void }) {
  const [active, setActive] = useState<'start' | 'end'>('end');
  const dragging = useRef<'start' | 'end' | null>(null);
  const percent = (bar: number) => (bar - 1) / Math.max(1, total - 1) * 100;
  function change(thumb: 'start' | 'end', bar: number) {
    onChange(thumb === 'start' ? { start: Math.min(value.end, bar), end: value.end } : { start: value.start, end: Math.max(value.start, bar) });
  }
  function at(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.max(1, Math.min(total, Math.round(1 + (event.clientX - box.left - 9) / Math.max(1, box.width - 18) * (total - 1))));
  }
  return <div className="section-range-control">
    <div className="section-control-label"><span>Bars</span><output>{value.start}–{value.end}</output></div>
    <div className="bar-range" style={{ '--range-start': `${percent(value.start)}%`, '--range-end': `${percent(value.end)}%` } as CSSProperties}
      onPointerDown={e => { if (e.target instanceof HTMLInputElement) return; e.preventDefault(); const bar = at(e); const thumb = Math.abs(bar - value.start) < Math.abs(bar - value.end) || (bar < value.start && value.start === value.end) ? 'start' : 'end'; dragging.current = thumb; setActive(thumb); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.querySelector<HTMLInputElement>(`[data-thumb="${thumb}"]`)?.focus(); change(thumb, bar); }}
      onPointerMove={e => { if (dragging.current) change(dragging.current, at(e)); }} onPointerUp={() => { dragging.current = null; }} onLostPointerCapture={() => { dragging.current = null; }}>
      <div className="bar-range-track"><div /></div>
      {(['start', 'end'] as const).map(thumb => <input key={thumb} data-thumb={thumb} aria-label={thumb === 'start' ? 'From bar' : 'To bar'} type="range" min="1" max={total} step="1" value={value[thumb]} style={{ zIndex: active === thumb ? 3 : 2 }} onFocus={() => setActive(thumb)} onChange={e => change(thumb, Number(e.target.value))} />)}
    </div>
  </div>;
}
