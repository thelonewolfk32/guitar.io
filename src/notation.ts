import type { model } from '@coderline/alphatab';
import type { Song, Section, Track } from './types';
import { tuningName } from './tunings';
import { COLORS } from './types';

export const ACCEPT = '.gp,.gpx,.gp3,.gp4,.gp5,.gp6,.gp7,.gp8,.xml,.musicxml,.mxl,.alphatex,.atex,.tex';
export const MAX_FILE = 30 * 1024 * 1024;

export function readScore(source: Uint8Array, fileName: string): model.Score {
  if (/\.(alphatex|atex|tex)$/i.test(fileName)) return window.alphaTab.importer.ScoreLoader.loadAlphaTex(new TextDecoder().decode(source));
  return window.alphaTab.importer.ScoreLoader.loadScoreFromBytes(source);
}

function trackInfo(track: model.Track): Track {
  const values = track.staves.find(s => s.stringTuning.tunings.length)?.stringTuning.tunings || [];
  const key = values.join(',');
  const presets: Record<string, string> = {
    '64,59,55,50,45,40': 'E standard', '64,59,55,50,45,38': 'Drop D',
    '62,57,53,48,43,38': 'D standard', '62,57,53,48,43,36': 'Drop C',
    '63,58,54,49,44,39': 'E♭ standard', '63,58,54,49,44,37': 'Drop C♯',
    '60,55,51,46,41,34': 'Drop B♭', '61,56,52,47,42,35': 'Drop B',
    '64,59,55,50,45,40,35': 'B standard · 7-string',
    '64,59,55,50,45,40,33': 'Drop A · 7-string',
    '64,59,55,50,45,40,35,30': 'F♯ standard · 8-string',
  };
  const notes = [...values].reverse().map(n => window.alphaTab.model.Tuning.getTextForTuning(n, true)).join(' · ');
  return { index: track.index, name: track.name || `Track ${track.index + 1}`, strings: values.length, notes, tuning: presets[key] || (values.length ? tuningName(values, track.playbackInfo.program >= 32 && track.playbackInfo.program >= 0 && track.playbackInfo.program <= 39) : 'Standard notation') };
}

export function scoreMetadata(score: model.Score) {
  const tracks = score.tracks.map(trackInfo);
  const primary = tracks.find(t => t.strings > 0 && score.tracks[t.index].playbackInfo.program >= 24 && score.tracks[t.index].playbackInfo.program <= 31) || tracks.find(t => t.strings >= 6 && !score.tracks[t.index].isPercussion) || tracks.find(t => t.strings > 0) || tracks[0];
  const markers = score.masterBars.filter(bar => bar.section?.text || bar.section?.marker);
  const sections: Section[] = markers.map((bar, i) => ({
    id: crypto.randomUUID(), name: bar.section!.text || bar.section!.marker,
    start: bar.index + 1, end: markers[i + 1]?.index ?? score.masterBars.length,
    color: COLORS[i % COLORS.length], status: 'new', notes: '',
  }));
  return { title: score.title.replaceAll('\u00a0', ' '), artist: score.artist.replaceAll('\u00a0', ' '), bars: score.masterBars.length, bpm: score.tempo, tracks, trackIndex: primary?.index || 0, tuning: primary?.tuning || 'Unspecified', sections };
}

export async function makeSong(source: Uint8Array, fileName: string): Promise<Song> {
  if (source.byteLength > MAX_FILE) throw new Error('Choose a file smaller than 30 MB.');
  const score = readScore(source, fileName);
  const meta = scoreMetadata(score);
  if (!meta.bars || !meta.tracks.length) throw new Error('This file does not contain a playable score.');
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(source));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return {
    ...meta, album: score.album?.trim() || '', id: crypto.randomUUID(), title: meta.title?.trim() || fileName.replace(/\.[^.]+$/, ''),
    artist: meta.artist?.trim() || 'Unknown artist', guitars: [], tags: [], fileName,
    format: fileName.split('.').pop()?.toUpperCase() || 'FILE', source, hash, demo: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function toBase64(bytes: Uint8Array): string {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return btoa(chunks.join(''));
}
export function fromBase64(text: string): Uint8Array { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
