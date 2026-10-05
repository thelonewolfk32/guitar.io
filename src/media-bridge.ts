import type { AlphaTabApi, synth } from '@coderline/alphatab';
import type { YouTubeSync } from './types';
import {youtubeSyncPoints} from './recording-sync';

export type MediaAdapter = {
  readonly currentTime: number;
  readonly duration?: number;
  readonly playbackRates?: number[];
  readonly paused: boolean;
  playbackRate: number;
  volume: number;
  seek(seconds: number): void;
  play(): Promise<void> | void;
  pause(): void;
};

/** The recording is the clock. alphaTab maps its time through the score's tempo/repeat timeline. */
export function connectMedia(api: AlphaTabApi, adapter: MediaAdapter, offset: number, onReady: () => void, onError: (text: string) => void, onlineBpm?:number, wholeSongSpeed?:number, youtubeSync?:YouTubeSync) {
  const a = window.alphaTab;
  // A MIDI section multiplier must never become a recording's starting rate.
  const tick = api.tickPosition, speed = wholeSongSpeed ?? api.playbackSpeed, volume = api.masterVolume;
  let output: synth.IExternalMediaSynthOutput | undefined, disposed = false, boundScore:typeof api.score;
  api.pause();
  let duration=1;
  const handler: synth.IExternalMediaHandler = {
    get backingTrackDuration(){return duration;},
    get playbackRate() { return adapter.playbackRate; },
    set playbackRate(value) { adapter.playbackRate = value; },
    get masterVolume() { return adapter.volume; },
    set masterVolume(value) { adapter.volume = value; },
    seekTo(ms) { adapter.seek(Math.max(0, ms / 1000 + offset)); },
    play() { Promise.resolve(adapter.play()).catch(e => { if (!disposed) { api.pause(); onError(e instanceof Error ? e.message : 'Playback was blocked. Press play in the recording player.'); } }); },
    pause() { adapter.pause(); },
  };
  const bind = () => {
    const candidate = api.player?.output as synth.IExternalMediaSynthOutput | undefined;
    if (disposed || !candidate || typeof candidate.updatePosition !== 'function' || candidate === output && boundScore===api.score || !api.isReadyForPlayback || !api.score) return;
    let points;
    try { points=youtubeSync?.enabled?youtubeSyncPoints(api.score,youtubeSync):a.midi.MidiFileGenerator.generateSyncPoints(api.score, true); }
    catch(e){onError(e instanceof Error?e.message:'Could not apply YouTube sync points.');return;}
    const scale=!youtubeSync?.enabled && onlineBpm && Number.isFinite(onlineBpm) && onlineBpm>=20 && onlineBpm<=400 ? api.score.tempo/onlineBpm : 1;
    for(const point of points){point.syncTime*=scale;point.syncBpm/=scale;}
    duration=points.at(-1)?.syncTime || 1;boundScore=api.score;
    output = candidate; output.handler = handler;
    // The final generated endpoint is implied by backingTrackDuration. Excluding it avoids a zero-length final interval.
    api.player!.updateSyncPoints(points.filter(p => p.syncTime < duration));
    api.playbackSpeed = speed; api.masterVolume = volume; api.tickPosition = tick;
    onReady();
  };
  // readyForPlayback fires inside loadMidiFile, before alphaTab finishes loading
  // its built-in sync points and resetting the tick. Bind after that call unwinds.
  const scheduleBind = () => queueMicrotask(bind);
  api.playerReady.on(scheduleBind);
  if (api.settings.player.playerMode !== a.PlayerMode.EnabledExternalMedia) {
    api.settings.player.playerMode = a.PlayerMode.EnabledExternalMedia; api.updateSettings();
  } else api.loadMidiForScore();
  scheduleBind();
  let wasPaused = adapter.paused;
  const timer = setInterval(() => {
    if (!output || disposed) return;
    // Native MP3/YouTube controls also drive the main transport.
    const playing = api.player?.state === a.synth.PlayerState.Playing;
    const paused = adapter.paused;
    if (paused !== wasPaused) {
      wasPaused = paused;
      if (paused && playing) api.pause();
      else if (!paused && !playing) api.play();
    }
    const ms = Math.max(0, Math.min(duration, (adapter.currentTime - offset) * 1000));
    if (Number.isFinite(ms)) output.updatePosition(ms);
  }, 50);
  return () => { disposed = true; clearInterval(timer); api.playerReady.off(scheduleBind); adapter.pause(); if (output) output.handler = undefined; };
}
