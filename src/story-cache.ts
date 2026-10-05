import type { LibrarySong, Song } from './types';
import { readSong } from './storage';
import { buildStoryMidi } from './story-player';
import { scoreMetadata } from './notation';

export function compileStoryPreview(song: Song) {
  const {score,midi,generator,tickShift}=buildStoryMidi(song);
  const occurrence=generator.tickLookup.masterBars.find(b=>b.masterBar.index===Math.max(0,(song.lastPlayedBar || 1)-1));
  const startTick=(occurrence?.start || 0)+tickShift;
  const tuning=scoreMetadata(score).tracks.find(t=>t.index===song.trackIndex)?.tuning || song.tuning;
  const tempos=midi.tracks.flatMap(t=>t.events).filter((e):e is import('@coderline/alphatab').midi.TempoChangeEvent=>e instanceof window.alphaTab.midi.TempoChangeEvent && e.tick<=startTick).sort((a,b)=>a.tick-b.tick);
  // Keep the generated MIDI and its own pitch/tempo information. Discard the
  // parsed score, generator and original GP bytes after compilation.
  return {midi,transpositionPitches:generator.transpositionPitches,startTick,tuning,bpm:Math.round(tempos.at(-1)?.beatsPerMinute || score.tempo)};
}
export type StoryPreview = ReturnType<typeof compileStoryPreview>;
const version=(song:LibrarySong)=>JSON.stringify([song.hash,song.updatedAt,song.trackIndex,song.lastPlayedBar]);
type Entry = {version:string;preview?:Promise<StoryPreview>};

/** Lazy, in-memory cache restricted to the current ten recents. No startup reads. */
export class RecentPreviewCache {
  private entries=new Map<string,Entry>();
  constructor(private loadSong:(id:string)=>Promise<Song | undefined>=readSong) {}
  setRecent(songs:LibrarySong[]) {
    this.entries=new Map(songs.slice(0,10).map(song=>{
      const key=version(song),previous=this.entries.get(song.id);
      return [song.id,previous?.version===key?previous:{version:key}];
    }));
  }
  get size(){return this.entries.size;}
  load(song:LibrarySong) {
    const entry=this.entries.get(song.id);
    if(!entry || entry.version!==version(song))return Promise.reject(new Error('This song is no longer in recently played.'));
    if(!entry.preview)entry.preview=this.loadSong(song.id).then(full=>{
      if(!full)throw new Error('This song is no longer available.');
      return compileStoryPreview(full);
    }).catch(error=>{entry.preview=undefined;throw error;});
    return entry.preview;
  }
  clear(){this.entries.clear();}
}
export const recentPreviewCache=new RecentPreviewCache();
