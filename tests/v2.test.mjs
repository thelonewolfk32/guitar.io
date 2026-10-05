import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as alphaTab from '@coderline/alphatab';
import { migrateSong, sectionsFor, withSections, learnedPercent, withStatus, songProgress } from '../src/library-model.ts';
import { suggestSections } from '../src/section-suggestions.ts';
import { songMapItems } from '../src/SectionDialogs.tsx';
import { youtubeVideoId, mediaToScoreSeconds, scoreToMediaSeconds, validOffset } from '../src/media-domain.mjs';
import { saveSongs, getAsset, removeSong, pruneAssets, readLibrary } from '../src/storage.ts';
import { encodeBackup, decodeBackup } from '../src/backups.ts';
import { makeSong } from '../src/notation.ts';
import { validateBackup } from '../src/domain.mjs';
globalThis.window = { alphaTab };
const intro = { id: 'intro', name: 'Intro', start: 1, end: 4, color: '#8b79ff', status: 'learning', notes: 'Smooth changes', learnedPercent: 37 };

test('v0.1 migration preserves notes and makes independent per-instrument sections', () => {
  const legacy = { bars: 8, sections: [intro], tracks: [{ index: 0 }, { index: 1 }], trackIndex: 0 };
  const migrated = migrateSong(legacy);
  const edited = withSections(migrated, [{ ...intro, name: 'Guitar intro', learnedPercent: 68 }]);
  assert.equal(sectionsFor(edited)[0].learnedPercent, 68);
  assert.equal(sectionsFor(edited, 1)[0].name, 'Intro');
  assert.equal(sectionsFor(edited, 1)[0].notes, 'Smooth changes');
  assert.equal(legacy.sections[0].learnedPercent, 37);
  assert.deepEqual(migrateSong(edited), edited);
  assert.equal(songProgress(edited), 34);
});
test('learning percentage and status marks have consistent values', () => {
  assert.equal(learnedPercent(withStatus(intro, 'new')), 0);
  assert.equal(learnedPercent(withStatus(intro, 'comfortable')), 90);
  assert.equal(learnedPercent(withStatus(intro, 'mastered')), 100);
  assert.equal(learnedPercent(withStatus(intro, 'learning')), 37);
  assert.equal(learnedPercent({ ...intro, learnedPercent: 300 }), 100);
});
test('long song map groups named sections and contiguous unlabelled gaps', () => {
  const sections = [intro, { ...intro, id: 'chorus', name: 'Chorus', start: 40, end: 80 }];
  const items = songMapItems(sections, 115);
  assert.equal(items.length, 4);
  assert.deepEqual(items.map(i => [i.start, i.end]), [[1, 4], [5, 39], [40, 80], [81, 115]]);
  assert.equal(items[2].section.name, 'Chorus');
});
test('phrase suggestions identify recurring material separately for each instrument', () => {
  const notes = ['0.6.1', '0.6.1', '3.6.1', '3.6.1', '0.6.1', '0.6.1', '5.6.1', '5.6.1'].join(' | ');
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex(`\\tempo 120 . \\track "Guitar" ${notes} \\track "Resting guitar" ${Array(8).fill('r.1').join(' | ')}`);
  const lead = suggestSections(score, 0, 2), rest = suggestSections(score, 1, 2);
  assert.equal(lead.length, 4); assert.equal(lead[0].name, lead[2].name); assert.equal(lead[0].color, lead[2].color);
  assert.equal(lead[0].repeated, true); assert.equal(lead[1].repeated, false);
  assert.equal(rest.length, 1); assert.equal(rest[0].name, 'Rest / break'); assert.equal(rest[0].end, 8);
});
test('YouTube inputs allow video links but reject lookalike hosts and arbitrary scripts', () => {
  for (const url of ['https://youtu.be/abcdefghijk?t=10', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://youtube.com/shorts/abcdefghijk']) assert.equal(youtubeVideoId(url), 'abcdefghijk');
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://evil.test/abcdefghijk', 'https://youtube.com/watch?v=bad']) assert.equal(youtubeVideoId(url), null);
  assert.equal(mediaToScoreSeconds(15, 12.5), 2.5); assert.equal(scoreToMediaSeconds(2.5, 12.5), 15);
  assert.equal(mediaToScoreSeconds(5, 12), 0); assert.equal(mediaToScoreSeconds(0, -10), 10);
  assert.equal(validOffset(NaN), false); assert.equal(validOffset(-3601), false);
});
test('v2 backup roundtrips original bytes, independent progress, folders, MP3 and artwork; v1 still imports', async () => {
  const raw = await makeSong(new TextEncoder().encode('\\title "Backup study" . 0.6.1 | 3.6.1 | 5.6.1 | 0.6.1'), 'backup.alphatex');
  const song = migrateSong({ ...raw, sections: [intro], artworkAssetId: 'cover', folderId: 'folder', media: { audio: { assetId: 'audio', name: 'demo.mp3', offsetSeconds: 12.5 }, youtube: { videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', offsetSeconds: 5 } } });
  const assets = [{ id: 'audio', kind: 'audio', name: 'demo.mp3', mime: 'audio/mpeg', blob: new Blob(['ID3test'], { type: 'audio/mpeg' }) }, { id: 'cover', kind: 'artwork', name: 'cover.png', mime: 'image/png', blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) }];
  const folders = [{ id: 'folder', name: 'Set list', color: '#24b8a8' }];
  await saveSongs([song], true, assets, folders);
  const encoded = await encodeBackup([song], folders), decoded = await decodeBackup(encoded);
  assert.deepEqual(decoded.songs[0].source, song.source); assert.equal(sectionsFor(decoded.songs[0])[0].learnedPercent, 37);
  assert.equal(decoded.songs[0].media.audio.offsetSeconds, 12.5); assert.deepEqual(decoded.folders, folders);
  assert.equal(await decoded.assets.find(a => a.id === 'audio').blob.text(), 'ID3test');
  const lightweight = await decodeBackup(await encodeBackup([song], folders, false));
  assert.equal(lightweight.assets.length, 0); assert.equal(lightweight.songs[0].media.audio, undefined);
  assert.equal(lightweight.songs[0].media.youtube.videoId, 'abcdefghijk');
  assert.equal(sectionsFor(lightweight.songs[0])[0].learnedPercent, 37);
  const legacy = { ...encoded, version: 1, songs: encoded.songs.map(({ sectionsByTrack, media, artworkAssetId, folderId, ...s }) => s) };
  const old = await decodeBackup(legacy); assert.equal(sectionsFor(old.songs[0])[0].name, 'Intro');
  assert.throws(() => validateBackup({ ...encoded, assets: [] }), /missing/);
  assert.throws(() => validateBackup({ ...encoded, songs: [{ ...encoded.songs[0], sectionsByTrack: { 0: [{ ...intro, learnedPercent: 101 }] } }] }), /percentage/);
  await removeSong(song.id);
  assert.equal(await getAsset('audio'), undefined); assert.equal(await getAsset('cover'), undefined);
});
test('deleting a song or detaching media only removes unreferenced files', async () => {
  const raw = await makeSong(new TextEncoder().encode('. 0.6.1'), 'test.alphatex');
  const asset = { id: 'shared', kind: 'audio', name: 'demo.mp3', mime: 'audio/mpeg', blob: new Blob(['audio']) };
  const a = { ...raw, id: 'a', media: { audio: { assetId: 'shared', name: 'demo.mp3', offsetSeconds: 0 } } }, b = { ...raw, id: 'b', media: a.media };
  await saveSongs([a, b], false, [asset]); await removeSong('a');
  assert.ok(await getAsset('shared')); await saveSongs([{ ...b, media: {} }]); await pruneAssets();
  assert.equal(await getAsset('shared'), undefined); await removeSong('b');
  assert.equal((await readLibrary()).songs.length, 0);
});
