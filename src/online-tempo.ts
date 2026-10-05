import {lookupSongTempo} from '../electron/online-tempo.mjs';
import type {OnlineTempo,Song} from './types';

export async function findOnlineTempo(song:Song):Promise<OnlineTempo | undefined> {
  const details={title:song.title,artist:song.artist,album:song.album,bpm:song.bpm};
  return window.guitarIO?.lookupSongTempo ? window.guitarIO.lookupSongTempo(details) : lookupSongTempo(details);
}
