export type TuningPreset = { id: string; name: string; pitches: number[]; family: 'Standard' | 'Drop' | 'Open' };
export const PITCH_CLASSES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const midiName = (pitch: number) => `${PITCH_CLASSES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
export function baseTuning(strings = 6, bass = false): number[] {
  if (bass) return ({ 4: [28,33,38,43], 5: [23,28,33,38,43], 6: [23,28,33,38,43,48] } as Record<number, number[]>)[strings] || [28,33,38,43];
  return ({ 6: [40,45,50,55,59,64], 7: [35,40,45,50,55,59,64], 8: [30,35,40,45,50,55,59,64] } as Record<number, number[]>)[strings] || Array.from({ length: strings }, (_, i) => 40 + i * 5);
}
export function tuningPresets(strings = 6, bass = false): TuningPreset[] {
  const base = baseTuning(strings, bass), result: TuningPreset[] = [];
  for (const family of ['Standard', 'Drop'] as const) for (let shift = 0; shift >= -12; shift--) {
    const pitches = base.map((p, i) => p + shift - (family === 'Drop' && i === 0 ? 2 : 0));
    const root = PITCH_CLASSES[(pitches[0] + 120) % 12];
    result.push({ id: `${bass ? 'bass' : 'guitar'}-${strings}-${family}-${shift}`, name: `${family === 'Drop' ? 'Drop ' + root : root + ' standard'}${shift === -12 ? ' (octave lower)' : ''}`, pitches, family });
  }
  if (!bass && strings >= 6) for (const [name, six] of [['Open D', [38,45,50,54,57,62]], ['Open G', [38,43,50,55,59,62]], ['Open C', [36,43,48,55,60,64]], ['DADGAD', [38,45,50,55,57,62]]] as const) {
    result.push({ id: `${strings}-${name}`, name, pitches: [...base.slice(0, strings - 6), ...six], family: 'Open' });
  }
  return result;
}
export function tuningName(highToLow: number[], bass = false) {
  const preset = tuningPresets(highToLow.length, bass).find(t => t.pitches.join(',') === [...highToLow].reverse().join(','));
  return preset ? `${preset.name}${highToLow.length > 6 ? ` · ${highToLow.length}-string` : ''}` : [...highToLow].reverse().map(midiName).join(' · ');
}

export { auditionPitches } from './preview-audio';
export const TUNING_FAMILIES = ['Drop', 'Open', 'Standard', 'Custom'] as const;
export type TuningFamily = typeof TUNING_FAMILIES[number];
export function tuningFamily(name: string, pitches?: number[], bass = false): TuningFamily {
  const preset = pitches && tuningPresets(pitches.length, bass).find(t => t.pitches.join() === pitches.join());
  if (preset) return preset.family;
  if (/^drop /i.test(name)) return 'Drop';
  if (/standard/i.test(name)) return 'Standard';
  if (/^open |^dadgad$/i.test(name)) return 'Open';
  return 'Custom';
}
