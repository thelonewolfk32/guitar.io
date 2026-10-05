import type { Song, SongSummary } from './types';
import { songProgress, songProgressSplit, collectionProgress, assetIds } from './library-model';
import { tuningCaption, tuningBuckets } from './tuning-caption';
import { parseTuning, readBaseScore } from './score-editing';
import { recordingsFor } from './recordings';

export function summarizeSong(song: Song): SongSummary {
  const caption = tuningCaption(song);
  let originalPitches: number[] = [];
  try {
    const current = song.tracks?.find(t => t.index === song.trackIndex);
    originalPitches = current ? parseTuning(current.notes) : [];
    if (Object.keys(song.tuningEdits || {}).length) {
      const tuning = readBaseScore(song).tracks[song.trackIndex]?.staves.find(s => s.tuning.length)?.tuning;
      if (tuning) originalPitches = [...tuning].reverse();
    }
  } catch { /* A legacy unsupported tuning keeps its visible label. */ }
  const stats = collectionProgress([song]);
  return {
    summaryVersion: 1, songsterr: song.songsterr, id: song.id, title: song.title, artist: song.artist, album: song.album,
    difficulty: song.difficulty, tuning: song.tuning, guitars: song.guitars || [], tags: song.tags || [],
    fileName: song.fileName, format: song.format, hash: song.hash, bars: song.bars, bpm: song.bpm,
    tracks: song.tracks || [], trackIndex: song.trackIndex, folderId: song.folderId,
    artworkAssetId: song.artworkAssetId, collectionArt: song.collectionArt, demo: song.demo,
    createdAt: song.createdAt, updatedAt: song.updatedAt, lastOpenedAt: song.lastOpenedAt,
    lastPlayedAt: song.lastPlayedAt, lastPlayedBar: song.lastPlayedBar,
    progress: songProgress(song), progressSplit: songProgressSplit(song), progressState: stats.mastered ? 'mastered' : stats.progress ? 'progress' : 'explore',
    tuningCaption: caption, tuningBuckets: tuningBuckets(song), originalPitches,
    recordingKinds: [...new Set(recordingsFor(song).map(r => r.kind))], assetIds: assetIds(song),
  };
}
