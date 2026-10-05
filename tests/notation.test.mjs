import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { makeSong, readScore, toBase64, fromBase64 } from '../src/notation.ts';
import { demoSources } from '../src/demos.ts';
import { playbackTicks } from '../src/domain.mjs';
globalThis.window = { alphaTab };

test('all three original demos parse as genuine scores with correct bars and tunings', async () => {
  for (const d of demoSources()) {
    const song = await makeSong(d.source, 'demo.alphatex');
    assert.equal(song.title, d.title);
    assert.equal(song.artist, 'Guitar.io Originals');
    assert.equal(song.bars, d.count);
    assert.equal(song.tuning, d.tuning);
    assert.equal(song.bpm, d.bpm);
    assert.equal(song.tracks[0].strings, d.title === 'Low Orbit' ? 8 : 6);
  }
});
test('Guitar Pro export/re-import preserves original score content', async () => {
  const d = demoSources()[0];
  const score = readScore(d.source, 'demo.alphatex');
  const binary = new alphaTab.exporter.Gp7Exporter().export(score);
  const song = await makeSong(binary, 'afterglow.gp');
  assert.equal(song.title, 'Afterglow'); assert.equal(song.bars, 24); assert.equal(song.tuning, 'Drop D');
  assert.equal(song.format, 'GP'); assert.ok(binary.length > 100);
});
const xml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>Original XML Study</work-title></work>
<identification><creator type="composer">Guitar.io</creator></identification>
<part-list><score-part id="P1"><part-name>Guitar</part-name><score-instrument id="I1"><instrument-name>Guitar</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>25</midi-program></midi-instrument></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><direction-type><rehearsal>Intro</rehearsal></direction-type></direction><note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure>
<measure number="2"><note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;
test('MusicXML notation imports and detects bars', async () => {
  const song = await makeSong(new TextEncoder().encode(xml), 'study.musicxml');
  assert.equal(song.title, 'Original XML Study'); assert.equal(song.bars, 2); assert.equal(song.tracks.length, 1);
});
test('corrupt files are rejected rather than stored', async () => {
  await assert.rejects(makeSong(new TextEncoder().encode('this is not a score'), 'broken.gp'));
});
test('backup byte encoding roundtrips binary files', () => {
  const bytes = Uint8Array.from({ length: 90000 }, (_, i) => i % 256);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});
test('real MIDI generation supplies bar tick ranges for scrubbing and looping', () => {
  const score = readScore(demoSources()[0].source, 'demo.alphatex');
  const midi = new alphaTab.midi.MidiFile();
  const generator = new alphaTab.midi.MidiFileGenerator(score, new alphaTab.Settings(), new alphaTab.midi.AlphaSynthMidiFileHandler(midi));
  generator.generate();
  assert.ok(midi.tracks.length > 0);
  const ticks = playbackTicks(generator.tickLookup.masterBars, 5, 12);
  assert.ok(ticks.startTick > 0); assert.ok(ticks.endTick > ticks.startTick);
});
