import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import 'fake-indexeddb/auto';
import { createRequire } from 'node:module';
globalThis.window = { alphaTab };
const { makeSong } = await import('../src/notation.ts');
const { collectionProgress } = await import('../src/library-model.ts');
const { saveSongs, getAsset, pruneAssets, removeSong } = await import('../src/storage.ts');
const { encodeBackup, decodeBackup } = await import('../src/backups.ts');
const { retuneTrack, transposeNotes, readWorkingScore, allNotes, noteKey } = await import('../src/score-editing.ts');
const { tuningCaption } = await import('../src/tuning-caption.ts');
const { analyseSong, scalePitches, SCALES, suggestScales, handPositions, noteFit } = await import('../src/learn-model.ts');
const { songsterrUrl, downloadSongsterr, MAX_TAB_BYTES } = createRequire(import.meta.url)('../electron/songsterr.cjs');
const make = () => makeSong(new TextEncoder().encode('\\title "Scale study" . 0.6.4 2.6.4 3.6.4 5.6.4 | 7.6.4 8.6.4 10.6.4 12.6.4'), 'study.alphatex');

test('collection distribution uses actual progress and complete mastered coverage', () => {
  const song = (bars,sections) => ({bars,sections,trackIndex:0});
  const section = (end,status,learnedPercent) => ({start:1,end,status,learnedPercent});
  assert.deepEqual(collectionProgress([
    song(100,[]),song(100,[section(1,'new')]),song(100,[section(1,'learning',1)]),
    song(1000,[section(999,'mastered')]),song(4,[section(4,'mastered')]),song(4,[section(4,'learning',100)]),
  ]),{explore:2,progress:3,mastered:1});
});
test('guitar-owned artwork survives pruning, deletion and full backups without any songs', async () => {
  const song=await make(), asset={id:'guitar-photo',kind:'artwork',name:'photo.png',mime:'image/png',blob:new Blob(['photo'],{type:'image/png'})};
  const guitar={id:'profile',name:'ESP',kind:'guitar',strings:6,make:'',model:'',material:'',stringGauge:'',notes:'',tunings:[],artworkAssetId:asset.id};
  song.collectionArt={'Guitars:ESP':asset.id};
  await saveSongs([song],true,[asset],[],[guitar]); await pruneAssets(); assert(await getAsset(asset.id));
  await removeSong(song.id); await pruneAssets(); assert(await getAsset(asset.id));
  const full=await encodeBackup([],[],true,[guitar]),decoded=await decodeBackup(full);
  assert.equal(decoded.guitars[0].artworkAssetId,asset.id); assert.equal(await decoded.assets[0].blob.text(),'photo');
  const light=await encodeBackup([],[],false,[guitar]); assert.equal(light.guitars[0].artworkAssetId,undefined); assert.equal(light.assets.length,0);
  await assert.rejects(()=>decodeBackup({...full,assets:[]}),/photo is missing/);
});
test('tuning captions distinguish retuning from uniform note transposition', async () => {
  const song=await make(); assert.deepEqual(tuningCaption(song),{original:'E standard',change:''});
  const retuned=retuneTrack(song,0,[39,44,49,54,58,63],true);
  assert.deepEqual(tuningCaption(retuned),{original:'E standard',change:'(transposed to E♭ standard)'});
  const shifted=transposeNotes(song,allNotes(readWorkingScore(song)).map(noteKey),1);
  assert.equal(tuningCaption(shifted).change,'(notes transposed +1 semitones)');
});
test('Songsterr URL import accepts song links and rejects arbitrary hosts and credentials', () => {
  for(const url of ['https://www.songsterr.com/a/wsa/artist-song-tab-s123','https://songsterr.com/a/wa/song?id=42']) assert.equal(songsterrUrl(url),url);
  for(const url of ['http://songsterr.com/a/wsa/song-s123','https://songsterr.com.evil.test/a/wsa/song-s123','https://songsterr.com@localhost/a/wsa/song-s123','https://songsterr.com:444/a/wsa/song-s123','file:///song.gp','https://127.0.0.1/a/wsa/song-s123','https://songsterr.com/']) assert.throws(()=>songsterrUrl(url));
});
test('Songsterr invalid, blocked and oversized responses fail inline', async () => {
  const url='https://www.songsterr.com/a/wsa/study-tab-s123';
  for(const [response,pattern] of [[new Response('verify',{status:403}),/403/],[new Response('<html>'),/invalid song data/],[new Response('{}'),/supported score/],[new Response('x',{headers:{'content-length':String(MAX_TAB_BYTES+1)}}),/30 MB/],[new Response(new Uint8Array(MAX_TAB_BYTES+1)),/30 MB/]])await assert.rejects(()=>downloadSongsterr(url,async()=>response),pattern);
});
test('Learn recognises edited sounding pitches, duration, selected sections and high-to-low tuning', async () => {
  const song=await make(),analysis=analyseSong(song);
  assert.deepEqual(analysis.tuning,[64,59,55,50,45,40]); assert(analysis.total>0);
  const minor=SCALES.find(s=>s.id==='aeolian'); assert.equal(noteFit(analysis.weights,scalePitches(4,minor.intervals)),1);
  const top=suggestScales(analysis.weights)[0]; assert.equal(top.fit,1); assert.equal(top.root,4);
  const first=analyseSong(song,0,1,1); assert(first.total<analysis.total); assert.equal(first.weights[11],0);
  const keepPitch=retuneTrack(song,0,[39,44,49,54,58,63],true); assert.deepEqual(analyseSong(keepPitch).weights,analysis.weights);
  const shifted=transposeNotes(song,allNotes(readWorkingScore(song)).map(noteKey),1),after=analyseSong(shifted);
  for(let i=0;i<12;i++) assert.equal(after.weights[(i+1)%12],analysis.weights[i]);
});
test('Learn has correct diatonic and pentatonic pitch sets and useful separated positions', () => {
  assert.deepEqual(scalePitches(2,SCALES.find(s=>s.id==='dorian').intervals),[2,4,5,7,9,11,0]);
  assert.deepEqual(scalePitches(9,SCALES.find(s=>s.id==='minor-pentatonic').intervals),[9,0,2,4,7]);
  const pitches=scalePitches(4,SCALES.find(s=>s.id==='aeolian').intervals);
  for(const tuning of [[64,59,55,50,45,40],[64,59,55,50,45,40,35,30],[43,38,33,28]]) {
    const positions=handPositions(tuning,pitches,4,[12,11,12,14]); assert.equal(positions.length,3);
    assert(positions.every(p=>p.start>=1 && p.end<=24 && p.end-p.start===3 && p.coverage>0));
    assert(positions.every((p,i)=>positions.slice(i+1).every(b=>Math.abs(b.start-p.start)>=3)));
  }
});
