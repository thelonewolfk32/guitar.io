import type * as AlphaTab from '@coderline/alphatab';

declare global { interface Window { alphaTab: typeof AlphaTab; } }

export type Progress = 'new' | 'learning' | 'comfortable' | 'mastered';
export type ProgressSplit = Record<Progress, number>;
export type Section = { id: string; name: string; start: number; end: number; color: string; status: Progress; notes: string; learnedPercent?: number; instructionalTimestamps?: Record<string, number>; speed?: number; createdAt?: string; updatedAt?: string };
export type Track = { index: number; name: string; tuning: string; notes: string; strings: number };
export type Folder = { id: string; name: string; color: string };
export type GuitarProfile = { id: string; name: string; make: string; model: string; material: string; stringGauge: string; notes: string; kind: 'guitar' | 'bass'; strings: number; tunings: { name: string; pitches: number[] }[]; artworkAssetId?: string; stringGauges?: string[]; stringBrand?: string; stringModel?: string; pickups?: string; bridge?: string; scaleLength?: string };
export type Asset = { id: string; kind: 'audio' | 'artwork'; name: string; mime: string; blob: Blob };
export type MediaSource = 'synth' | 'audio' | 'youtube' | 'instructional';
export type LocalAudio = { assetId: string; name: string; offsetSeconds: number };
export type YouTubeMedia = { videoId: string; url: string; offsetSeconds: number };
export type SyncAnchor = { scoreSeconds: number; mediaSeconds: number };
export type RecordingTempo = { bpm: number; referenceBpm: number; method: 'audio' | 'tap' | 'manual'; confidence?: number; analyzedAt?: string };
export type OnlineTempo = { bpm: number; recordingId: string; source: 'AcousticBrainz'; fetchedAt: string; enabled: boolean };
export type YouTubeSync = {source:'Songsterr'|'manual';enabled:boolean;videoId:string;songId?:number;revisionId?:number;fetchedAt?:string;points:{bar:number;seconds:number;occurrence?:number}[]};
/** Legacy recording calibration is retained for older backups, but is no longer used by playback. */
export type Recording = { id: string; label: string; tags: string[]; tempo?: RecordingTempo; onlineTempo?:OnlineTempo; youtubeSync?:YouTubeSync; syncAnchors?: SyncAnchor[]; createdAt?: string; updatedAt?: string } & ({ kind: 'audio'; purpose?: 'full' | 'backing' } & LocalAudio | { kind: 'youtube'; purpose?: 'full' | 'backing' | 'instructional' } & YouTubeMedia);
export type SongMedia = { audio?: LocalAudio; youtube?: YouTubeMedia; recordings?: Recording[] };
export type NoteEdit = { fret: number; string: number } | { octave: number; tone: number };
export type AnnotationPosition = { x: number; y: number };
export type SpliceEdit = {track:number;staff:number;start:number;end:number;dataBase64:string;createdAt:string};
export type ScoreAnnotation = { id: string; track: number; bar: number; noteKey?: string; text: string; color: string; free?: boolean };
export type Song = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  difficulty?: number;
  tuning: string;
  guitars: string[];
  tags: string[];
  fileName: string;
  format: string;
  source: Uint8Array;
  hash: string;
  bars: number;
  bpm: number;
  tempoEdits?: Record<string, number>;
  spliceEdits?:Record<string,SpliceEdit>;
  spliceUndo?:{editId:string;noteEdits:Record<string,NoteEdit>;tuningNoteCompensation:Record<string,{fret:number;string:number}>;annotations:ScoreAnnotation[]};
  songsterr?: {url:string;songId:number;revisionId:number;importedAt:string};
  tracks: Track[];
  trackIndex: number;
  sections: Section[];
  schemaVersion?: number;
  sectionsByTrack?: Record<string, Section[]>;
  folderId?: string;
  artworkAssetId?: string;
  collectionArt?: Record<string, string>;
  artworkSource?: string;
  media?: SongMedia;
  noteEdits?: Record<string, NoteEdit>;
  tuningEdits?: Record<string, number[]>;
  tuningCompensation?: Record<string, number[]>;
  tuningNoteCompensation?: Record<string, { fret: number; string: number }>;
  sourceTunings?: Record<string, number[]>;
  tuningBuckets?: string[];
  annotations?: ScoreAnnotation[];
  annotationPositions?: Record<string, AnnotationPosition>;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  lastPlayedAt?: string;
  lastPlayedBar?: number;
  fieldUpdatedAt?: Record<string, string>;
};
/** No original bytes, notation edits, sections, annotations or recording payloads. */
export type SongSummary = Pick<Song, 'songsterr' | 'id' | 'title' | 'artist' | 'album' | 'difficulty' | 'tuning' | 'guitars' | 'tags' | 'fileName' | 'format' | 'hash' | 'bars' | 'bpm' | 'tracks' | 'trackIndex' | 'folderId' | 'artworkAssetId' | 'collectionArt' | 'demo' | 'createdAt' | 'updatedAt' | 'lastOpenedAt' | 'lastPlayedAt' | 'lastPlayedBar' | 'tuningBuckets'> & {
  summaryVersion: 1;
  progress: number;
  progressState: 'explore' | 'progress' | 'mastered';
  progressSplit?: ProgressSplit;
  tuningCaption: { original: string; change: string };
  originalPitches: number[];
  recordingKinds: ('audio' | 'youtube')[];
  assetIds: string[];
};
export type LibrarySong = Song | SongSummary;
export type SyncChange = { revision?: number; deviceId: string; entity: 'song' | 'source' | 'asset' | 'folder' | 'guitar' | 'section' | 'recording' | 'annotation'; entityId: string; operation: 'upsert' | 'delete'; timestamp: string; fields: string[]; patch?: Record<string, unknown>; mapPatches?: Record<string, Record<string, unknown>> };
export type Range = { start: number; end: number };
export type FilterTab = 'All songs' | 'Artists' | 'Tunings' | 'Guitars' | 'Vibes & tags';
export type NotationMode = 'tab' | 'both' | 'score';

export const COLORS = ['#8b79ff', '#24b8a8', '#ed9235', '#e45d96', '#80b943', '#398de2', '#b36bd6', '#d7b62d'];
export const STATUS: Record<Progress, string> = { new: 'Not learnt', learning: 'Learning', comfortable: 'Comfortable', mastered: 'Mastered' };
