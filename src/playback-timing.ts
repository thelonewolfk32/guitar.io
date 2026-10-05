import type {model} from '@coderline/alphatab';
import type {YouTubeSync} from './types';
import {youtubeSyncPoints} from './recording-sync';
const timingCache=new WeakMap<model.Score,{sync:YouTubeSync;points:ReturnType<typeof youtubeSyncPoints>}>();

export function supportedRate(value:number, rates?:number[]):number {
  const valid=rates?.filter(r=>Number.isFinite(r)&&r>0);
  return valid?.length ? valid.reduce((best,r)=>Math.abs(r-value)<Math.abs(best-value)?r:best,valid[0]) : Math.max(.1,Math.min(2,value));
}
// Quantise the playback multiplier, leaving GP tempos and recording anchors exact.
export function steppedRate(value:number,rates?:number[],minimum=.1,maximum=2):number {
  const clamped=Math.max(minimum,Math.min(maximum,Number.isFinite(value)?value:1));
  return supportedRate(Math.round(clamped*20+1e-9)/20,rates);
}
export function barSeconds(score:model.Score, recordingBpm?:number):number {
  const bar=score.masterBars[0];
  const bpm=recordingBpm || bar?.tempoAutomations.at(-1)?.value || score.tempo;
  return 60/bpm*(bar?.timeSignatureNumerator || 4)*4/(bar?.timeSignatureDenominator || 4);
}
export function shiftSync(sync:YouTubeSync|undefined, delta:number):YouTubeSync|undefined {
  return sync ? {...sync,points:sync.points.map(p=>({...p,seconds:Math.round((p.seconds+delta)*1000000)/1000000}))} : undefined;
}
export function playbackBpm(score:model.Score, bar:number, sync?:YouTubeSync, tick?:number):number {
  if(sync?.enabled){
    try{
      let cached=timingCache.get(score);
      if(cached?.sync!==sync){cached={sync,points:youtubeSyncPoints(score,sync)};timingCache.set(score,cached);}
      let measured=cached.points[0];
      for(const point of cached.points){if(tick!==undefined?point.synthTick<=tick:point.masterBarIndex<=bar-1 && point.masterBarOccurence===0)measured=point;}
      if(measured?.syncBpm>0)return measured.syncBpm;
    }catch{/* The media bridge reports invalid anchors; the control retains the GP reference until corrected. */}
  }
  let bpm=score.tempo;
  for(const b of score.masterBars.slice(0,bar))for(const automation of b.tempoAutomations)bpm=automation.value;
  return bpm;
}
