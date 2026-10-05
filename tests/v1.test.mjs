import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import 'fake-indexeddb/auto';
globalThis.window={alphaTab};
const {makeSong,scoreMetadata}=await import('../src/notation.ts');
const {correctTuningLabel,retuneScore,restoreOriginalTuning,readWorkingScore,allNotes,noteKey,changeFrets}=await import('../src/score-editing.ts');
const {tuningBuckets,tuningCaption}=await import('../src/tuning-caption.ts');
const {encodeBackup,decodeBackup}=await import('../src/backups.ts');
const {validateGuitars}=await import('../src/guitars.ts');
const make=()=>makeSong(new TextEncoder().encode('\u005c\u005ctitle "Original study" . 0.6.4 2.5.4 3.4.4 4.3.4'),'original.alphatex');
test('a corrected tuning label changes MIDI pitch while retaining every written fret',async()=>{
  const song=await make(),before=allNotes(readWorkingScore(song));
  const corrected=correctTuningLabel(song,'Drop B'),after=allNotes(readWorkingScore(corrected));
  assert.deepEqual(after.map(n=>n.fret),before.map(n=>n.fret));
  assert.equal(after[0].realValue,before[0].realValue-5);
  assert.deepEqual(readWorkingScore(corrected).tracks[0].staves[0].tuning,[61,56,52,47,42,35]);
  assert.equal(tuningCaption(corrected).original,'Drop B');
  assert.deepEqual(corrected.source,song.source);
  const midi=new alphaTab.midi.MidiFile(),generator=new alphaTab.midi.MidiFileGenerator(readWorkingScore(corrected),new alphaTab.Settings(),new alphaTab.midi.AlphaSynthMidiFileHandler(midi));generator.generate();
  const noteOns=midi.tracks.flatMap(t=>t.events).filter(e=>e.type===alphaTab.midi.MidiEventType.NoteOn);
  assert(noteOns.some(e=>e.noteKey===35),'generated MIDI uses the corrected lowest string');
});
test('broader artwork candidates and selected Apple covers survive full backups',async()=>{
  const {searchArtwork,imageAsset}=await import('../src/artwork.ts'),{saveSongs}=await import('../src/storage.ts');
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async url=>String(url).startsWith('https://itunes.apple.com/')?new Response(JSON.stringify({results:[{collectionName:'First album',artistName:'Test band',artworkUrl100:'https://is1-ssl.mzstatic.com/image/a/100x100bb.jpg',collectionViewUrl:'https://music.apple.com/album/first'},{collectionName:'Second album',artistName:'Test band',artworkUrl100:'https://is1-ssl.mzstatic.com/image/b/100x100bb.jpg',collectionViewUrl:'https://music.apple.com/album/second'}]}),{headers:{'Content-Type':'application/json'}}):String(url).includes('mzstatic.com')?new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}):new Response(JSON.stringify({releases:[],query:{pages:{}}}),{headers:{'Content-Type':'application/json'}});
    const song={...await make(),artist:'Test band'},choices=await searchArtwork(song);assert.equal(choices.length,2);
    const selected=choices.find(c=>c.title==='Second album'),asset=await imageAsset(selected.image,selected.title),updated={...song,artworkAssetId:asset.id,artworkSource:selected.source,album:selected.title};
    await saveSongs([updated],true,[asset]);const restored=(await decodeBackup(await encodeBackup([updated],[],true))).songs[0];assert.equal(restored.artworkSource,'https://music.apple.com/album/second');assert.equal(restored.album,'Second album');
  }finally{globalThis.fetch=originalFetch;}
});
test('whole-score retuning and restoration retain pitches, strings and manual fret edits',async()=>{
  let song=correctTuningLabel(await make(),'Drop B');
  const notes=allNotes(readWorkingScore(song)),key=noteKey(notes[1]);song=changeFrets(song,[key],11);
  const original=allNotes(readWorkingScore(song));
  const retuned=retuneScore(song,[34,41,46,51,55,60]);
  const after=allNotes(readWorkingScore(retuned));
  assert.deepEqual(after.map(n=>n.realValue),original.map(n=>n.realValue));
  assert.deepEqual(after.map(n=>n.string),original.map(n=>n.string));
  assert.deepEqual(after.map(n=>n.fret),original.map(n=>n.fret+1));
  assert.deepEqual(tuningBuckets(retuned),['Drop B','Drop B♭']);
  const restored=restoreOriginalTuning(retuned);
  assert.deepEqual(allNotes(readWorkingScore(restored)).map(n=>n.fret),original.map(n=>n.fret));
  assert.deepEqual(tuningBuckets(restored),['Drop B']);
  assert.equal(Object.keys(restored.tuningEdits).length,0);
});
test('restoration reverses both pitch-preserving and shape-preserving tuning changes',async()=>{
  const song=correctTuningLabel(await make(),'Drop B'),frets=allNotes(readWorkingScore(song)).map(n=>n.fret);
  const shape=retuneScore(song,[34,41,46,51,55,60],false);
  assert.deepEqual(allNotes(readWorkingScore(restoreOriginalTuning(shape))).map(n=>n.fret),frets);
  const mixed=retuneScore(shape,[33,40,45,50,54,59],true);
  assert.deepEqual(allNotes(readWorkingScore(restoreOriginalTuning(mixed))).map(n=>n.fret),frets);
});
test('whole-score tuning changes include another guitar and shift a bass with its intervals intact',async()=>{
  const score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 120 . \\track "Lead" \\instrument 25 0.6.4 2.5.4 3.4.4 4.3.4 \\track "Rhythm" \\instrument 29 0.6.4 2.5.4 3.4.4 4.3.4 \\track "Bass" \\instrument 34 \\tuning G2 D2 A1 E1 0.4.4 2.3.4 3.2.4 4.1.4');
  const song=await makeSong(new alphaTab.exporter.Gp7Exporter().export(score),'two.gp'),before=allNotes(readWorkingScore(song));
  const retuned=retuneScore(song,[39,44,49,54,58,63]);
  assert.equal(Object.keys(retuned.tuningEdits).length,3);
  assert.deepEqual(readWorkingScore(retuned).tracks[2].staves[0].tuning,[42,37,32,27]);
  assert.deepEqual(allNotes(readWorkingScore(retuned)).map(n=>n.realValue),before.map(n=>n.realValue));
});
test('import defaults to a guitar sound instead of a preceding bass track',()=>{
  const score=alphaTab.importer.ScoreLoader.loadAlphaTex('. 0.6.4');score.tracks[0].playbackInfo.program=33;
  const guitar=alphaTab.importer.ScoreLoader.loadAlphaTex('. 0.6.4').tracks[0];guitar.playbackInfo.program=29;score.addTrack(guitar);
  assert.equal(scoreMetadata(score).trackIndex,1);
});
test('corrected source tunings, retuning and free text survive both backup variants',async()=>{
  const song=retuneScore(correctTuningLabel(await make(),'Drop B'),[34,41,46,51,55,60]);
  song.annotations=[{id:'annotation:free',track:0,bar:1,text:'Remember this phrase',color:'#efc666',free:true}];song.annotationPositions={'annotation:free':{x:143,y:91}};
  for(const full of [true,false]){const restored=(await decodeBackup(await encodeBackup([song],[],full))).songs[0];assert.deepEqual(restored.sourceTunings,song.sourceTunings);assert.deepEqual(restored.tuningEdits,song.tuningEdits);assert.equal(restored.annotations[0].free,true);assert.deepEqual(tuningBuckets(restored),['Drop B','Drop B♭']);}
  const invalid=await encodeBackup([song],[],false);invalid.songs[0].tuningCompensation={'0:0':[0]};await assert.rejects(()=>decodeBackup(invalid),/offsets/);
});
test('guitar specifications retain per-string gauges and validate against the string count',()=>{
  const guitar={id:'spec',name:'ESP',kind:'guitar',strings:7,make:'',model:'',material:'',stringGauge:'',notes:'',tunings:[],stringGauges:['9','11','16','24','32','42','60'],stringBrand:'Brand',stringModel:'Set',pickups:'Humbuckers',bridge:'Fixed',scaleLength:'27 inches'};
  assert.deepEqual(validateGuitars([guitar])[0],guitar);
  assert.throws(()=>validateGuitars([{...guitar,stringGauges:['10']}]),/gauges/);
});
