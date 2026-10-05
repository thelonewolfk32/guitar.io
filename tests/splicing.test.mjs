import test from 'node:test';
import assert from 'node:assert/strict';
import * as a from '@coderline/alphatab';
import {songsterrFixture} from './songsterr-fixture.mjs';
import {songsterrScore,songsterrRecordings} from '../src/songsterr-score.ts';
import {makeSong} from '../src/notation.ts';
import {readWorkingScore,noteKey} from '../src/score-editing.ts';
import {spliceParts,commitSplice,undoSplice} from '../src/splicing.ts';
import {encodeBackup,decodeBackup} from '../src/backups.ts';
globalThis.window={alphaTab:a};
function fixture(){
  const f=songsterrFixture();f.tracks[1]={...f.tracks[0],name:'Solo',tuning:[62,57,53,48,43,38],measures:Array.from({length:4},()=>({voices:[{beats:[{type:1,notes:[{string:0,fret:7}]}]}]}))};
  return {f,score:songsterrScore(f)};
}
test('splicing overwrites only selected bars, retains destination metadata and maps incoming sounding pitches to its tuning',()=>{
  const {score}=fixture(),result=spliceParts(score,score,{destinationTrack:0,sourceTrack:1,start:2,end:3,sourceStart:2,mode:'overwrite'});
  assert.equal(result.score.title,score.title);assert.equal(result.score.tempo,137);assert.equal(result.score.tracks.length,3);
  assert.deepEqual(result.score.tracks[0].staves[0].tuning,score.tracks[0].staves[0].tuning);
  assert.equal(result.score.tracks[0].staves[0].bars[1].voices[0].beats[0].notes[0].realValue,69);
  assert.equal(result.score.tracks[0].staves[0].bars[1].voices[0].beats[0].notes[0].fret,5);
  assert.equal(result.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].realValue,64);
  assert.equal(score.tracks[0].staves[0].bars[1].voices[0].beats[0].notes[0].fret,0,'Input is untouched');
});
test('merge retains both parts, flags overlapping voices in red, and leaves dead-note Xs uncoloured',()=>{
  const {score}=fixture(),r=spliceParts(score,score,{destinationTrack:0,sourceTrack:1,start:1,end:4,sourceStart:1,mode:'merge'});
  assert.equal(r.score.tracks[0].staves[0].bars[0].voices.length,2);assert.equal(r.warnings.length,4);
  const bar=r.score.tracks[0].staves[0].bars[0];assert(bar.voices[0].beats[0].notes[0].style.colors.size>0);assert(bar.voices[1].beats[0].notes[0].style.colors.size>0);
  assert(!r.score.tracks[0].staves[0].bars[3].voices[0].beats[0].notes[0].style?.colors.size);
});
test('a separate tab cannot replace destination tempo, signatures, metadata or YouTube timing; mismatched bars fail review',async()=>{
  const {f,score}=fixture(),song=await makeSong(new a.exporter.Gp7Exporter().export(score),'source.gp');
  song.media={recordings:songsterrRecordings(f,4)};
  const second=fixture().score;second.title='Another upload';second.artist='Other artist';second.masterBars[0].tempoAutomations=[a.model.Automation.buildTempoAutomation(false,0,200,2)];
  const result=spliceParts(readWorkingScore(song),second,{destinationTrack:0,sourceTrack:1,start:2,end:3,sourceStart:1,mode:'overwrite'}),next=commitSplice(song,result);
  assert.equal(next.title,song.title);assert.equal(next.bpm,song.bpm);assert.deepEqual(next.media,song.media);assert.equal(next.source,song.source);
  assert.equal(readWorkingScore(next).tempo,137);
  second.masterBars[0].timeSignatureNumerator=7;assert.throws(()=>spliceParts(score,second,{destinationTrack:0,sourceTrack:1,start:2,end:2,sourceStart:1,mode:'overwrite'}),/Time signatures/);
});
test('saved range splices and persistent undo survive backups without losing unrelated note edits',async()=>{
  const {score}=fixture(),song=await makeSong(new a.exporter.Gp7Exporter().export(score),'source.gp'),original=readWorkingScore(song);
  const key=noteKey(original.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]),other=noteKey(original.tracks[0].staves[0].bars[2].voices[0].beats[0].notes[0]);
  song.noteEdits={[key]:{fret:2,string:6},[other]:{fret:4,string:6}};
  const working=readWorkingScore(song),next=commitSplice(song,spliceParts(working,working,{destinationTrack:0,sourceTrack:1,start:1,end:2,sourceStart:1,mode:'overwrite'}));
  assert(!next.noteEdits[key]);assert.deepEqual(next.noteEdits[other],song.noteEdits[other]);
  const decoded=(await decodeBackup(await encodeBackup([next],[],false))).songs[0];
  assert.equal(readWorkingScore(decoded).tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].realValue,69);
  const undone=undoSplice(decoded);assert.deepEqual(undone.noteEdits,song.noteEdits);assert.equal(readWorkingScore(undone).tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret,2);assert.deepEqual(undone.source,song.source);
});

function resultSnapshot(s){const w=readWorkingScore(s),n=w.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];return {tuning:w.tracks[0].staves[0].tuning,fret:n.fret,pitch:n.realValue};}

test('merge omits exact duplicate notes after pitch mapping, while preserving distinct simultaneous notes',()=>{
  const {f}=fixture();f.tracks[1].measures=structuredClone(f.tracks[0].measures);
  for(const bar of f.tracks[1].measures)for(const beat of bar.voices[0].beats)for(const note of beat.notes)note.fret+=2;
  const score=songsterrScore(f);
  const merged=spliceParts(score,score,{destinationTrack:0,sourceTrack:1,start:1,end:2,sourceStart:1,mode:'merge'});
  for(const bar of merged.score.tracks[0].staves[0].bars.slice(0,2))assert.equal(bar.voices.flatMap(v=>v.beats.flatMap(b=>b.notes)).length,1);
  assert.equal(merged.warnings.length,0);
  assert.equal(score.tracks[1].staves[0].bars[0].voices[0].beats[0].notes.length,1,'Original remains intact');
});
