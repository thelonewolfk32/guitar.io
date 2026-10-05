import type { Settings, synth } from '@coderline/alphatab';

let player: synth.AlphaSynth | undefined;
let font: Promise<void> | undefined;
let request = 0;

/** One reusable offline soundfont player, independent of recording/score playback. */
export async function auditionPitches(pitches: number[], program = 25) {
  const id = ++request, a = window.alphaTab;
  if (!player) {
    const settings = new a.Settings();
    settings.core.scriptFile = new URL('./vendor/alphatab/alphaTab.js', document.baseURI).href;
    const runtime = a.synth as typeof a.synth & { AlphaSynthAudioWorkletOutput: new (settings: Settings) => synth.ISynthOutput };
    // The worklet requests half a buffer at a time and needs at least two blocks.
    player = new a.synth.AlphaSynth(new runtime.AlphaSynthAudioWorkletOutput(settings), settings.player.bufferTimeInMilliseconds);
    player.masterVolume = 0.65;
    window.addEventListener('pagehide', () => { request++; player?.destroy(); player = undefined; font = undefined; }, { once: true });
  }
  const current = player;
  // Resume inside the original click/key gesture, before fetching the soundfont.
  current.output.activate();
  current.stop();
  font ||= fetch(new URL('./vendor/alphatab/soundfont/sonivox.sf2', document.baseURI)).then(async response => {
    if (!response.ok) throw new Error('Could not load guitar sounds.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let failure: unknown;
    const failed = (error: unknown) => { failure = error; };
    current.soundFontLoadFailed.on(failed);
    current.loadSoundFont(bytes, false);
    current.soundFontLoadFailed.off(failed);
    if (failure) throw new Error('Could not read guitar sounds.');
  }).catch(error => { font = undefined; throw error; });
  await font;
  if (id !== request || player !== current) return;
  const midi = new a.midi.MidiFile(), handler = new a.midi.AlphaSynthMidiFileHandler(midi);
  handler.addTempo(0, 120);
  handler.addProgramChange(0, 0, 0, Math.max(0, Math.min(127, Math.round(program))));
  const notes = [...new Set(pitches)].filter(p => Number.isInteger(p) && p >= 0 && p <= 127).slice(0, 16);
  for (const pitch of notes) handler.addNote(0, 0, 960, pitch, Math.round(90 / Math.sqrt(notes.length)), 0);
  handler.finishTrack(0, 1440);
  current.loadMidiFile(midi);
  if (notes.length) current.play();
}
