import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { indexedDB } from 'fake-indexeddb';
globalThis.window = { alphaTab }; globalThis.indexedDB = indexedDB;
const { makeSong, readScore } = await import('../src/notation.ts');
const { allNotes, noteKey, noteFromKey, readWorkingScore, changeNote, transposeNotes, retuneTrack, parseTuning, suggestFingerings, noteIssue } = await import('../src/score-editing.ts');
const { encodeBackup, decodeBackup } = await import('../src/backups.ts');
const source = new TextEncoder().encode('\\title "Editing study" \\tempo 120 . (0.6 2.5 2.4).4 3.6.4 5.6.4 7.6.4 | 8.6.1');
const make = () => makeSong(source, 'editing.alphatex');

test('persistent fret edits affect only the addressed note and preserve imported bytes', async () => {
  const song = await make(), before = allNotes(readWorkingScore(song)), key = noteKey(before[3]);
  const edited = changeNote(song, key, 10, before[3].string), after = allNotes(readWorkingScore(edited));
  assert.equal(after[3].fret, 10); assert.equal(before[3].fret, 3);
  assert.equal(edited.source, song.source); assert.equal(edited.hash, song.hash);
  assert.deepEqual(after.filter((_, i) => i !== 3).map(n => n.realValue), before.filter((_, i) => i !== 3).map(n => n.realValue));
  const invalid = changeNote(song, key, -1, before[3].string);
  assert.match(noteIssue(noteFromKey(readWorkingScore(invalid), key), invalid), /Fret/);
  const gp = new alphaTab.exporter.Gp7Exporter().export(readWorkingScore(edited));
  assert.equal(allNotes(readScore(gp, 'edited.gp'))[3].fret, 10);
});
test('transposition changes all selected pitches and preserves impossible frets for repair', async () => {
  const song = await make(), notes = allNotes(readWorkingScore(song)), keys = notes.map(noteKey);
  const edited = transposeNotes(song, keys, 2);
  assert.deepEqual(allNotes(readWorkingScore(edited)).map(n => n.realValue), notes.map(n => n.realValue + 2));
  const lower = transposeNotes(song, keys, -1);
  assert.equal(allNotes(readWorkingScore(lower))[0].fret, -1);
  assert.match(noteIssue(allNotes(readWorkingScore(lower))[0], lower), /Fret/);
  assert.equal(song.noteEdits, undefined);
});
test('retuning understands octave names and preserves pitch including capo when requested', async () => {
  const base = readWorkingScore(await make()); base.tracks[0].staves[0].capo = 2;
  const song = await makeSong(new alphaTab.exporter.Gp7Exporter().export(base), 'capo.gp');
  const pitches = allNotes(readWorkingScore(song)).map(n => n.realValue);
  const target = parseTuning('D2 A2 D3 G3 B3 E4');
  assert.deepEqual(target, [38, 45, 50, 55, 59, 64]);
  const kept = retuneTrack(song, 0, target, true);
  assert.deepEqual(allNotes(readWorkingScore(kept)).map(n => n.realValue), pitches);
  assert.equal(kept.tracks[0].tuning, 'Drop D');
  const shifted = retuneTrack(song, 0, target, false);
  assert.equal(allNotes(readWorkingScore(shifted))[0].realValue, pitches[0] - 2);
  assert.throws(() => parseTuning('D A D G B E'), /octaves/);
  assert.equal(allNotes(readWorkingScore(retuneTrack(song, 0, parseTuning('F2 A2 D3 G3 B3 E4'), true)))[0].fret, -1);
});
test('alternate fingering preserves pitch and respects the requested neck region and occupied strings', async () => {
  const song = await make(), notes = allNotes(readWorkingScore(song)), n = notes[5];
  const result = suggestFingerings(song, [noteKey(n)], 0, 5);
  const moved = noteFromKey(readWorkingScore(result.song), noteKey(n));
  assert.equal(moved.realValue, n.realValue); assert.notEqual(moved.string, n.string);
  assert(moved.fret >= 0 && moved.fret <= 5); assert.equal(result.changes.length, 1);
  assert.throws(() => suggestFingerings(song, [noteKey(notes[0])], 20, 24), /No playable assignment/);
  assert.throws(() => changeNote(song, noteKey(notes[0]), 4, notes[1].string), /share string/);
});
test('edits propagate through ties and harmonic edits are marked for review', async () => {
  const score = readWorkingScore(await make()), notes = allNotes(score);
  notes[4].isTieDestination = true; notes[4].fret = notes[3].fret; notes[4].tieOrigin = notes[3]; notes[3].tieDestination = notes[4];
  const song = await makeSong(new alphaTab.exporter.Gp7Exporter().export(score), 'tied.gp');
  const parsed = allNotes(readWorkingScore(song));
  assert(parsed[4].tieOrigin);
  const after = allNotes(readWorkingScore(changeNote(song, noteKey(parsed[3]), 9, parsed[3].string)));
  assert.equal(after[3].fret, 9); assert.equal(after[4].fret, 9);
  notes[0].harmonicType = alphaTab.model.HarmonicType.Natural; notes[0].harmonicValue = 12;
  const harmonic = await makeSong(new alphaTab.exporter.Gp7Exporter().export(score), 'harmonic.gp');
  const transposed = transposeNotes(harmonic, [noteKey(allNotes(readWorkingScore(harmonic))[0])], 1);
  assert.match(noteIssue(allNotes(readWorkingScore(transposed))[0], transposed), /harmonic/);
});
test('full and lightweight backups preserve note edits, tuning and movable note annotations', async () => {
  const song = await make(), note = allNotes(readWorkingScore(song))[0], key = noteKey(note);
  const edited = retuneTrack(changeNote(song, key, 3, note.string), 0, parseTuning('D2 A2 D3 G3 B3 E4'), true);
  edited.annotations = [{ id: 'annotation:test', track: 0, bar: 1, noteKey: key, text: 'test', color: '#efc666' }];
  edited.annotationPositions = { 'annotation:test': { x: 120, y: 50 } };
  for (const include of [true, false]) {
    const encoded = await encodeBackup([edited], [], include), decoded = (await decodeBackup(encoded)).songs[0];
    assert.deepEqual(decoded.noteEdits, edited.noteEdits); assert.deepEqual(decoded.tuningEdits, edited.tuningEdits); assert.deepEqual(decoded.annotations, edited.annotations); assert.deepEqual(decoded.annotationPositions, edited.annotationPositions);
    assert.equal(noteFromKey(readWorkingScore(decoded), key).fret, 5);
    const invalid = structuredClone(encoded); invalid.songs[0].annotations[0].noteKey = '0:0:999:0:0:0';
    await assert.rejects(() => decodeBackup(invalid), /annotation does not match/);
  }
});
