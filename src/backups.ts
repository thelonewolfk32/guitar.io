import type { Song, Folder, Asset, GuitarProfile } from './types';
import { validateGuitars } from './guitars';
import { assetIds, migrateSong } from './library-model';
import { toBase64, fromBase64, makeSong } from './notation';
import { sectionError, validateBackup } from './domain.mjs';
import { getAsset } from './storage';
import { recordingsFor, withRecordings } from './recordings';
import { readWorkingScore, noteFromKey } from './score-editing';
import { scoreMetadata } from './notation';

export async function encodeBackup(songs: Song[], folders: Folder[], includeAssets = true, guitars: GuitarProfile[] = []) {
  if (!includeAssets) songs = songs.map(s => withRecordings({ ...s, artworkAssetId: undefined, collectionArt: undefined }, recordingsFor(s).filter(r => r.kind === 'youtube')));
  if (!includeAssets) guitars = guitars.map(({ artworkAssetId, ...guitar }) => guitar);
  const assets = [];
  for (const id of new Set([...songs.flatMap(assetIds), ...guitars.flatMap(g => g.artworkAssetId ? [g.artworkAssetId] : [])])) {
    const asset = await getAsset(id);
    if (!asset) throw new Error('A saved attachment is missing. Reattach it before exporting a complete backup.');
    const { blob, ...meta } = asset;
    assets.push({ ...meta, dataBase64: toBase64(new Uint8Array(await blob.arrayBuffer())) });
  }
  return { app: 'guitar.io', version: 2, exportedAt: new Date().toISOString(), folders, guitars: validateGuitars(guitars), assets, songs: songs.map(({ source, ...song }) => ({ ...song, sourceBase64: toBase64(source) })) };
}

export async function decodeBackup(value: unknown): Promise<{ songs: Song[]; folders: Folder[]; guitars: GuitarProfile[]; assets: Asset[] }> {
  const backup = validateBackup(value);
  const guitars = validateGuitars(backup.guitars);
  for (const guitar of guitars) if (guitar.artworkAssetId && backup.assets?.find((a: Asset) => a.id === guitar.artworkAssetId)?.kind !== 'artwork') throw new Error('A guitar photo is missing from this backup.');
  const modern = backup.version === 2;
  const songs: Song[] = [];
  for (const entry of backup.songs) {
    const parsed = await makeSong(fromBase64(entry.sourceBase64), entry.fileName);
    const song = migrateSong({ ...parsed, id: entry.id, title: entry.title, artist: entry.artist, guitars: entry.guitars, tags: entry.tags, tuning: entry.tuning, sections: entry.sections, sectionsByTrack: modern ? entry.sectionsByTrack : undefined, folderId: modern ? entry.folderId || '' : '', artworkAssetId: modern ? entry.artworkAssetId : undefined, media: modern ? entry.media || {} : {}, demo: entry.demo === true, createdAt: entry.createdAt, updatedAt: entry.updatedAt, trackIndex: parsed.tracks.some(t => t.index === entry.trackIndex) ? entry.trackIndex : parsed.trackIndex });
    for (const list of Object.values(song.sectionsByTrack || {})) for (const s of list) {
      const error = sectionError(s, list, song.bars); if (error) throw new Error(error);
    }
    if (song.media?.youtube) song.media.youtube.url = `https://www.youtube.com/watch?v=${song.media.youtube.videoId}`;
    song.lastOpenedAt=entry.lastOpenedAt; song.lastPlayedAt=entry.lastPlayedAt; song.lastPlayedBar=entry.lastPlayedBar; song.fieldUpdatedAt=entry.fieldUpdatedAt;
    song.album = entry.album || '';
    song.difficulty = entry.difficulty;
    song.noteEdits = entry.noteEdits;
    song.tempoEdits = entry.tempoEdits;
    song.spliceEdits = entry.spliceEdits;
    song.spliceUndo = entry.spliceUndo;
    song.songsterr = entry.songsterr;
    song.tuningEdits = entry.tuningEdits;
    song.tuningCompensation = entry.tuningCompensation;
    song.tuningNoteCompensation = entry.tuningNoteCompensation;
    song.sourceTunings = entry.sourceTunings;
    song.annotations = entry.annotations;
    song.annotationPositions = entry.annotationPositions;
    const working = readWorkingScore(song);
    song.bpm=working.tempo;
    for (const a of song.annotations || []) {
      const note = a.noteKey ? noteFromKey(working, a.noteKey) : undefined;
      if (!working.tracks[a.track] || (a.noteKey && (!note || note.beat.voice.bar.staff.track.index !== a.track || note.beat.voice.bar.index + 1 !== a.bar))) throw new Error('An annotation does not match this score.');
    }
    song.tracks = scoreMetadata(working).tracks;
    song.collectionArt = modern ? entry.collectionArt : undefined;
    song.artworkSource = modern ? entry.artworkSource : undefined;
    if (song.media?.recordings) song.media.recordings = song.media.recordings.map(r => r.kind === 'youtube' ? { ...r, url: `https://www.youtube.com/watch?v=${r.videoId}` } : r);
    songs.push(song);
  }
  const assets = (modern ? backup.assets : []).map((a: { id: string; kind: Asset['kind']; name: string; mime: string; dataBase64: string }) => ({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, blob: new Blob([new Uint8Array(fromBase64(a.dataBase64))], { type: a.mime }) }));
  return { songs, guitars, folders: modern ? backup.folders : [], assets };
}
