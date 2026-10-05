import type { model } from '@coderline/alphatab';
import type { YouTubeSync } from './types';

export function youtubeSyncPoints(score:model.Score,sync:YouTubeSync) {
  const anchors=sync.points;
  if(anchors.length<2 || anchors[0].bar!==1)throw new Error('YouTube sync needs bar 1 and at least one later bar.');
  let previous=-Infinity;
  for(const p of anchors){
    if(!Number.isInteger(p.bar) || p.bar<1 || p.bar>score.masterBars.length || !Number.isFinite(p.seconds) || p.seconds<=previous)throw new Error('YouTube sync points must use valid bars and increasing video times.');
    previous=p.seconds;
  }
  const saved=score.masterBars.map(b=>b.syncPoints);
  try {
    score.applyFlatSyncPoints(anchors.map(p=>({barIndex:p.bar-1,barPosition:0,barOccurence:p.occurrence || 0,millisecondOffset:(p.seconds-anchors[0].seconds)*1000})));
    const points=window.alphaTab.midi.MidiFileGenerator.generateSyncPoints(score);
    if(points.length<3 || points.some((p,i)=>!Number.isFinite(p.syncBpm) || p.syncBpm<=0 || i>0 && p.syncTime<=points[i-1].syncTime))throw new Error('These sync points do not match the score’s bar order. Check the arrangement and repeat passes.');
    return points;
  } finally {
    // Alignment is per recording. Never write timing or BPM changes into the GP/MIDI score.
    score.masterBars.forEach((b,i)=>{b.syncPoints=saved[i];});
  }
}
