import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as alphaTab from '@coderline/alphatab';
import {patchAlphaTab} from '../scripts/patch-alphatab.mjs';
import {RecentPreviewCache} from '../src/story-cache.ts';
import {makeSong} from '../src/notation.ts';
import {withTempoEdits,correctTuningLabel} from '../src/score-editing.ts';
import {encodeBackup,decodeBackup} from '../src/backups.ts';
import {lookupSongTempo,tempoCandidates,closestTempo} from '../electron/online-tempo.mjs';
import {connectMedia} from '../src/media-bridge.ts';
globalThis.window={alphaTab};
const exports={};
vm.runInNewContext(patchAlphaTab(fs.readFileSync('node_modules/@coderline/alphatab/dist/alphaTab.js','utf8')),{exports,module:{exports},require:createRequire(import.meta.url),process,console,TextEncoder,TextDecoder,setTimeout,clearTimeout});
const patched=exports;
class Event{handlers=new Set();on(f){this.handlers.add(f);}off(f){this.handlers.delete(f);}trigger(...args){for(const f of this.handlers)f(...args);}}
class Output{rate=44100;get sampleRate(){return this.rate;}ready=new Event();sampleRequest=new Event();samplesPlayed=new Event();open(){this.rate=48000;this.ready.trigger();}pause(){}activate(){}resetSamples(){}destroy(){}}
test('standalone synth uses actual 48 kHz output rate instead of the unopened 44.1 kHz fallback',()=>{
  const output=new Output(),p=new patched.synth.AlphaSynth(output,300);
  assert.equal(p.synthesizer.outSampleRate,48000);assert.equal(12*Math.log2(output.sampleRate/p.synthesizer.outSampleRate),0);p.destroy();
});
test('loading another MIDI clears channel pitch, per-note bends and MIDI tuning',()=>{
  const p=new patched.synth.AlphaSynth(new Output(),300),s=p.synthesizer;
  s.channelSetPitchWheel(0,13000);s.channelSetPerNotePitchWheel(0,40,14000);s.channelSetTuning(0,2);
  const midi=new patched.midi.MidiFile(),handler=new patched.midi.AlphaSynthMidiFileHandler(midi);handler.addTempo(0,85);handler.addNote(0,0,960,40,90,0);handler.finishTrack(0,960);
  p.loadMidiFile(midi);assert.equal(s._channels.channelList[0].pitchWheel,8192);assert.equal(s._channels.channelList[0].perNotePitchWheel.size,0);assert.equal(s._channels.channelList[0].tuning,0);assert.equal(p.sequencer.currentTempo,85);p.destroy();
});
test('recent MIDI cache is lazy, deduplicates reads, retains separate tuning/tempo, invalidates edits and evicts songs leaving ten recents',async()=>{
  const base=await makeSong(new TextEncoder().encode('\\tempo 196 . 0.6.1 | \\tempo 205 2.6.1'),'recents.alphatex');
  const songs=Array.from({length:11},(_,i)=>({...base,id:String(i),updatedAt:String(i),lastPlayedBar:1}));
  songs[1]=withTempoEdits(correctTuningLabel(songs[1],'Drop C'),{'1':85});
  const counts=new Map(),cache=new RecentPreviewCache(async id=>{counts.set(id,(counts.get(id)||0)+1);return songs.find(s=>s.id===id);});
  cache.setRecent(songs);assert.equal(cache.size,10);assert.equal(counts.size,0);
  const [a,duplicate]=await Promise.all([cache.load(songs[0]),cache.load(songs[0])]);assert.equal(a,duplicate);assert.equal(counts.get('0'),1);assert.equal(a.bpm,196);assert.equal(a.tuning,'E standard');
  const b=await cache.load(songs[1]);assert.equal(b.bpm,85);assert.equal(b.tuning,'Drop C');assert.equal((await cache.load(songs[0])).bpm,196);
  cache.setRecent(songs.slice(0,10));assert.equal(await cache.load(songs[0]),a);
  songs[0]={...songs[0],updatedAt:'new',lastPlayedBar:2};cache.setRecent(songs);assert.equal((await cache.load(songs[0])).bpm,205);assert.equal(counts.get('0'),2);
  cache.setRecent(songs.slice(1));assert.equal(cache.size,10);await assert.rejects(cache.load(songs[0]),/no longer/);await cache.load(songs[10]);assert.equal(counts.get('10'),1);cache.clear();assert.equal(cache.size,0);
});
const id='12345678-1234-1234-1234-123456789abc';
const song={title:'Tornado of Souls',artist:'Megadeth',album:'Rust in Peace',bpm:196};
const match={id,title:song.title,score:100,'artist-credit':[{artist:{name:song.artist}}],releases:[{title:song.album}]};
test('online tempo uses strict title/artist/album matches, excludes live variants and handles half-time estimates',()=>{
  assert.equal(tempoCandidates([match,{...match,id:'bad'},{...match,title:'Tornado of Souls (Live)'},{...match,disambiguation:'live'},{...match,releases:[{title:'Wrong album'}]}],song).length,1);
  assert.equal(closestTempo(98,196),196);assert.equal(closestTempo(194.8,196),194.8);assert.equal(closestTempo(130,196),undefined);assert.equal(closestTempo(NaN,196),undefined);
});
test('online lookup saves source provenance without changing the GP, and missing data returns no estimate',async()=>{
  const urls=[],request=async url=>{urls.push(url);return{ok:true,json:async()=>url.includes('musicbrainz.org')?{recordings:[match]}:{[id]:{'0':{rhythm:{bpm:98}}}}};};
  const estimate=await lookupSongTempo(song,request);assert.equal(estimate.bpm,196);assert.equal(estimate.source,'AcousticBrainz');assert.equal(estimate.recordingId,id);assert(estimate.enabled);assert.equal(urls.length,2);assert.equal(song.bpm,196);
  assert.equal(await lookupSongTempo({...song,artist:'Unknown artist'},request),undefined);assert.equal(urls.length,2);
  assert.equal(await lookupSongTempo(song,async()=>({ok:false,status:503})),undefined);
  const full=await makeSong(new TextEncoder().encode('\\tempo 120 . 0.6.1'),'online.alphatex');full.sections=[];full.media={recordings:[{id:'r',kind:'youtube',videoId:'dQw4w9WgXcQ',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',label:'Full song',tags:[],offsetSeconds:3,purpose:'full',onlineTempo:estimate}]};
  const restored=(await decodeBackup(await encodeBackup([full],[],false))).songs[0];assert.deepEqual(restored.media.recordings[0].onlineTempo,estimate);assert.equal(restored.bpm,120);
});
test('online tempo scales only the recording clock including GP tempo changes, and refreshes after GP editing',async()=>{
  const score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 120 . 0.6.1 | \\tempo 60 0.6.1');
  let points,position;const output={updatePosition(){}};const api={score,settings:new alphaTab.Settings(),playerReady:new Event(),isReadyForPlayback:true,tickPosition:0,playbackSpeed:1,masterVolume:1,pause(){},updateSettings(){},player:{output,state:0,updateSyncPoints(p){points=p;}}};
  const adapter={currentTime:3,paused:true,playbackRate:1,volume:1,seek(v){position=v;},pause(){},play(){}};
  const close=connectMedia(api,adapter,3,()=>{},e=>assert.fail(e),100);
  try{await new Promise(r=>setTimeout(r,0));assert.equal(points[1].syncTime,2400);assert.equal(points[1].syncBpm,50);assert.equal(output.handler.backingTrackDuration,7200);output.handler.seekTo(2400);assert.equal(position,5.4);assert.equal(score.tempo,120);
    api.score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 100 . 0.6.1 | 0.6.1');api.playerReady.trigger();await new Promise(r=>setTimeout(r,0));assert.equal(output.handler.backingTrackDuration,4800);
  }finally{close();}
});
