import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import {connectMedia} from '../src/media-bridge.ts';

globalThis.window={alphaTab};
test('recording starts at the whole-song speed instead of inheriting the previous MIDI section multiplier',async()=>{
  const handlers=new Set(),output={updatePosition(){}},score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 120 . 0.6.1 | \\tempo 140 0.6.1');
  const api={score,settings:new alphaTab.Settings(),playerReady:{on:f=>handlers.add(f),off:f=>handlers.delete(f)},isReadyForPlayback:true,tickPosition:1920,playbackSpeed:.375,masterVolume:.75,pause(){},updateSettings(){},player:{output,state:0,updateSyncPoints(){}}};
  const adapter={currentTime:0,paused:true,playbackRate:1,volume:1,seek(){},pause(){},play(){}};
  const close=connectMedia(api,adapter,5,()=>{},e=>assert.fail(e),undefined,.75);
  try{await new Promise(r=>setTimeout(r,0));assert.equal(api.playbackSpeed,.75);assert.equal(api.tickPosition,1920);assert.equal(score.masterBars[1].tempoAutomations[0].value,140);}
  finally{close();assert.equal(handlers.size,0);}
});
