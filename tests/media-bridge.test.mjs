import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { connectMedia } from '../src/media-bridge.ts';
globalThis.window = { alphaTab };
class Event { handlers = new Set(); on(f) { this.handlers.add(f); } off(f) { this.handlers.delete(f); } emit() { for (const f of this.handlers) f(); } }
const delay = ms => new Promise(r => setTimeout(r, ms));

test('media bridge preserves offsets, tempo mapping, speed, native transport and late ready ordering', async () => {
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex('\\tempo 120 . 0.6.1 | \\tempo 60 3.6.1 | 5.6.1');
  const positions = [], output = { handler: undefined, updatePosition: v => positions.push(v) };
  let syncPoints = [], tick = 1920, paused = true, time = 12.5, rate = 1, volume = .75, pauseCount = 0, ready = 0;
  const adapter = { get currentTime() { return time; }, get paused() { return paused; }, get playbackRate() { return rate; }, set playbackRate(v) { rate = v; }, get volume() { return volume; }, set volume(v) { volume = v; }, seek(v) { time = v; }, play() {}, pause() { paused = true; } };
  const api = {
    score, settings: new alphaTab.Settings(), playerReady: new Event(), isReadyForPlayback: true,
    player: { output, state: alphaTab.synth.PlayerState.Paused, updateSyncPoints: v => { syncPoints = v; } },
    get tickPosition() { return tick; }, set tickPosition(v) { tick = v; },
    playbackSpeed: .5, masterVolume: .4,
    pause() { pauseCount++; this.player.state = alphaTab.synth.PlayerState.Paused; output.handler?.pause(); },
    play() { this.player.state = alphaTab.synth.PlayerState.Playing; output.handler?.play(); },
    updateSettings() { this.loadMidiForScore(); },
    loadMidiForScore() { this.playerReady.emit(); tick = 0; syncPoints = []; },
  };
  const close = connectMedia(api, adapter, 12.5, () => ready++, e => assert.fail(e));
  try {
    await delay(0);
    assert.equal(ready, 1); assert.equal(tick, 1920, 'position restored after alphaTab resets the MIDI');
    assert.equal(syncPoints.length, 2); assert.equal(syncPoints[1].synthBpm, 60); assert.equal(syncPoints[1].syncTime, syncPoints[1].synthTime);
    assert.equal(output.handler.backingTrackDuration, 10000);
    output.handler.seekTo(2000); assert.equal(time, 14.5);
    output.handler.playbackRate = .5; assert.equal(rate, .5);
    output.handler.masterVolume = .4; assert.equal(volume, .4);
    await delay(60); assert.equal(positions.at(-1), 2000, 'media seconds are not double-divided by playback speed');
    const before = pauseCount; api.play(); await delay(60);
    assert.equal(pauseCount, before, 'asynchronous play startup is not mistaken for a native pause');
    paused = false; await delay(60); assert.equal(api.player.state, alphaTab.synth.PlayerState.Playing);
    paused = true; await delay(60); assert.equal(api.player.state, alphaTab.synth.PlayerState.Paused);
    paused = false; await delay(60); assert.equal(api.player.state, alphaTab.synth.PlayerState.Playing);
  } finally { close(); }
  assert.equal(output.handler, undefined); assert.equal(api.playerReady.handlers.size, 0);
});
