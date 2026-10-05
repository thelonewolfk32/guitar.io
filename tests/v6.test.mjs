import test from 'node:test';
import assert from 'node:assert/strict';
import * as a from '@coderline/alphatab';
import { compareNotes, notesInRect } from '../src/note-selection.ts';
import { tuningFamily, tuningPresets } from '../src/tunings.ts';

test('selection follows musical time across voices and top-to-bottom strings inside chords', () => {
  const score = a.importer.ScoreLoader.loadAlphaTex('. (0.6 0.3 0.1).4 2.2.4 3.3.2 | 4.1.1');
  const staff = score.tracks[0].staves[0], bar = staff.bars[0];
  const voice = new a.model.Voice(); bar.addVoice(voice);
  const beat = new a.model.Beat(); voice.addBeat(beat); beat.displayStart = 480;
  const note = new a.model.Note(); beat.addNote(note); note.string = 3; note.fret = 0;
  const notes = staff.bars.flatMap(b => b.voices.flatMap(v => v.beats.flatMap(b => b.notes)));
  const sorted = [...notes].reverse().sort(compareNotes);
  assert.deepEqual(sorted.slice(0,3).map(n => n.string), [6,4,1]);
  assert.equal(sorted[3], note, 'An offbeat in a second voice precedes the next quarter note in voice one');
  assert.equal(sorted.at(-1).beat.voice.bar.index, 1);
});

test('marquee uses note centres and deduplicates alternate score/tab glyphs', () => {
  const boxes = [{key:'top',x:10,y:10,width:10,height:10},{key:'bottom',x:10,y:40,width:10,height:10},{key:'top',x:10,y:20,width:10,height:10},{key:'next',x:40,y:10,width:10,height:10}];
  assert.deepEqual(notesInRect(boxes,{x:9,y:9,width:20,height:40}),['top','bottom']);
  assert.deepEqual(notesInRect(boxes,{x:10,y:10,width:2,height:2}),[]);
});

test('guitar tuning folders classify configured pitches, open and custom tunings', () => {
  assert.equal(tuningFamily('My baritone',tuningPresets(7).find(p => p.family === 'Drop').pitches), 'Drop');
  assert.equal(tuningFamily('DADGAD'), 'Open');
  assert.equal(tuningFamily('B standard · 7-string'), 'Standard');
  assert.equal(tuningFamily('My tuning',[30,40,44,50,57,65]), 'Custom');
});
