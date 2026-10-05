import type { Section, Song, LibrarySong, Progress, ProgressSplit } from './types';
import { recordingsFor } from './recordings';
import { normalizeSectionNames } from './section-names';

export function learnedPercent(section: Section): number {
  if (section.status === 'new') return 0;
  if (section.status === 'mastered') return 100;
  if (section.status === 'comfortable') return Math.max(90, Math.min(99, Math.round(section.learnedPercent ?? 90)));
  return Math.max(0, Math.min(100, Math.round(section.learnedPercent ?? 25)));
}

export function withLearningPercent(section: Section, value: number): Section {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return { ...section, learnedPercent: percent, status: percent === 0 ? 'new' : percent === 100 ? 'mastered' : percent >= 90 ? 'comfortable' : 'learning' };
}

export function withStatus(section: Section, status: Progress): Section {
  return { ...section, status, learnedPercent: status === 'new' ? 0 : status === 'comfortable' ? 90 : status === 'mastered' ? 100 : section.status === 'learning' ? learnedPercent(section) : 25 };
}

export function sectionsFor(song: Song, trackIndex = song.trackIndex): Section[] {
  return normalizeSectionNames(song.sectionsByTrack?.[String(trackIndex)] ?? song.sections ?? []);
}

export function withSections(song: Song, sections: Section[], trackIndex = song.trackIndex): Song {
  return { ...song, schemaVersion: 2, sectionsByTrack: { ...song.sectionsByTrack, [String(trackIndex)]: normalizeSectionNames(sections) } };
}

export function migrateSong(song: Song): Song {
  const existing = song.sectionsByTrack;
  const sectionsByTrack: Record<string, Section[]> = {};
  for (const track of song.tracks || []) {
    sectionsByTrack[String(track.index)] = (existing?.[String(track.index)] ?? song.sections ?? []).map(s => withLearningPercent(s, learnedPercent(s)));
  }
  return { ...song, schemaVersion: 2, sectionsByTrack, folderId: song.folderId || '', media: song.media || {} };
}

export function songProgress(song: LibrarySong, trackIndex = song.trackIndex): number {
  if ('summaryVersion' in song) return song.progress;
  if (!song.bars) return 0;
  return Math.round(sectionsFor(song, trackIndex).reduce((sum, s) => sum + (s.end - s.start + 1) * learnedPercent(s), 0) / song.bars);
}

/** Full song coverage by section state. Unmapped bars count as not learnt. */
export function songProgressSplit(song: LibrarySong, trackIndex = song.trackIndex): ProgressSplit {
  if ('summaryVersion' in song) return song.progressSplit || {new:song.progressState==='explore'?100:0,learning:song.progressState==='progress'?100:0,comfortable:0,mastered:song.progressState==='mastered'?100:0};
  const counts:ProgressSplit={new:0,learning:0,comfortable:0,mastered:0};
  if(!song.bars)return {...counts,new:100};
  let mapped=0;
  for(const section of sectionsFor(song,trackIndex)){const bars=Math.max(0,Math.min(song.bars,section.end)-Math.max(1,section.start)+1);counts[section.status]+=bars;mapped+=bars;}
  counts.new+=Math.max(0,song.bars-mapped);
  return Object.fromEntries(Object.entries(counts).map(([status,bars])=>[status,bars/song.bars*100])) as ProgressSplit;
}
export function songIsMastered(song: LibrarySong): boolean { return song.bars>0 && songProgressSplit(song).mastered===100; }

export function collectionProgress(songs: LibrarySong[]) {
  const result = { explore: 0, progress: 0, mastered: 0 };
  for (const song of songs) {
    if ('summaryVersion' in song) { result[song.progressState]++; continue; }
    const sections = sectionsFor(song);
    const learnt = sections.reduce((sum, s) => sum + (s.end - s.start + 1) * learnedPercent(s), 0);
    // Avoid rounded 0/100 values moving a partially learned song into an end state.
    const mastered = song.bars > 0 && sections.every(s => s.status === 'mastered') && sections.reduce((n, s) => n + s.end - s.start + 1, 0) === song.bars;
    result[mastered ? 'mastered' : learnt > 0 ? 'progress' : 'explore']++;
  }
  return result;
}

export function assetIds(song: Song): string[] {
  return [...new Set([song.artworkAssetId, ...Object.values(song.collectionArt || {}), ...recordingsFor(song).flatMap(r => r.kind === 'audio' ? [r.assetId] : [])].filter((id): id is string => !!id))];
}
