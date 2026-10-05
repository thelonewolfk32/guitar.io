import type { Settings, synth } from '@coderline/alphatab';
import type { Song } from './types';
import { readWorkingScore } from './score-editing';
import type { StoryPreview } from './story-cache';

let fontBytes: Promise<Uint8Array> | undefined;
/** Match AlphaTabApi.loadMidiForScore: saved working tuning/notes, source tempo
 * map, tick shift and per-channel transposition are applied exactly once. */
export function buildStoryMidi(song: Song) {
  const a=window.alphaTab,score=readWorkingScore(song),settings=new a.Settings(),midi=new a.midi.MidiFile();
  const handler=new a.midi.AlphaSynthMidiFileHandler(midi),generator=new a.midi.MidiFileGenerator(score,settings,handler);
  generator.applyTranspositionPitches=false;generator.generate();
  return {score,midi,generator,tickShift:handler.tickShift};
}
function soundfont() {
  return fontBytes ||= fetch(new URL('./vendor/alphatab/soundfont/sonivox.sf2', document.baseURI)).then(async r => {
    if (!r.ok) throw new Error('Could not load MIDI sounds.'); return new Uint8Array(await r.arrayBuffer());
  }).catch(e => { fontBytes = undefined; throw e; });
}
/** One synth per preview session; no score rendering and no hidden full viewer. */
export class StoryPlayer {
  private player: synth.AlphaSynth;
  private font: Promise<void>;
  private disposed = false;
  private request=0;
  private cancelReady?: () => void;
  constructor() {
    const a = window.alphaTab, settings = new a.Settings();
    settings.core.scriptFile = new URL('./vendor/alphatab/alphaTab.js', document.baseURI).href;
    const runtime = a.synth as typeof a.synth & { AlphaSynthAudioWorkletOutput: new (settings: Settings) => synth.ISynthOutput };
    this.player = new a.synth.AlphaSynth(new runtime.AlphaSynthAudioWorkletOutput(settings), settings.player.bufferTimeInMilliseconds);
    this.player.masterVolume = .65;
    this.player.output.activate(); // Resume while still inside the story click.
    this.font = soundfont().then(bytes => { if (!this.disposed) this.player.loadSoundFont(bytes, false); });
    void this.font.catch(()=>{});
  }
  async load(preview: StoryPreview) {
    const request=++this.request;
    await this.font; if (this.disposed || request!==this.request) return;
    this.player.stop();
    const {midi,transpositionPitches,startTick,tuning,bpm}=preview;
    this.player.resetChannelStates();this.player.playbackSpeed=1;
    this.player.loadMidiFile(midi);
    this.player.applyTranspositionPitches(transpositionPitches);
    if (!this.player.isReadyForPlayback) await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);this.player.readyForPlayback.off(ready);this.cancelReady=undefined;};
      const ready=()=>{cleanup();resolve();},timer=setTimeout(()=>{cleanup();reject(new Error('MIDI sounds did not become ready. Try again.'));},10000);
      this.cancelReady=ready;this.player.readyForPlayback.on(ready);
    });
    if(this.disposed || request!==this.request)return;
    this.player.tickPosition = startTick;
    this.player.isLooping = true;
    if (!this.player.play()) throw new Error('MIDI playback could not start. Try opening the song.');
    return {tuning,bpm};
  }
  cancel() {this.request++;this.cancelReady?.();this.pause();}
  pause() { if (!this.disposed) this.player.pause(); }
  play() { if (!this.disposed) this.player.play(); }
  destroy() { this.cancel();this.disposed = true; this.player.destroy(); }
}
