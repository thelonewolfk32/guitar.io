import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import {makeSong} from '../src/notation.ts';
import {songProgressSplit,songProgress,songIsMastered,withSections} from '../src/library-model.ts';
import {summarizeSong} from '../src/song-summary.ts';
globalThis.window={alphaTab};
const original=await makeSong(new TextEncoder().encode('\\tempo 120 . 0.6.1 | 2.5.1 | 3.4.1 | 5.3.1'),'progress.alphatex');
const section=(start,end,status)=>({id:String(start),name:'Phrase',start,end,status,notes:'',color:'#8b79ff',learnedPercent:status==='learning'?50:status==='comfortable'?95:status==='mastered'?100:0});

test('four progress states cover the whole song and unmapped bars remain not learnt',()=>{
  const song=withSections(original,[section(1,1,'learning'),section(2,2,'comfortable'),section(3,3,'mastered')]);
  assert.deepEqual(songProgressSplit(song),{new:25,learning:25,comfortable:25,mastered:25});assert.equal(songProgress(song),61);assert(!songIsMastered(song));
  assert.deepEqual(songProgressSplit(summarizeSong(song)),songProgressSplit(song));
});
test('gold star requires every bar mastered rather than a rounded 100 percent',()=>{
  const almost=withSections({...original,bars:1000},[section(1,999,'mastered'),section(1000,1000,'comfortable')]);
  assert.equal(songProgress(almost),100);assert(!songIsMastered(almost));assert(!songIsMastered(summarizeSong(almost)));
  const full=withSections(original,[section(1,4,'mastered')]);assert(songIsMastered(full));assert(songIsMastered(summarizeSong(full)));assert.deepEqual(songProgressSplit(full),{new:0,learning:0,comfortable:0,mastered:100});
});
test('progress colours and mastery follow the selected instrument',()=>{
  const song={...original,sectionsByTrack:{'0':[section(1,4,'mastered')],'1':[section(1,4,'learning')]},trackIndex:1};
  assert.deepEqual(songProgressSplit(song),{new:0,learning:100,comfortable:0,mastered:0});assert(!songIsMastered(song));assert(songIsMastered({...song,trackIndex:0}));
});
