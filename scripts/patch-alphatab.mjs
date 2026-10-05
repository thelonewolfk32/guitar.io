// alphaTab 1.8.4 compatibility fix. Keep this reproducible when preparing assets.
// An AudioWorklet may still be loading when pause/destroy is requested. Discard
// its late completion and disconnect an unstarted source without throwing.
export function patchAlphaTab(source) {
  const replacements = [
    // Standalone synths read the fallback 44.1 kHz before output.open creates
    // the AudioContext. Use its real rate (often 48 kHz) before making samples.
    ['this.output.open(bufferTimeInMilliseconds);', 'this.output.open(bufferTimeInMilliseconds);\n\t\t\tthis.synthesizer.outSampleRate = this.output.sampleRate;'],
    // resetChannelStates only clears mute/solo/transposition. MIDI controllers,
    // pitch bends and per-note bends must also be reset between scores.
    ['loadMidiFile(midi) {\n\t\t\tthis.stop();\n\t\t\ttry {', 'loadMidiFile(midi) {\n\t\t\tthis.stop();\n\t\t\tthis.synthesizer.resetSoft();\n\t\t\ttry {'],
    ['this.source.stop(0);', 'try { this.source.stop(0); } catch (error) { if (error.name !== "InvalidStateError") throw error; }'],
    ['BrowserUiFacade.createAlphaSynthAudioWorklet(ctx, this._settings).then(() => {', 'const pendingSource = this.source;\n\t\t\tBrowserUiFacade.createAlphaSynthAudioWorklet(ctx, this._settings).then(() => {\n\t\t\t\tif (this.source !== pendingSource || this.context !== ctx) return;'],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('alphaTab lifecycle patch no longer matches. Review the new engine version.');
    source = source.replace(before, after);
  }
  return source;
}
