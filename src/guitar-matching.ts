import type { GuitarProfile, LibrarySong } from './types';
import { parseTuning, readBaseScore } from './score-editing';

/** Match the current library instrument, including saved retuning, by every string's pitch. */
export function matchesGuitarTuning(song: LibrarySong, tuning: GuitarProfile['tunings'][number]) {
  const track = song.tracks.find(t=>t.index===song.trackIndex);
  if (!track?.strings) return false;
  try {
    const pitches = parseTuning(track.notes);
    const same = (pitches:number[]) => pitches.length === tuning.pitches.length && pitches.every((p,i)=>p===tuning.pitches[i]);
    if (same(pitches)) return true;
    if ('summaryVersion' in song) return same(song.originalPitches);
    if (Object.keys(song.tuningEdits || {}).length) {
      const original = readBaseScore(song).tracks[song.trackIndex]?.staves.find(s=>s.tuning.length)?.tuning;
      return !!original && same([...original].reverse());
    }
    return false;
  } catch { return false; }
}
export function automaticGuitars(song: LibrarySong, guitars: GuitarProfile[]) {
  return guitars.filter(g=>g.tunings.some(t=>matchesGuitarTuning(song,t))).map(g=>g.name);
}
export function guitarNamesFor(song: LibrarySong, guitars: GuitarProfile[]) {
  return [...new Set([...song.guitars,...automaticGuitars(song,guitars)])].filter(n=>n.trim() && n.toLowerCase()!=='unassigned');
}
