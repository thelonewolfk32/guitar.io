import type { Recording, Song } from './types';
import { recordingsFor } from './recordings';

export type InstructionalSeek = { recordingId: string; seconds: number; request: number };
export function instructionalsFor(song: Song): Recording[] { return recordingsFor(song).filter(r => r.kind === 'youtube' && r.purpose === 'instructional'); }

export function formatTimestamp(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds)), hours = Math.floor(value / 3600), minutes = Math.floor(value / 60) % 60, tail = String(value % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`;
}

/** Blank removes a timestamp; numbers mean seconds, colon notation means m:ss/h:mm:ss. */
export function parseTimestamp(text: string): number | undefined {
  const value = text.trim();
  if (!value) return undefined;
  const parts = value.split(':');
  if (parts.length > 3 || !parts.every(p => /^\d+$/.test(p)) || parts.slice(1).some(p => Number(p) > 59)) throw new Error('Use seconds, m:ss or h:mm:ss.');
  const seconds = parts.reduce((sum, part) => sum * 60 + Number(part), 0);
  if (!Number.isSafeInteger(seconds) || seconds > 604800) throw new Error('Choose a timestamp within seven days.');
  return seconds;
}
