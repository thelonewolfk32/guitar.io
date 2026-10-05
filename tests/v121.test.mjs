import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import {makeSong} from '../src/notation.ts';
import {buildStoryMidi} from '../src/story-player.ts';
import {correctTuningLabel,retuneTrack,parseTuning,changeFrets,noteKey,allNotes,readWorkingScore,withTempoEdits,exportEditedScore,fretOnString,changeNote,noteIssue} from '../src/score-editing.ts';
import {recentSongs} from '../src/RecentStories.tsx';
import {encodeBackup,decodeBackup} from '../src/backups.ts';
globalThis.window={alphaTab};

for(const [tempo,tuning,low] of [[85,'Drop D',38],[156,'Drop C',36],[190,'B standard · 7-string',35]])test(`preview MIDI uses saved ${tuning} and ${tempo} BPM instead of standard/120 defaults`,async()=>{
  const source=new TextEncoder().encode(`\\title "Preview pitch study" \\tempo ${tempo} . 0.6.1 | \\tempo ${tempo+10} 2.6.1`);
  let song=await makeSong(source,'preview.alphatex');
  song=tuning.includes('7-string')?retuneTrack(song,0,parseTuning('B1 E2 A2 D3 G3 B3 E4'),false):correctTuningLabel(song,tuning);
  if(tuning.includes('7-string'))song.noteEdits={'0:0:0:0:0:0':{fret:0,string:1},'0:0:1:0:0:0':{fret:2,string:1}};
  const preview=buildStoryMidi(song),events=preview.midi.tracks.flatMap(t=>t.events),notes=events.filter(e=>e instanceof alphaTab.midi.NoteOnEvent),tempos=events.filter(e=>e instanceof alphaTab.midi.TempoChangeEvent);
  assert.equal(notes[0].noteKey+(preview.generator.transpositionPitches.get(notes[0].channel)||0),low);
  assert.deepEqual(tempos.map(e=>e.beatsPerMinute),[tempo,tempo+10]);
  const settings=new alphaTab.Settings(),midi=new alphaTab.midi.MidiFile(),viewer=new alphaTab.midi.MidiFileGenerator(readWorkingScore(song),settings,new alphaTab.midi.AlphaSynthMidiFileHandler(midi));viewer.applyTranspositionPitches=false;viewer.generate();
  assert.deepEqual(preview.midi.tracks.flatMap(t=>t.events).map(e=>[e.tick,e.type,e.noteKey,e.beatsPerMinute]),midi.tracks.flatMap(t=>t.events).map(e=>[e.tick,e.type,e.noteKey,e.beatsPerMinute]));
  assert.deepEqual(preview.generator.transpositionPitches,viewer.transpositionPitches);
  song=changeFrets(song,[noteKey(allNotes(readWorkingScore(song))[0])],5);
  const changed=buildStoryMidi(song);const event=changed.midi.tracks.flatMap(t=>t.events).find(e=>e instanceof alphaTab.midi.NoteOnEvent);
  assert.equal(event.noteKey+(changed.generator.transpositionPitches.get(event.channel)||0),low+5);
});
test('recent limit is ten, ordered by actual play time',()=>{
  const songs=Array.from({length:15},(_,i)=>({id:String(i),lastPlayedAt:new Date(Date.UTC(2026,9,3,0,i)).toISOString()}));
  assert.deepEqual(recentSongs(songs).map(s=>s.id),['14','13','12','11','10','9','8','7','6','5']);
});
test('legacy recording metadata survives backup restore and does not mutate GP source tempo',async()=>{
  const song=await makeSong(new TextEncoder().encode('\\tempo 120 . 0.6.1'),'tempo.alphatex');song.sections=[];
  song.media={recordings:[{id:'v',kind:'youtube',purpose:'backing',videoId:'dQw4w9WgXcQ',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',offsetSeconds:10,label:'Backing',tags:[],tempo:{bpm:100,referenceBpm:120,method:'audio',confidence:.8,analyzedAt:new Date().toISOString()}}]};
  const backup=await encodeBackup([song],[],false),restored=(await decodeBackup(backup)).songs[0];
  assert.deepEqual(restored.media.recordings[0].tempo,song.media.recordings[0].tempo);assert.equal(readWorkingScore(restored).tempo,120);
  const invalid=structuredClone(backup);invalid.songs[0].media.recordings[0].tempo.bpm=0;await assert.rejects(()=>decodeBackup(invalid),/recording tempo/);
});
test('GP tempo edits change MIDI, exports and backups, preserving originals and restoring imported changes',async()=>{
  const source=new TextEncoder().encode('\\tempo 120 . 0.6.1 | \\tempo 160 2.6.1 | 5.6.1');
  const original=await makeSong(source,'tempo-edit.alphatex'),edited=withTempoEdits(original,{'1':90,'3':140});edited.sections=[];
  assert.equal(edited.bpm,90);assert.equal(edited.source,source);assert.equal(original.bpm,120);
  assert.deepEqual(buildStoryMidi(edited).midi.tracks.flatMap(t=>t.events).filter(e=>e instanceof alphaTab.midi.TempoChangeEvent).map(e=>e.beatsPerMinute),[90,160,140]);
  const exported=alphaTab.importer.ScoreLoader.loadScoreFromBytes(exportEditedScore(edited));assert.equal(exported.tempo,90);assert.equal(exported.masterBars[2].tempoAutomations[0].value,140);
  const restored=(await decodeBackup(await encodeBackup([edited],[],false))).songs[0];assert.equal(restored.bpm,90);assert.deepEqual(restored.tempoEdits,edited.tempoEdits);
  assert.equal(withTempoEdits(edited,{}).bpm,120);assert.throws(()=>withTempoEdits(original,{'4':120}),/valid bar/);assert.throws(()=>withTempoEdits(original,{'1':0}),/BPM/);
});
test('changing strings preserves the pitched note in retuned strings and with capo',async()=>{
  const score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 120 . 12.6.1');score.tracks[0].staves[0].capo=3;
  let song=await makeSong(new alphaTab.exporter.Gp7Exporter().export(score),'string-move.gp');song=correctTuningLabel(song,'Drop C');
  const note=allNotes(readWorkingScore(song))[0],tuning=note.beat.voice.bar.staff.tuning;
  const fret=fretOnString(tuning,note.string,note.fret,2);assert.equal(fret,5);
  const moved=allNotes(readWorkingScore(changeNote(song,noteKey(note),fret,2)))[0];assert.equal(moved.realValue,note.realValue);
  assert.equal(fretOnString(tuning,2,fret,1),12);assert.equal(fretOnString(tuning,1,0,2),-7);
});
test('dead-note Xs and dynamics effects never inherit invalid-note red',async()=>{
  const score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 120 . 0.6.4 0.5.4');const notes=allNotes(score);notes[0].isDead=true;notes[0].fret=-1;notes[0].style=new alphaTab.model.NoteStyle();notes[0].style.colors.set(alphaTab.model.NoteSubElement.GuitarTabFretNumber,new alphaTab.model.Color(210,40,48));
  const song=await makeSong(new alphaTab.exporter.Gp7Exporter().export(score),'dead-note.gp');song.noteEdits={'0:0:0:0:1:0':{fret:-1,string:2}};
  const working=allNotes(readWorkingScore(song));assert.equal(noteIssue(working[0],song),'');assert(!working[0].style?.colors.size);
  assert.match(noteIssue(working[1],song),/Fret/);assert(working[1].style.colors.has(alphaTab.model.NoteSubElement.GuitarTabFretNumber));assert(!working[1].style.colors.has(alphaTab.model.NoteSubElement.Effects));assert(!working[1].style.colors.has(alphaTab.model.NoteSubElement.GuitarTabEffects));
});

