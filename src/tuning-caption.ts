import type { LibrarySong, Track } from './types';
import { readScore, scoreMetadata } from './notation';
import { allNotes, readWorkingScore, readBaseScore } from './score-editing';

const originals = new WeakMap<Uint8Array, Track[]>();
export function tuningCaption(song: LibrarySong): { original: string; change: string } {
  if ('summaryVersion' in song) return song.tuningCaption;
  try {
    let tracks = song.sourceTunings ? scoreMetadata(readBaseScore(song)).tracks : originals.get(song.source);
    if (!tracks) { tracks = scoreMetadata(readScore(song.source, song.fileName)).tracks; originals.set(song.source, tracks); }
    const original = tracks.find(t => t.index === song.trackIndex), current = song.tracks.find(t => t.index === song.trackIndex);
    if (!original) return { original: song.tuning, change: '' };
    if (current && original.notes !== current.notes) return { original: original.tuning, change: `(transposed to ${current.tuning})` };
    // A pitch transposition without retuning does not change the open-string tuning.
    if (Object.keys(song.noteEdits || {}).some(k => k.startsWith(`${song.trackIndex}:`))) {
      const before = allNotes(readScore(song.source, song.fileName)).filter(n => n.beat.voice.bar.staff.track.index === song.trackIndex && !n.isPercussion);
      const after = allNotes(readWorkingScore(song)).filter(n => n.beat.voice.bar.staff.track.index === song.trackIndex && !n.isPercussion);
      const delta = after[0]?.realValue - before[0]?.realValue;
      if (delta && before.length === after.length && before.every((n, i) => after[i].realValue - n.realValue === delta)) return { original: original.tuning, change: `(notes transposed ${delta > 0 ? '+' : ''}${delta} semitones)` };
    }
    return { original: original.tuning, change: '' };
  } catch { return { original: song.tuning, change: '' }; }
}
export function tuningBuckets(song: LibrarySong) {
  if ('summaryVersion' in song) return song.tuningBuckets || [song.tuning];
  const caption = tuningCaption(song), current = song.tracks?.find(t=>t.index === song.trackIndex)?.tuning || song.tuning;
  return [...new Set([caption.original, Object.keys(song.tuningEdits || {}).length ? current : song.tuning].filter(Boolean))];
}
