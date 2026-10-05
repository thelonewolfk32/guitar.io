import { Repeat2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Range } from './types';
export default function LoopControls({ range, total, enabled, onRange, onToggle, onRestart, error }: { range: Range; total: number; enabled: boolean; onRange: (range: Range) => void; onToggle: () => void; onRestart: () => void; error: string }) {
  const [start, setStart] = useState(String(range.start)), [end, setEnd] = useState(String(range.end));
  useEffect(() => setStart(String(range.start)), [range.start]);
  useEffect(() => setEnd(String(range.end)), [range.end]);
  return <div className="loop-controls">
    <button className={`icon-button ${enabled ? 'is-active' : ''}`} aria-label="Loop selected bars" aria-pressed={enabled} onClick={onToggle}><Repeat2 size={18} /></button>
    {enabled && <><label>From<input aria-label="Loop start bar" type="number" min="1" max={total} value={start} onBlur={() => setStart(String(range.start))} onChange={e => { setStart(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= total) onRange({ start: n, end: Math.max(n, range.end) }); }} /></label>
    <label>To<input aria-label="Loop end bar" type="number" min="1" max={total} value={end} onBlur={() => setEnd(String(range.end))} onChange={e => { setEnd(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= total) onRange({ start: Math.min(n, range.start), end: n }); }} /></label>
    <button className="icon-button" aria-label="Restart selection" title="Return to the start of the selected bars" onClick={onRestart}><RotateCcw size={16} /></button>
    </>}
    {error && <span className="loop-error" role="alert">{error}</span>}
  </div>;
}
