import { useMemo, useState, type CSSProperties } from 'react';
import type { model } from '@coderline/alphatab';
import type { Song, Section } from './types';
import { sectionsFor, withSections } from './library-model';
import { suggestSections } from './section-suggestions';
import { Modal, StatusMark } from './ui';
import SectionNameSelect from './SectionNameSelect';

export function songMapItems(sections: Section[], bars: number) {
  const items: { start: number; end: number; section?: Section }[] = [];
  let next = 1;
  for (const s of [...sections].sort((a, b) => a.start - b.start)) {
    if (s.start > next) items.push({ start: next, end: s.start - 1 });
    items.push({ start: s.start, end: s.end, section: s }); next = s.end + 1;
  }
  if (next <= bars) items.push({ start: next, end: bars });
  return items;
}

export function SongMap({ song, currentBar, onChoose, onClose }: { song: Song; currentBar: number; onChoose: (start: number, end: number) => void; onClose: () => void }) {
  return <Modal title="Song map" subtitle={song.tracks.find(t => t.index === song.trackIndex)?.name} onClose={onClose} wide>
    <div className="section-map-grid">{songMapItems(sectionsFor(song), song.bars).map((item, i) => <button key={i} className={`map-section ${!item.section ? 'unlabelled' : ''} ${currentBar >= item.start && currentBar <= item.end ? 'current' : ''}`} style={{ '--section-color': item.section?.color || '#758590' } as CSSProperties} onClick={() => { onChoose(item.start, item.end); onClose(); }}><span className="map-order">{String(i + 1).padStart(2, '0')}</span><strong>{item.section?.name || 'Unlabelled'}</strong><span>Bars {item.start}–{item.end}</span>{item.section && <StatusMark section={item.section} />}</button>)}</div>
  </Modal>;
}

export function SuggestionDialog({ song, score, onSave, onClose }: { song: Song; score: model.Score; onSave: (s: Song) => Promise<void>; onClose: () => void }) {
  const [length, setLength] = useState(4), [renames, setRenames] = useState<Record<number, string>>({}), [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sections = sectionsFor(song);
  const suggestions = useMemo(() => suggestSections(score, song.trackIndex, length), [score, song.trackIndex, length]);
  const overlaps = (s: Section) => sections.some(existing => s.start <= existing.end && s.end >= existing.start);
  const additions = suggestions.filter(s => !overlaps(s) && !excluded.has(s.start));
  async function accept() {
    if (!additions.length) return;
    setBusy(true);
    try { await onSave(withSections(song, [...sections, ...additions.map(({ reason: _reason, repeated: _repeated, ...s }) => ({ ...s, name: renames[s.start]?.trim() || s.name }))].sort((a, b) => a.start - b.start))); onClose(); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <Modal title="Suggested sections" onClose={() => { if (!busy) onClose(); }} wide>
    <label>Phrase size<select aria-label="Suggested phrase length" value={length} onChange={e => { setLength(Number(e.target.value)); setRenames({}); setExcluded(new Set()); }}>{[2, 4, 8].map(n => <option key={n} value={n}>{n} bars</option>)}</select></label>
    <div className="suggestion-list">{suggestions.map(s => <div key={s.start} className={`suggestion-row ${overlaps(s) ? 'already-labelled' : ''}`}><input type="checkbox" aria-label={`Include bars ${s.start} to ${s.end}`} disabled={overlaps(s)} checked={!overlaps(s) && !excluded.has(s.start)} onChange={e => setExcluded(previous => { const next = new Set(previous); if (e.target.checked) next.delete(s.start); else next.add(s.start); return next; })} /><i style={{ background: s.color }} /><div><SectionNameSelect label={`Suggested name for bar ${s.start}`} value={renames[s.start] ?? s.name} disabled={overlaps(s)} onChange={name=>setRenames({...renames,[s.start]:name})}/><span>Bars {s.start}–{s.end} · {overlaps(s) ? 'Already labelled — kept as saved' : s.reason}</span></div></div>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !additions.length} onClick={accept}>Add {additions.length} sections</button></div>
  </Modal>;
}
