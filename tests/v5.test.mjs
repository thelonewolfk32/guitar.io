import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { indexedDB } from 'fake-indexeddb';
globalThis.window = { alphaTab }; globalThis.indexedDB = indexedDB;
const { enterFretDigit } = await import('../src/fret-entry.ts');
const { tuningPresets, baseTuning } = await import('../src/tunings.ts');
const { validateGuitars } = await import('../src/guitars.ts');
const { makeSong } = await import('../src/notation.ts');
const { allNotes, noteKey, readWorkingScore, changeFrets, retuneTrack, transposeNotes, noteIssue } = await import('../src/score-editing.ts');
const { saveSongs, readLibrary } = await import('../src/storage.ts');
const { encodeBackup, decodeBackup } = await import('../src/backups.ts');
const make = () => makeSong(new TextEncoder().encode('\\title "Tuning study" . (0.6 2.5 4.4).4 7.3.4 8.2.4 12.1.4'), 'tuning.alphatex');

test('fret digits join strictly inside one second and reset for another selection', () => {
  const one = enterFretDigit(null, '1', 0, 'note1');
  assert.equal(enterFretDigit(one, '1', 999, 'note1').digits, '11');
  assert.equal(enterFretDigit(one, '2', 1000, 'note1').digits, '2');
  assert.equal(enterFretDigit(one, '2', 20, 'note2').digits, '2');
  assert.equal(enterFretDigit(enterFretDigit(one, '1', 20, 'note1'), '2', 30, 'note1').digits, '2');
});

test('standard/drop presets cover an octave for guitar and bass without octave ambiguity', async () => {
  for (const [strings, bass] of [[6,false],[7,false],[8,false],[4,true],[5,true],[6,true]]) {
    const presets = tuningPresets(strings, bass);
    assert.equal(presets.filter(p => p.family === 'Standard').length,13);
    assert.equal(presets.filter(p => p.family === 'Drop').length,13);
    assert(presets.every(p => p.pitches.length === strings && p.pitches.every(v => v >= 0 && v <= 127)));
    const first = presets.find(p => p.family === 'Standard'), last = presets.filter(p => p.family === 'Standard').at(-1);
    assert.deepEqual(last.pitches,first.pitches.map(p => p-12));
    const score = readWorkingScore(await make());
    const staff = score.tracks[0].staves[0]; staff.stringTuning.tunings = [...baseTuning(strings,bass)].reverse();
    for (const note of allNotes(score)) note.string = 1;
    // Use a single note per beat to avoid manufacturing an invalid chord.
    staff.bars[0].voices[0].beats[0].notes.splice(1);
    const song = await makeSong(new alphaTab.exporter.Gp7Exporter().export(score), 'strings.gp');
    const before = allNotes(readWorkingScore(song));
    const retuned = readWorkingScore(retuneTrack(song,0,first.pitches.map(p=>p-1),true));
    assert.deepEqual(allNotes(retuned).map(n => [n.fret,n.string,n.realValue]),before.map(n => [n.fret+1,n.string,n.realValue]));
  }
  const presets = tuningPresets(6), dropB=presets.find(p=>p.name==='Drop B'), dropBb=presets.find(p=>p.name==='Drop B♭');
  assert.deepEqual(dropB.pitches,[35,42,47,52,56,61]); assert.deepEqual(dropBb.pitches,dropB.pitches.map(p=>p-1));
});

test('multi-note keyboard edits preserve strings and red invalid frets survive backups', async () => {
  const song = await make(), notes = allNotes(readWorkingScore(song)), keys=notes.map(noteKey);
  const changed = changeFrets(song, keys, 11);
  assert.deepEqual(allNotes(readWorkingScore(changed)).map(n=>[n.fret,n.string]),notes.map(n=>[11,n.string]));
  const invalid=transposeNotes(song,keys,-12);
  const decoded=(await decodeBackup(await encodeBackup([invalid],[],false))).songs[0];
  assert.deepEqual(decoded.noteEdits,invalid.noteEdits);
  assert.match(noteIssue(allNotes(readWorkingScore(decoded))[0],decoded),/Fret/);
  assert(allNotes(readWorkingScore(decoded))[0].style.colors.size>0);
});

test('guitar profiles persist without songs and survive both backup variants', async () => {
  const profile={id:'esp-test',name:'ESP',kind:'guitar',strings:6,make:'ESP',model:'E-II',material:'Mahogany',stringGauge:'12–60',notes:'25.5 inch scale',tunings:tuningPresets(6).filter(p=>['Drop B','B standard','Drop A'].includes(p.name)).map(({name,pitches})=>({name,pitches}))};
  await saveSongs([],false,[],undefined,[profile]);
  assert.deepEqual((await readLibrary()).guitars,[profile]);
  for (const include of [true,false]) assert.deepEqual((await decodeBackup(await encodeBackup([],[],include,[profile]))).guitars,[profile]);
  assert.throws(()=>validateGuitars([profile,{...profile,id:'duplicate'}]),/duplicate/);
  const bad=structuredClone(profile); bad.tunings[0].pitches[0]=NaN;
  assert.throws(()=>validateGuitars([bad]),/tuning/);
});
