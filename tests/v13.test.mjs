import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {songsterrFixture} from './songsterr-fixture.mjs';
import {songsterrScore,videoSync,songsterrRecordings} from '../src/songsterr-score.ts';
import {youtubeSyncPoints} from '../src/recording-sync.ts';
import {makeSong} from '../src/notation.ts';
import {encodeBackup,decodeBackup} from '../src/backups.ts';
globalThis.window={alphaTab};
const {downloadSongsterr,importSongsterr,songsterrSync}=createRequire(import.meta.url)('../electron/songsterr.cjs');
test('direct Songsterr JSON import handles gzip, CDN failover and one timing request',async()=>{
  const f=songsterrFixture(),requests=[];
  const fetcher=async(url,options)=>{
    requests.push(url);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    if(url.includes('/api/meta/'))return Response.json({...f.meta,revisionId:456,image:'test-image',tracks:f.tracks.map(t=>({name:t.name}))});
    if(url.includes('/api/video-points/'))return Response.json(f.videos.map(v=>({...v,status:'done',feature:null})));
    if(url.includes('dqsljvtekg760'))return new Response('',{status:403});
    assert(url.startsWith('https://d34shlm8p2ums2.cloudfront.net/123/456/test-image/'));
    return new Response(gzipSync(JSON.stringify(f.tracks[Number(/(\d+)\.json$/.exec(url)[1])])));
  };
  const data=await downloadSongsterr(f.url,fetcher);
  assert.equal(data.tracks.length,3);assert.equal(data.videos.length,1);assert.equal(requests.length,6);
  assert(!requests.some(u=>u.includes('songsterr-downloader')));
  requests.length=0;await songsterrSync(f.url,fetcher);assert.equal(requests.length,2);
});
test('failed imports stay inline and concurrent imports share a request without retaining payloads',async()=>{
  const f=songsterrFixture();let calls=0;
  const fail=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return new Response('',{status:403});};
  const results=await Promise.allSettled([importSongsterr(f.url,fail),importSongsterr(f.url,fail)]);
  assert(results.every(r=>r.status==='rejected'));assert.equal(calls,1);
  await assert.rejects(()=>importSongsterr(f.url,fail),/403/);assert.equal(calls,2);
});
test('Songsterr conversion keeps exact pitches, tempo changes, drums, markers, ties and dead notes through GP export',()=>{
  const s=songsterrScore(songsterrFixture());
  assert.equal(s.tempo,137);assert.equal(s.masterBars[2].tempoAutomations[0].value,98);
  assert.deepEqual(s.tracks[0].staves[0].tuning,[64,59,55,50,45,40]);
  assert.equal(s.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].realValue,64);
  assert.equal(s.tracks[1].staves[0].bars[0].voices[0].beats[0].notes[0].realValue,28);
  const copy=alphaTab.importer.ScoreLoader.loadScoreFromBytes(new alphaTab.exporter.Gp7Exporter().export(s));
  assert.equal(copy.tempo,137);assert.equal(copy.tracks.length,3);assert.equal(copy.masterBars[2].section.text,'Solo');
  assert.equal(copy.tracks[0].staves[0].bars[1].voices[0].beats[0].notes[0].isTieDestination,true);
  assert.equal(copy.tracks[0].staves[0].bars[3].voices[0].beats[0].notes[0].isDead,true);
  assert.equal(copy.tracks[2].staves[0].bars[0].voices[0].beats[0].notes[0].percussionArticulation,38);
});
test('variable recording timestamps align bars while leaving original MIDI tempo and sync data unchanged',()=>{
  const f=songsterrFixture(),s=songsterrScore(f),sync=videoSync(f,f.videos[0],4);
  const points=youtubeSyncPoints(s,sync);
  assert.deepEqual(points.slice(0,4).map(p=>p.syncTime),[0,2000,5000,7000]);
  assert.deepEqual(points.slice(0,4).map(p=>p.masterBarIndex),[0,1,2,3]);
  assert.equal(s.tempo,137);assert(s.masterBars.every(b=>!b.syncPoints));assert(points.at(-1).syncTime>7000);
  assert.throws(()=>youtubeSyncPoints(s,{...sync,points:[{bar:1,seconds:5},{bar:2,seconds:5}]}),/increasing/);
  const duplicate=videoSync(f,{...f.videos[0],points:[5,5,7,10]},4);assert.deepEqual(duplicate.points.map(p=>p.bar),[1,3,4]);
});
test('Songsterr provenance and per-recording timing survive backups and malformed points are rejected',async()=>{
  const f=songsterrFixture(),song=await makeSong(new alphaTab.exporter.Gp7Exporter().export(songsterrScore(f)),'fixture.gp');
  song.songsterr={url:f.url,songId:123,revisionId:456,importedAt:new Date().toISOString()};song.media={recordings:songsterrRecordings(f,4)};
  const backup=await encodeBackup([song],[],false),decoded=await decodeBackup(backup);
  assert.deepEqual(decoded.songs[0].songsterr,song.songsterr);assert.equal(decoded.songs[0].media.recordings[0].youtubeSync.points[2].seconds,10);
  backup.songs[0].media.recordings[0].youtubeSync.points[1].bar=999;await assert.rejects(()=>decodeBackup(backup),/timestamp/);
});
