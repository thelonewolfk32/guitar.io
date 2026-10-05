import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import 'fake-indexeddb/auto';
import { createRequire } from 'node:module';
globalThis.window = {alphaTab};
const { makeSong }=await import('../src/notation.ts');
const { retuneTrack }=await import('../src/score-editing.ts');
const { automaticGuitars,guitarNamesFor,matchesGuitarTuning }=await import('../src/guitar-matching.ts');
const { sortSongs,nextSort,sortSpec }=await import('../src/library-order.ts');
const { encodeBackup,decodeBackup }=await import('../src/backups.ts');
const { saveSongs,readLibrary }=await import('../src/storage.ts');
const { importSongsterr }=createRequire(import.meta.url)('../electron/songsterr.cjs');
const make=()=>makeSong(new TextEncoder().encode('\\title "Matching study" . 0.6.4 2.5.4 3.4.4 4.3.4'),'match.alphatex');
const profile=(name,pitches)=>({id:name,name,make:'',model:'',material:'',stringGauge:'',notes:'',kind:'guitar',strings:pitches.length,tunings:[{name:'Custom label',pitches}]});

test('guitars match original and current string pitches after retuning without permanent auto tags',async()=>{
  const song=await make();song.guitars=['Manual guitar'];
  const standard=profile('Standard ESP',[40,45,50,55,59,64]),flat=profile('Flat ESP',[39,44,49,54,58,63]),seven=profile('Seven',[35,40,45,50,55,59,64]),octave=profile('Octave',[28,33,38,43,47,52]);
  const guitars=[standard,flat,seven,octave];
  assert.deepEqual(automaticGuitars(song,guitars),['Standard ESP']);
  assert.deepEqual(guitarNamesFor(song,guitars),['Manual guitar','Standard ESP']);
  assert.deepEqual(song.guitars,['Manual guitar']);
  const retuned=retuneTrack(song,0,flat.tunings[0].pitches,true);
  assert.deepEqual(automaticGuitars(retuned,guitars),['Standard ESP','Flat ESP']);
  assert.deepEqual(guitarNamesFor(retuned,guitars),['Manual guitar','Standard ESP','Flat ESP']);
  assert.deepEqual(automaticGuitars(retuned,[{...flat,tunings:[]}]),[]);
  assert(matchesGuitarTuning({...retuned,tuning:'Different metadata label'},flat.tunings[0]));
  assert(!matchesGuitarTuning({...song,tracks:[]},standard.tunings[0]));
});
test('difficulty 1–5 survives saves and both backup modes; invalid ratings are rejected',async()=>{
  const song={...await make(),difficulty:4};await saveSongs([song],true);assert.equal((await readLibrary()).songs.find(s=>s.id===song.id).difficulty,4);
  for(const include of [true,false])assert.equal((await decodeBackup(await encodeBackup([song],[],include))).songs[0].difficulty,4);
  const backup=await encodeBackup([song],[],false);
  for(const value of [0,6,2.5,'4',null]) await assert.rejects(()=>decodeBackup({...backup,songs:[{...backup.songs[0],difficulty:value}]}),/Difficulty/);
  const old=structuredClone(backup);delete old.songs[0].difficulty;assert.equal((await decodeBackup(old)).songs[0].difficulty,undefined);
});
test('list sorting reverses name, artist, album, tuning, difficulty and progress with stable ties',()=>{
  const s=(title,artist,album,difficulty,status)=>({title,artist,album,difficulty,tuning:title,createdAt:title,demo:false,bars:1,trackIndex:0,sections:[{start:1,end:1,status}]});
  const songs=[s('Song 10','Beta','Z',5,'mastered'),s('Song 2','Alpha','A',1,'new'),s('Song 1','Gamma','M',undefined,'learning')];
  assert.equal(nextSort('added','difficulty'),'difficulty:desc');assert.equal(nextSort('difficulty:desc','difficulty'),'difficulty:asc');assert.equal(nextSort('added','title'),'title:asc');
  assert.deepEqual(sortSpec('progress'),{field:'progress',direction:'desc'});
  assert.deepEqual(sortSongs(songs,'title:asc').map(s=>s.title),['Song 1','Song 2','Song 10']);
  assert.deepEqual(sortSongs(songs,'artist:asc').map(s=>s.artist),['Alpha','Beta','Gamma']);
  assert.deepEqual(sortSongs(songs,'album:desc').map(s=>s.album),['Z','M','A']);
  assert.deepEqual(sortSongs(songs,'difficulty:desc').map(s=>s.difficulty),[5,1,undefined]);
  assert.deepEqual(sortSongs(songs,'difficulty:asc').map(s=>s.difficulty),[undefined,1,5]);
  assert.deepEqual(sortSongs(songs,'progress:desc').map(s=>s.sections[0].status),['mastered','learning','new']);
  assert.equal(songs[0].title,'Song 10');
});
test('Songsterr imports reject invalid URLs before any network request',async()=>{
  let calls=0;assert.throws(()=>importSongsterr('https://evil.test',async()=>{calls++;return new Response();}));assert.equal(calls,0);
});
