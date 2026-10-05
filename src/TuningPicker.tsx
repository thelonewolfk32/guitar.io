import { useState } from 'react';

import { Volume2 } from 'lucide-react';

import { auditionPitches, midiName, PITCH_CLASSES, tuningPresets, TUNING_FAMILIES, type TuningFamily } from './tunings';



export default function TuningPicker({ pitches, onChange, bass = false, quiet = false }: { quiet?: boolean; pitches: number[]; onChange: (p: number[]) => void; bass?: boolean }) {

  const presets = tuningPresets(pitches.length, bass);

  const matching = presets.find(t => t.pitches.join(',') === pitches.join(','));

  const [family, setFamily] = useState<TuningFamily | null>(null);

  const [error, setError] = useState('');

  const custom = family === 'Custom';

  function preview(p: number[]) { setError(''); void auditionPitches(p).catch(() => setError('Guitar preview is unavailable. Try again.')); }

  function changeString(index: number, value: number) {

    const next = [...pitches]; next[index] = value; onChange(next); preview([value]);

  }

  return <div className="tuning-picker">

    <div className="tuning-families" aria-label="Tuning categories">{TUNING_FAMILIES.map(f => <button key={f} type="button" aria-expanded={family === f} onClick={() => setFamily(family === f ? null : f)}>{f.toUpperCase()}</button>)}</div>

    {family && family !== 'Custom' && <label>{family} tuning<select aria-label="Tuning preset" value={matching?.family === family ? matching.id : ''} onChange={e => { const preset = presets.find(t => t.id === e.target.value); if (preset) { onChange([...preset.pitches]); preview(preset.pitches); } }}>

      <option value="" disabled>Select tuning</option>{presets.filter(t => t.family === family).map(t => <option key={t.id} value={t.id}>{t.name} · {midiName(t.pitches[0])}–{midiName(t.pitches.at(-1)!)}</option>)}

    </select>{!presets.some(t => t.family === family) && <small>Use Custom to set an open tuning for this instrument.</small>}</label>}

    {error && <p className="form-error" role="alert">{error}</p>}

    <div className="tuning-preview">{pitches.map((p, i) => <button key={i} type="button" title={`Hear string ${pitches.length - i}: ${midiName(p)}`} aria-label={`Hear string ${pitches.length - i}`} onClick={() => preview([p])}>{midiName(p)}</button>)}{!quiet && <button type="button" aria-label="Hear tuning" onClick={()=>preview(pitches)}><Volume2 size={16}/></button>}</div>

    {custom && <div className={`headstock-editor strings-${pitches.length}`} aria-label={`${bass ? 'Bass' : 'Guitar'} ${pitches.length}-string headstock`}>

      <svg className="headstock" viewBox={`0 0 160 ${pitches.length * 45 + 40}`} preserveAspectRatio="none" aria-hidden="true"><path d={`M40 20 Q80 0 120 20 L130 ${pitches.length * 45} L105 ${pitches.length * 45 + 25} L55 ${pitches.length * 45 + 25} L30 ${pitches.length * 45} Z`} fill="#5d4937" stroke="#bc9a6c" strokeWidth="2" />{pitches.map((_, i) => <g key={i}><path d={`M${57 + i * 7} ${pitches.length * 45 + 30} L${57 + i * 7} ${i * 45 + 32} L24 ${i * 45 + 32}`} stroke="#c1c7c4" strokeWidth={2 - i * 0.12} fill="none"/><circle cx="24" cy={i * 45 + 32} r="7" fill="#c4ccca"/></g>)}</svg>

      <div className="tuning-pegs">{pitches.map((pitch, i) => <div key={i} className="tuning-peg"><span>{pitches.length - i}</span><select aria-label={`String ${pitches.length - i} note`} value={pitch % 12} onChange={e => changeString(i, Math.floor(pitch / 12) * 12 + Number(e.target.value))}>{PITCH_CLASSES.map((name, value) => <option key={value} value={value} disabled={Math.floor(pitch / 12) * 12 + value > 127}>{name}</option>)}</select><select aria-label={`String ${pitches.length - i} octave`} value={Math.floor(pitch / 12) - 1} onChange={e => changeString(i, (Number(e.target.value) + 1) * 12 + pitch % 12)}>{Array.from({ length: 11 }, (_, n) => n - 1).map(o => <option key={o} value={o} disabled={(o + 1) * 12 + pitch % 12 > 127}>{o}</option>)}</select><button type="button" className="icon-button" aria-label={`Preview string ${pitches.length - i}`} onClick={() => preview([pitch])}><Volume2 size={15} /></button></div>)}</div>

    </div>}

  </div>;

}

