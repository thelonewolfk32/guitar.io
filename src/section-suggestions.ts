import type { model } from '@coderline/alphatab';
import type { Section } from './types';
import { COLORS } from './types';

export type Suggestion = Section & { reason: string; repeated: boolean };

function barFingerprint(bar: model.Bar | undefined): string {
  if (!bar) return 'rest';
  return bar.voices.map(voice => voice.beats.map(beat => [beat.duration, beat.dots, beat.tupletNumerator, beat.tupletDenominator, beat.isRest ? 'rest' : beat.notes.map(n => `${n.string}:${n.fret}:${n.realValue}`).sort().join(',')].join(':')).join(';')).join('/');
}

/** Fast, deterministic phrase hints, not semantic recognition of verses/choruses. */
export function suggestSections(score: model.Score, trackIndex: number, phraseLength = 4): Suggestion[] {
  const track = score.tracks[trackIndex];
  if (!track) return [];
  const total = score.masterBars.length;
  const signatures = Array.from({ length: total }, (_, i) => track.staves.map(staff => barFingerprint(staff.bars[i])).join('||'));
  const silent = Array.from({ length: total }, (_, i) => track.staves.every(staff => (staff.bars[i]?.voices || []).every(v => v.beats.every(b => b.isRest || b.notes.length === 0))));
  const markers = new Map(score.masterBars.filter(b => b.section?.text || b.section?.marker).map(b => [b.index, b.section!.text || b.section!.marker]));
  const blocks: { start: number; end: number; signature: string; silent: boolean; marker?: string }[] = [];
  for (let i = 0; i < total;) {
    const start = i;
    const isRest = silent[i];
    let end = Math.min(total, i + phraseLength);
    // Start a new phrase at an imported marker or a rest/activity boundary.
    for (let j = i + 1; j < end; j++) if (markers.has(j) || silent[j] !== isRest) { end = j; break; }
    blocks.push({ start: start + 1, end, signature: signatures.slice(start, end).join('|'), silent: isRest, marker: markers.get(start) });
    i = end;
  }
  const occurrences = new Map<string, number>();
  for (const block of blocks) occurrences.set(block.signature, (occurrences.get(block.signature) || 0) + 1);
  const names = new Map<string, { name: string; color: string }>();
  let phrase = 0;
  const suggestions: Suggestion[] = [];
  for (const b of blocks) {
    const repeated = (occurrences.get(b.signature) || 0) > 1;
    if (!names.has(b.signature)) {
      const index = phrase++;
      names.set(b.signature, { name: `Phrase ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`, color: COLORS[index % COLORS.length] });
    }
    const identity = names.get(b.signature)!;
    const name = b.marker || (b.silent ? 'Rest / break' : identity.name);
    const last = suggestions.at(-1);
    if (last && last.name === name && !b.marker && last.end === b.start - 1) { last.end = b.end; continue; }
    suggestions.push({ id: crypto.randomUUID(), name, start: b.start, end: b.end, color: b.silent ? '#758590' : identity.color, status: 'new', learnedPercent: 0, notes: '', repeated, reason: b.marker ? 'Marker already in the file' : b.silent ? 'No notes on this instrument' : repeated ? 'Matching notes and rhythm recur on this instrument' : `${phraseLength}-bar phrase boundary; review by ear` });
  }
  return suggestions;
}
