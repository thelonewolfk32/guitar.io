import { allNotes, readWorkingScore } from './score-editing';
import type { Song } from './types';

export const SCALES = [
  { id: 'ionian', name: 'Ionian · major', intervals: [0,2,4,5,7,9,11], degrees: ['1','2','3','4','5','6','7'], hint: 'A major sound. Resolve to 1, 3 or 5; hear how the 7 pulls back to 1.' },
  { id: 'dorian', name: 'Dorian', intervals: [0,2,3,5,7,9,10], degrees: ['1','2','♭3','4','5','6','♭7'], hint: 'Minor with a natural 6. Try a short phrase between ♭3 and 6, then settle on 1.' },
  { id: 'phrygian', name: 'Phrygian', intervals: [0,1,3,5,7,8,10], degrees: ['1','♭2','♭3','4','5','♭6','♭7'], hint: 'The ♭2 sits a semitone above the root. Use that tension deliberately and resolve it.' },
  { id: 'lydian', name: 'Lydian', intervals: [0,2,4,6,7,9,11], degrees: ['1','2','3','♯4','5','6','7'], hint: 'Major with a raised 4. Let ♯4 lead to 5 and listen against the accompaniment.' },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0,2,4,5,7,9,10], degrees: ['1','2','3','4','5','6','♭7'], hint: 'Major with a flat 7. Try 3, 5 and ♭7 over a matching dominant chord.' },
  { id: 'aeolian', name: 'Aeolian · natural minor', intervals: [0,2,3,5,7,8,10], degrees: ['1','2','♭3','4','5','♭6','♭7'], hint: 'A natural minor sound. Start with 1, ♭3 and 5, then add ♭6 for colour.' },
  { id: 'locrian', name: 'Locrian', intervals: [0,1,3,5,6,8,10], degrees: ['1','♭2','♭3','4','♭5','♭6','♭7'], hint: 'The flat 5 makes this unstable. Explore it over a matching diminished harmony.' },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', intervals: [0,3,5,7,10], degrees: ['1','♭3','4','5','♭7'], hint: 'Five notes with room for phrasing. Repeat a three-note idea, change its rhythm, then leave a rest.' },
  { id: 'major-pentatonic', name: 'Major pentatonic', intervals: [0,2,4,7,9], degrees: ['1','2','3','5','6'], hint: 'Five notes built around a major triad. Land on 1, 3 or 5 to finish a phrase.' },
  { id: 'blues', name: 'Minor blues', intervals: [0,3,5,6,7,10], degrees: ['1','♭3','4','♭5','5','♭7'], hint: 'Treat ♭5 as a passing colour between 4 and 5; listen before holding it over a chord.' },
  { id: 'harmonic-minor', name: 'Harmonic minor', intervals: [0,2,3,5,7,8,11], degrees: ['1','2','♭3','4','5','♭6','7'], hint: 'Natural minor with a raised 7. The semitone from 7 to 1 gives a strong resolution.' },
  { id: 'melodic-minor', name: 'Melodic minor · jazz', intervals: [0,2,3,5,7,9,11], degrees: ['1','2','♭3','4','5','6','7'], hint: 'Minor with natural 6 and 7 in both directions. Compare it with Dorian one note at a time.' },
];
export const pitchClass = (pitch: number) => ((pitch % 12) + 12) % 12;
export const scalePitches = (root: number, intervals: number[]) => intervals.map(i => pitchClass(root + i));
export type SongAnalysis = { weights: number[]; tuning: number[]; capo: number; program: number; frets: number[]; total: number; };

export function analyseSong(song: Song, trackIndex = song.trackIndex, start = 1, end = song.bars): SongAnalysis {
  const score = readWorkingScore(song), track = score.tracks[trackIndex];
  if (!track) throw new Error('Choose an instrument from this song.');
  const staff = track.staves.find(s => s.tuning.length && !s.isPercussion);
  const weights = Array<number>(12).fill(0), frets: number[] = [];
  for (const note of allNotes(score)) {
    const bar = note.beat.voice.bar;
    if (bar.staff.track.index !== trackIndex || bar.index + 1 < start || bar.index + 1 > end || note.isPercussion || note.isDead || note.realValue < 0 || note.realValue > 127) continue;
    // Tied destinations contribute their duration; do not count grace notes as full beats.
    weights[pitchClass(note.realValue)] += Math.max(1, note.beat.playbackDuration);
    if (note.isStringed && note.fret >= 0 && note.fret <= 24) frets.push(note.fret);
  }
  return { weights, tuning: staff ? [...staff.tuning] : [], capo: staff?.capo || 0, program: track.playbackInfo.program, frets, total: weights.reduce((a,b) => a+b,0) };
}
export function noteFit(weights: number[], pitches: number[]) {
  const total = weights.reduce((a,b) => a+b,0);
  return total ? pitches.reduce((sum,p) => sum + (weights[p] || 0),0) / total : 0;
}
export function suggestScales(weights: number[]) {
  return SCALES.flatMap(scale => Array.from({length:12},(_,root) => ({ scale, root, fit: noteFit(weights,scalePitches(root,scale.intervals)) })))
    .sort((a,b) => b.fit-a.fit || (weights[b.root] || 0)-(weights[a.root] || 0) || SCALES.indexOf(a.scale)-SCALES.indexOf(b.scale));
}
/** Compact four-fret windows ranked by scale coverage and proximity to the song's frets. */
export function handPositions(tuning: number[], pitches: number[], root: number, frets: number[] = []) {
  const sorted = [...frets].sort((a,b)=>a-b), near = sorted.length ? sorted[Math.floor(sorted.length/2)] : 5;
  const ranked = Array.from({length:21},(_,i) => {
    const start = i+1, found = new Set<number>(); let roots = 0;
    for (const open of tuning) for (let fret=start;fret<start+4;fret++) {
      const pc = pitchClass(open+fret); if (pitches.includes(pc)) { found.add(pc); if(pc===root) roots++; }
    }
    return {start,end:start+3,coverage:found.size,rank:found.size*100 + Math.min(roots,2)*5 - Math.abs(start+1.5-near)};
  }).sort((a,b)=>b.rank-a.rank);
  const chosen: typeof ranked = [];
  for (const item of ranked) if (chosen.length < 3 && !chosen.some(p=>Math.abs(p.start-item.start)<3)) chosen.push(item);
  return chosen;
}
