import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as alphaTab from '@coderline/alphatab';
import { splitSection, mergeSection } from '../src/section-editing.ts';
import { recordingsFor, withRecordings } from '../src/recordings.ts';
import { assetIds } from '../src/library-model.ts';
import { makeSong } from '../src/notation.ts';
import { saveSongs, removeSong, getAsset, pruneAssets } from '../src/storage.ts';
import { encodeBackup, decodeBackup } from '../src/backups.ts';
import { validateBackup } from '../src/domain.mjs';
import { bestRelease } from '../src/artwork.ts';
globalThis.window = { alphaTab };
const intro = { id: 'a', name: 'Intro', start: 1, end: 4, color: '#8b79ff', status: 'learning', notes: 'Use alternate picking', learnedPercent: 40 };
test('split preserves coverage, progress, notes and original input', () => {
  const result = splitSection([intro], 'a', 3);
  assert.deepEqual(result.map(s => [s.start, s.end]), [[1, 2], [3, 4]]);
  assert.notEqual(result[0].id, result[1].id);
  for (const s of result) { assert.equal(s.notes, intro.notes); assert.equal(s.learnedPercent, 40); }
  assert.equal(intro.end, 4);
  for (const n of [0, 1, 5, 2.5]) assert.throws(() => splitSection([intro], 'a', n));
});
test('merge preserves notes and weighted progress and rejects gaps', () => {
  const next = { ...intro, id: 'b', name: 'Verse', start: 5, end: 12, status: 'mastered', learnedPercent: 100, notes: 'Relax the wrist' };
  const result = mergeSection([intro, next], 'a', 1);
  assert.equal(result.length, 1); assert.equal(result[0].name, 'Verse'); assert.equal(result[0].learnedPercent, 80);
  assert.match(result[0].notes, /alternate picking/); assert.match(result[0].notes, /Relax the wrist/);
  assert.throws(() => mergeSection([intro, { ...next, start: 6 }], 'a', 1), /gap/);
  assert.throws(() => mergeSection([intro, next], 'a', -1));
});
test('old recordings migrate without losing offsets and multiple recordings survive backups', async () => {
  const raw = await makeSong(new TextEncoder().encode('\\title "Test" . 0.6.1'), 'test.alphatex');
  const old = { ...raw, media: { youtube: { videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', offsetSeconds: 7 }, audio: { assetId: 'original', name: 'original.mp3', offsetSeconds: 2 } } };
  assert.deepEqual(recordingsFor(old).map(r => r.offsetSeconds), [2, 7]);
  const song = withRecordings({ ...old, album: 'Test album', collectionArt: { 'Artists:Test': 'picture' } }, [...recordingsFor(old), { id: 'backing', kind: 'audio', label: 'Guitar removed', tags: ['Backing track'], assetId: 'backing-asset', name: 'backing.mp3', offsetSeconds: 12.5 }]);
  const assets = ['original', 'backing-asset'].map(id => ({ id, kind: 'audio', name: id + '.mp3', mime: 'audio/mpeg', blob: new Blob(['audio']) }));
  assets.push({ id: 'picture', kind: 'artwork', name: 'artist.png', mime: 'image/png', blob: new Blob(['picture']) });
  await saveSongs([song], true, assets);
  assert.deepEqual(assetIds(song).sort(), ['backing-asset', 'original', 'picture']);
  const backup = await encodeBackup([song], []);
  const decoded = await decodeBackup(backup);
  assert.deepEqual(decoded.songs[0].media.recordings, song.media.recordings);
  assert.equal(decoded.songs[0].album, song.album); assert.deepEqual(decoded.songs[0].collectionArt, song.collectionArt);
  const light = await decodeBackup(await encodeBackup([song], [], false));
  assert.equal(light.songs[0].media.recordings.length, 1); assert.equal(light.songs[0].media.recordings[0].kind, 'youtube'); assert.deepEqual(light.assets, []);
  assert.throws(() => validateBackup({ ...backup, songs: [{ ...backup.songs[0], media: { recordings: [{ ...song.media.recordings[0], offsetSeconds: NaN }] } }] }), /offset/);
  assert.throws(() => validateBackup({ ...backup, assets: backup.assets.filter(a => a.id !== 'backing-asset') }), /missing/);
  await saveSongs([withRecordings(song, song.media.recordings.filter(r => r.id !== 'backing'))]); await pruneAssets();
  assert.equal(await getAsset('backing-asset'), undefined); assert.ok(await getAsset('original'));
  await removeSong(song.id);
});
test('artwork matching rejects ambiguous artists and respects an existing album', () => {
  const release = { id: 'd92ef36a-7253-4438-b4a9-cb5fdb5645e3', title: 'Album', status: 'Official', date: '2001', 'release-group': { 'primary-type': 'Album' } };
  const match = { score: 100, title: 'Track', 'artist-credit': [{ artist: { name: 'Artist' } }], releases: [release] };
  assert.equal(bestRelease([match], { title: 'Track', artist: 'Artist' }), release);
  assert.equal(bestRelease([match], { title: 'Track', artist: 'Someone else' }), undefined);
  assert.equal(bestRelease([match], { title: 'Track', artist: 'Artist', album: 'Different album' }), undefined);
  assert.equal(bestRelease([{ ...match, score: 50 }], { title: 'Track', artist: 'Artist' }), undefined);
});
