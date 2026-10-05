import type { LibrarySong, GuitarProfile } from './types';
import { parseTuning, readBaseScore } from './score-editing';
import { tuningCaption } from './tuning-caption';

/** Match the specific tuning bucket, rather than either setup of a retuned song. */
export function tuningHasGuitar(name: string, songs: LibrarySong[], guitars: GuitarProfile[]): boolean {
  if (!guitars.length) return false;
  return songs.some(song => {
    const candidates: number[][] = [], track = song.tracks.find(t => t.index === song.trackIndex);
    try {
      if (track && (name === track.tuning || name === song.tuning)) candidates.push(parseTuning(track.notes));
      if (name === tuningCaption(song).original) {
        if ('summaryVersion' in song) candidates.push(song.originalPitches);
        else {
        const original = readBaseScore(song).tracks[song.trackIndex]?.staves.find(s => s.tuning.length)?.tuning;
        if (original) candidates.push([...original].reverse());
        }
      }
    } catch { return false; }
    return guitars.some(g => g.tunings.some(t => candidates.some(pitches => pitches.length === t.pitches.length && pitches.every((pitch,i) => pitch === t.pitches[i]))));
  });
}
