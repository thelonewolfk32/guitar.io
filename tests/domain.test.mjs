import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRange, normaliseRange, sectionError, parseTags, songValues, filterSongs, coverage, playbackTicks, validateBackup } from '../src/domain.mjs';

const intro = { id: 'intro', name: 'Intro', start: 1, end: 4, color: '#abcdef', status: 'new', notes: '' };
const verse = { ...intro, id: 'verse', name: 'Verse', start: 5, end: 12 };
test('bar ranges are inclusive, 1-based and integer-only', () => {
  assert.equal(validateRange(1, 24, 24), '');
  assert.ok(validateRange(0, 4, 24)); assert.ok(validateRange(1, 25, 24));
  assert.ok(validateRange(5, 4, 24)); assert.ok(validateRange(1.2, 4, 24)); assert.ok(validateRange(NaN, 4, 24));
});
test('reverse-drag selection is normalised and clamped', () => {
  assert.deepEqual(normaliseRange(9, 2, 24), { start: 2, end: 9 });
  assert.deepEqual(normaliseRange(-2, 400, 24), { start: 1, end: 24 });
});
test('sections prevent overlap while allowing edits and adjacent ranges', () => {
  assert.equal(sectionError(verse, [intro], 24), '');
  assert.equal(sectionError({ ...intro, name: 'Opening' }, [intro, verse], 24), '');
  assert.match(sectionError({ ...verse, start: 4 }, [intro], 24), /overlaps/);
  assert.ok(sectionError({ ...verse, name: '  ' }, [], 24));
});
test('custom tags are comma-separated, trimmed and case-insensitively deduplicated', () => {
  assert.deepEqual(parseTags(' Heavy, clean,heavy,, Clean , Solo '), ['heavy', 'Clean', 'Solo']);
});
const songs = [
  { title: 'Afterglow', artist: 'Original', tuning: 'Drop D', guitars: ['ESP', 'Strat'], tags: ['Clean', 'Melodic'] },
  { title: 'Low Orbit', artist: 'Original', tuning: 'F# standard', guitars: ['8-string'], tags: ['Heavy'] },
  { title: 'Untitled', artist: '', tuning: '', guitars: [], tags: [] },
];
test('all top-level library filter dimensions resolve and combine with search', () => {
  assert.equal(filterSongs(songs, 'clean drop', 'Guitars', 'Strat').length, 1);
  assert.equal(filterSongs(songs, '', 'Vibes & tags', 'Heavy')[0].title, 'Low Orbit');
  assert.equal(filterSongs(songs, '', 'Artists', 'Original').length, 2);
  assert.equal(filterSongs(songs, '', 'Tunings', 'Drop D').length, 1);
  assert.equal(filterSongs(songs, 'not present', 'All songs', '').length, 0);
  assert.deepEqual(songValues(songs[2], 'Guitars'), []);
  assert.deepEqual(songValues(songs[2], 'Vibes & tags'), ['Untagged']);
});
test('mapped coverage counts each bar only once', () => {
  assert.equal(coverage([intro, verse], 24), 50);
  assert.equal(coverage([intro, intro], 24), 17);
  assert.equal(coverage([], 24), 0);
});
test('playback ranges respect variable bar durations and repeat order', () => {
  const bars = [
    { masterBar: { index: 0 }, start: 0, end: 3840 },
    { masterBar: { index: 1 }, start: 3840, end: 6720 },
    { masterBar: { index: 0 }, start: 6720, end: 10560 },
    { masterBar: { index: 1 }, start: 10560, end: 13440 },
    { masterBar: { index: 2 }, start: 13440, end: 17280 },
  ];
  assert.deepEqual(playbackTicks(bars, 1, 2), { startTick: 0, endTick: 13440 });
  assert.deepEqual(playbackTicks(bars, 2, 3), { startTick: 10560, endTick: 17280 });
  assert.equal(playbackTicks([bars[0], bars[4]], 1, 3), null, 'Never silently return a partial selection');
  assert.equal(playbackTicks([], 1, 2), null);
});
const backupSong = { id: '1', title: 'Test', artist: '', tuning: '', fileName: 'test.gp', format: 'GP', hash: 'x', createdAt: '', updatedAt: '', sourceBase64: 'AA==', guitars: [], tags: [], tracks: [], bars: 12, sections: [intro, verse] };
test('backups reject invalid schema, overlaps and duplicate IDs', () => {
  const backup = { app: 'guitar.io', version: 1, songs: [backupSong] };
  assert.equal(validateBackup(backup), backup);
  assert.throws(() => validateBackup({}), /not a supported Guitar/);
  assert.throws(() => validateBackup({ ...backup, version: 8 }));
  assert.throws(() => validateBackup({ ...backup, songs: [backupSong, backupSong] }), /duplicate song/);
  assert.throws(() => validateBackup({ ...backup, songs: [{ ...backupSong, sections: [intro, intro] }] }), /Duplicate section/);
  assert.throws(() => validateBackup({ ...backup, songs: [{ ...backupSong, sections: [{ ...intro, color: 'red' }] }] }), /Invalid section/);
});
