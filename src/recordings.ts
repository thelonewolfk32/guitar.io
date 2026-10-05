import type { Recording, Song, Section } from './types';

export function recordingsFor(song: Song): Recording[] {
  if (song.media?.recordings) return song.media.recordings;
  const result: Recording[] = [];
  if (song.media?.audio) result.push({ ...song.media.audio, id: 'legacy-audio', kind: 'audio', label: song.media.audio.name, tags: [] });
  if (song.media?.youtube) result.push({ ...song.media.youtube, id: 'legacy-youtube', kind: 'youtube', label: 'Original recording', tags: [] });
  return result;
}

export function withRecordings(song: Song, recordings: Recording[]): Song {
  const instructionalIds = new Set(recordings.filter(r => r.kind === 'youtube' && r.purpose === 'instructional').map(r => r.id));
  const prune = (section: Section): Section => {
    if (!section.instructionalTimestamps) return section;
    const timestamps = Object.fromEntries(Object.entries(section.instructionalTimestamps).filter(([id]) => instructionalIds.has(id)));
    return { ...section, instructionalTimestamps: Object.keys(timestamps).length ? timestamps : undefined };
  };
  return { ...song, sections: song.sections.map(prune), sectionsByTrack: song.sectionsByTrack ? Object.fromEntries(Object.entries(song.sectionsByTrack).map(([key,list]) => [key,list.map(prune)])) : undefined,
    media: { recordings, audio: recordings.find(r => r.kind === 'audio'), youtube: recordings.find((r): r is Extract<Recording,{kind:'youtube'}> => r.kind === 'youtube' && r.purpose !== 'instructional') } };
}
