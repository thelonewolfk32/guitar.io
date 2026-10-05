import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import 'fake-indexeddb/auto';
globalThis.window={alphaTab};
const {makeSong}=await import('../src/notation.ts');
const {normalizeSectionNames}=await import('../src/section-names.ts');
const {learnedPercent,withLearningPercent,withSections,sectionsFor}=await import('../src/library-model.ts');
const {mergeSelection,splitSection}=await import('../src/section-editing.ts');
const {withRecordings}=await import('../src/recordings.ts');
const {formatTimestamp,parseTimestamp}=await import('../src/instructional.ts');
const {encodeBackup,decodeBackup}=await import('../src/backups.ts');
const {allNotes,readWorkingScore,retuneScore,restoreOriginalTuning,changeFrets,noteKey,correctTuningLabel,exportEditedScore,suggestFingerings}=await import('../src/score-editing.ts');
const {baseTuning}=await import('../src/tunings.ts');
const {tuningHasGuitar}=await import('../src/guitar-assignment.ts');
const {automaticGuitars}=await import('../src/guitar-matching.ts');
const {tuningBuckets}=await import('../src/tuning-caption.ts');
const section=(id,name,start,end,percent=0)=>withLearningPercent({id,name,start,end,color:'#8b79ff',status:'new',notes:''},percent);
const make=()=>makeSong(new TextEncoder().encode('\u005c\u005ctitle "New study" . (0.6 1.5 2.4).4 2.3.4 4.2.4 5.1.4 | 3.6.4 5.5.4 7.4.4 9.3.4'),'new.alphatex');
const video=(id)=>({id,kind:'youtube',purpose:'instructional',videoId:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk',label:id,tags:[],offsetSeconds:0});
const guitar=(name,pitches)=>({id:name,name,kind:'guitar',strings:pitches.length,make:'',model:'',material:'',stringGauge:'',notes:'',tunings:[{name,pitches}]});

test('section names follow bar order and remove numbering when a duplicate disappears',()=>{
  const input=[section('b','Verse 7',5,8),section('c','Pre Chorus',9,12),section('a','Verse',1,4),section('d','Imported custom marker',13,16)];
  const result=normalizeSectionNames(input);assert.deepEqual(result.map(s=>s.name),['Verse 1','Verse 2','Pre-chorus','Imported custom marker']);
  assert.equal(normalizeSectionNames(result.filter(s=>s.id!=='a'))[0].name,'Verse');assert.equal(input[0].name,'Verse 7');
  assert.deepEqual(splitSection([section('a','Verse',1,4)],'a',3).map(s=>s.name),['Verse 1','Verse 2']);
});
test('progress slider boundaries retain exact comfortable percentages',()=>{
  for(const [value,status] of [[0,'new'],[1,'learning'],[89,'learning'],[90,'comfortable'],[99,'comfortable'],[100,'mastered']]){const s=section('a','Intro',1,1,value);assert.equal(s.status,status);assert.equal(learnedPercent(s),value);}
});
test('merge selection retains unselected tails, weighted progress, timestamps and legacy notes',()=>{
  const a={...section('a','Verse',1,4,20),notes:'Legacy note',instructionalTimestamps:{lesson:15}},b=section('b','Chorus',5,8,100),c=section('c','Outro',9,12,0);
  const result=mergeSelection([a,b,c],{start:3,end:6});assert.deepEqual(result.map(s=>[s.start,s.end]),[[1,2],[3,6],[7,8],[9,12]]);assert.equal(result[1].learnedPercent,60);assert.equal(result[1].instructionalTimestamps.lesson,15);assert.match(result[1].notes,/Legacy note/);assert.equal(new Set(result.map(s=>s.id)).size,4);assert.equal(a.end,4);assert.throws(()=>mergeSelection([a],{start:2,end:3}),/two sections/);
});
test('instructional roles and per-video timestamps survive light/full backups and unlink cleanly',async()=>{
  let song=withRecordings(await make(),[video('lesson'),video('playthrough')]);song=withSections(song,[{...section('a','Intro',1,2),instructionalTimestamps:{lesson:125,playthrough:0}}]);assert.equal(song.media.youtube,undefined);
  for(const full of [true,false]){const decoded=(await decodeBackup(await encodeBackup([song],[],full))).songs[0];assert.equal(decoded.media.recordings[0].purpose,'instructional');assert.deepEqual(sectionsFor(decoded)[0].instructionalTimestamps,{lesson:125,playthrough:0});}
  const removed=withRecordings(song,[video('playthrough')]);assert.deepEqual(sectionsFor(removed)[0].instructionalTimestamps,{playthrough:0});
  const backup=await encodeBackup([song],[],false);const bad=structuredClone(backup);bad.songs[0].media.recordings[0].kind='audio';await assert.rejects(()=>decodeBackup(bad),/YouTube/);
  assert.equal(parseTimestamp('2:05'),125);assert.equal(parseTimestamp('1:02:03'),3723);assert.equal(formatTimestamp(3723),'1:02:03');assert.equal(parseTimestamp(''),undefined);for(const value of ['1:65','-1','1.5','bad','1:2:3:4'])assert.throws(()=>parseTimestamp(value));
});
test('six to seven to eight strings preserves pitches and restores original fingering with manual edits',async()=>{
  let song=await make();const before=allNotes(readWorkingScore(song)).map(n=>({pitch:n.realValue,fret:n.fret,string:n.string}));
  song=retuneScore(song,baseTuning(7));assert.equal(song.tracks[0].strings,7);assert.deepEqual(allNotes(readWorkingScore(song)).map(n=>n.realValue),before.map(n=>n.pitch));
  song=retuneScore(song,baseTuning(8));assert.equal(song.tracks[0].strings,8);assert.deepEqual(allNotes(readWorkingScore(song)).map(n=>n.realValue),before.map(n=>n.pitch));
  const key=noteKey(allNotes(readWorkingScore(song))[3]),note=allNotes(readWorkingScore(song))[3];song=changeFrets(song,[key],note.fret+2);
  const decoded=(await decodeBackup(await encodeBackup([song],[],false))).songs[0];assert.equal(decoded.tracks[0].strings,8);assert.deepEqual(decoded.tuningNoteCompensation,song.tuningNoteCompensation);
  const restored=restoreOriginalTuning(decoded),after=allNotes(readWorkingScore(restored));assert.equal(restored.tracks[0].strings,6);assert.deepEqual(after.map(n=>n.string),before.map(n=>n.string));assert.deepEqual(after.map(n=>n.fret),before.map((n,i)=>n.fret+(i===3?2:0)));
  const exported=alphaTab.importer.ScoreLoader.loadScoreFromBytes(exportEditedScore(song),new alphaTab.Settings());assert.equal(exported.tracks[0].staves[0].tuning.length,8);
  const keys=allNotes(readWorkingScore(song)).slice(3,4).map(noteKey);assert(suggestFingerings(song,keys,0,36).song);
});
test('original/current tuning buckets and their guitar warnings match exact pitches',async()=>{
  const song=correctTuningLabel(await make(),'C standard'),flat=retuneScore(song,[34,41,46,51,55,60]);const standard=guitar('C guitar',[36,41,46,51,55,60]),drop=guitar('Bb guitar',[34,41,46,51,55,60]);
  assert.deepEqual(tuningBuckets(flat),['C standard','Drop B♭']);assert.deepEqual(automaticGuitars(flat,[standard,drop]),['C guitar','Bb guitar']);assert(tuningHasGuitar('C standard',[flat],[standard]));assert(!tuningHasGuitar('Drop B♭',[flat],[standard]));assert(tuningHasGuitar('Drop B♭',[flat],[drop]));
});

test('reducing eight strings retains all notes and flags unplayable chords, then restores exactly',async()=>{
  const song=await makeSong(new TextEncoder().encode('\\title "Eight" \\tuning E4 B3 G3 D3 A2 E2 B1 F#1 . (0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8).1'),'eight.alphatex');
  const original=allNotes(readWorkingScore(song)).map(n=>[n.realValue,n.fret,n.string]);
  const reduced=retuneScore(song,baseTuning(6));const notes=allNotes(readWorkingScore(reduced));assert.equal(notes.length,8);assert(notes.some(n=>n.style));assert.deepEqual(notes.map(n=>n.realValue),original.map(n=>n[0]));
  assert.deepEqual(allNotes(readWorkingScore(restoreOriginalTuning(reduced))).map(n=>[n.realValue,n.fret,n.string]),original);
});
