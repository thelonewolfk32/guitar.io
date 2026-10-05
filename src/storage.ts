import type { Song, SongSummary, Asset, Folder, GuitarProfile, SyncChange } from './types';
import { migrateSong, songProgress, songProgressSplit, collectionProgress, assetIds } from './library-model';
import { summarizeSong } from './song-summary';
import { recordingsFor, withRecordings } from './recordings';
import { correctTuningLabel } from './score-editing';
import { mergeSyncRow, syncKey } from './sync-model';

let database: Promise<IDBDatabase>;
export const storageStores = ['songs', 'songSources', 'songIndex', 'settings', 'assets', 'assetRefs', 'changes', 'artworkThumbs', 'syncEntities', 'syncTransfers', 'syncTransferChunks'];
const stores=storageStores;
const sources = new Map<string, Uint8Array>(), pendingSources = new Map<string, Promise<Uint8Array | undefined>>();
let missingContent:((kind:'source'|'asset',id:string)=>Promise<void>)|undefined;
export function setMissingContentLoader(loader:typeof missingContent){missingContent=loader;}
const removedAssets = new WeakMap<IDBTransaction, Set<string>>();
export const storageMetrics = { indexReads: 0, detailReads: 0, sourceReads: 0, assetReads: 0, songWrites: 0, sourceWrites: 0, indexWrites: 0 };
export function resetStorageMetrics() { for (const key of Object.keys(storageMetrics) as (keyof typeof storageMetrics)[]) storageMetrics[key] = 0; }
function remember(id: string, bytes: Uint8Array) {
  sources.delete(id); sources.set(id, bytes);
  while (sources.size > 3 || [...sources.values()].reduce((n, b) => n + b.byteLength, 0) > 64 * 1024 * 1024) sources.delete(sources.keys().next().value!);
}
function normalize(song: Song) {
  let result = migrateSong(song);
  const timestamp = song.updatedAt || new Date().toISOString();
  const stamp = <T extends { createdAt?: string; updatedAt?: string }>(item: T): T => ({...item,createdAt:item.createdAt || song.createdAt || timestamp,updatedAt:item.updatedAt || timestamp});
  result.sections=(result.sections || []).map(stamp);
  result.sectionsByTrack=Object.fromEntries(Object.entries(result.sectionsByTrack || {}).map(([track,list])=>[track,list.map(stamp)]));
  if(recordingsFor(result).length)result=withRecordings(result,recordingsFor(result).map(stamp));
  const track = result.tracks?.find(t => t.index === result.trackIndex);
  if (!result.sourceTunings && !Object.keys(result.tuningEdits || {}).length && track?.strings && result.tuning !== track.tuning) {
    try { result = correctTuningLabel({ ...result, tuning: track.tuning }, result.tuning); } catch { /* Preserve unknown labels. */ }
  }
  return result;
}
function request<T>(q: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); }); }
function complete(tx: IDBTransaction) { return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('The library could not be saved. Export a backup before closing.')); }); }
export function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const q = indexedDB.open('guitar-io-v1', 4);
    q.onupgradeneeded = event => {
      const d = q.result, tx = q.transaction!;
      for (const name of ['songs', 'assets', 'songSources', 'songIndex', 'artworkThumbs']) if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings');
      if (!d.objectStoreNames.contains('changes')) d.createObjectStore('changes', { keyPath: 'revision', autoIncrement: true });
      if (!d.objectStoreNames.contains('assetRefs')) { const refs = d.createObjectStore('assetRefs', { keyPath: ['assetId', 'owner'] }); refs.createIndex('assetId', 'assetId'); }
      if(!d.objectStoreNames.contains('syncEntities')){const state=d.createObjectStore('syncEntities',{keyPath:'key'});state.createIndex('revision','revision');}
      if(!d.objectStoreNames.contains('syncTransfers'))d.createObjectStore('syncTransfers',{keyPath:'key'});
      if(!d.objectStoreNames.contains('syncTransferChunks')){const chunks=d.createObjectStore('syncTransferChunks',{keyPath:['transfer','offset']});chunks.createIndex('transfer','transfer');}
      if(event.oldVersion>=3){
        // One-time journal indexing. Keep the existing device identity and profile.
        let latestClock=Date.now();
        const cursor=tx.objectStore('changes').openCursor();
        cursor.onsuccess=()=>{const c=cursor.result;if(!c){tx.objectStore('settings').put(latestClock,'syncClock');return;}const change=c.value as SyncChange,revision=Number(c.key),key=syncKey(change.entity,change.entityId),state=tx.objectStore('syncEntities').get(key);latestClock=Math.max(latestClock,Date.parse(change.timestamp)||0);state.onsuccess=()=>{const row=mergeSyncRow(state.result,change,revision);if(row)tx.objectStore('syncEntities').put(row);tx.objectStore('settings').put(revision,'syncHead');c.continue();};};
        return;
      }
      const deviceId = crypto.randomUUID(); tx.objectStore('settings').put(deviceId, 'deviceId');
      // Atomic one-time upgrade. Normal launches never scan/parse original files.
      const cursor = tx.objectStore('songs').openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result; if (!c) return;
        const song = normalize(c.value as Song), index = summarizeSong(song), { source, ...details } = song;
        tx.objectStore('songSources').put({ id: song.id, source }); c.update(details); tx.objectStore('songIndex').put(index);
        for (const assetId of index.assetIds) tx.objectStore('assetRefs').put({ assetId, owner: `song:${song.id}` });
        journal(tx, deviceId, 'song', song.id, undefined, details, song.updatedAt);
        journal(tx, deviceId, 'source', song.id, undefined, { hash: song.hash, byteLength: source.byteLength }, song.createdAt);
        c.continue();
      };
      for (const key of ['guitars', 'folders']) {
        const r = tx.objectStore('settings').get(key);
        r.onsuccess = () => { for (const item of r.result || []) { if (item.artworkAssetId) tx.objectStore('assetRefs').put({ assetId: item.artworkAssetId, owner: `guitar:${item.id}` }); journal(tx, deviceId, key === 'guitars' ? 'guitar' : 'folder', item.id, undefined, item, new Date().toISOString()); } };
      }
      const assets = tx.objectStore('assets').openCursor();
      assets.onsuccess = () => { const c = assets.result; if (c) { const { blob, ...meta } = c.value; journal(tx, deviceId, 'asset', String(c.key), undefined, { ...meta, byteLength: blob.size }, new Date().toISOString()); c.continue(); } };
    };
    q.onsuccess = () => { q.result.onversionchange = () => { q.result.close(); database = undefined!; }; resolve(q.result); };
    q.onerror = () => { database = undefined!; reject(q.error); };
    q.onblocked = () => reject(new Error('Another Guitar.io window is blocking the database. Close it and try again.'));
  });
  return database;
}
export async function readLibraryIndex(): Promise<{ songs: SongSummary[]; seeded: boolean; folders: Folder[]; guitars: GuitarProfile[] }> {
  const d = await db(), tx = d.transaction(['songIndex', 'settings'], 'readonly'); storageMetrics.indexReads++;
  const [songs, seeded, folders, guitars] = await Promise.all([request(tx.objectStore('songIndex').getAll()), request(tx.objectStore('settings').get('seeded')), request(tx.objectStore('settings').get('folders')), request(tx.objectStore('settings').get('guitars'))]);
  // Enrich older summary rows once using stored section metadata. No GP, MIDI
  // or assets are read, and rebuilding this derived cache emits no sync changes.
  const missing = (songs as SongSummary[]).filter(song=>!song.progressSplit);
  if(missing.length){
    const upgrade=d.transaction(['songs','songIndex'],'readwrite'),done=complete(upgrade);
    for(const index of missing){const details=await request(upgrade.objectStore('songs').get(index.id));if(details){index.progressSplit=songProgressSplit(details);upgrade.objectStore('songIndex').put(index);storageMetrics.indexWrites++;}}
    await done;
  }
  return { songs, seeded: !!seeded, folders: folders || [], guitars: guitars || [] };
}
export async function readSongSummary(id: string): Promise<SongSummary | undefined> { const d = await db(); return request(d.transaction('songIndex').objectStore('songIndex').get(id)); }
async function readSource(id: string): Promise<Uint8Array | undefined> {
  const cached = sources.get(id); if (cached) { remember(id, cached); return cached; }
  if (pendingSources.has(id)) return pendingSources.get(id);
  const pending = (async () => { const d = await db(); storageMetrics.sourceReads++; let record = await request(d.transaction('songSources').objectStore('songSources').get(id));if(record && !record.source && missingContent){await missingContent('source',id);record=await request(d.transaction('songSources').objectStore('songSources').get(id));} if (record?.source) remember(id, record.source); return record?.source; })();
  pendingSources.set(id, pending); try { return await pending; } finally { pendingSources.delete(id); }
}
export async function readSong(id: string): Promise<Song | undefined> {
  const d = await db(); storageMetrics.detailReads++;
  const [details, source] = await Promise.all([request(d.transaction('songs').objectStore('songs').get(id)), readSource(id)]);
  if(details && !source)throw new Error('The tab is not cached here yet. Connect an awake paired device on the same Wi-Fi or LAN to download it.');
  return details && source ? { ...details, source } : undefined;
}
/** Full read is reserved for explicit backup export and legacy callers. */
export async function readLibrary() { const index = await readLibraryIndex(), songs = await Promise.all(index.songs.map(s => readSong(s.id))); return { ...index, songs: songs.filter((s): s is Song => !!s), migrated: false }; }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function changedFields(before: Record<string, unknown> | undefined, after: Record<string, unknown>) { return [...new Set([...Object.keys(before || {}), ...Object.keys(after)])].filter(key => !equal(before?.[key], after[key])); }
function stampItems<T extends { id: string; createdAt?: string; updatedAt?: string }>(next: T[], old: T[] | undefined, now: string): T[] {
  return next.map(item => { const previous = old?.find(s => s.id === item.id), { createdAt: _a, updatedAt: _b, ...content } = item, { createdAt: _c, updatedAt: _d, ...previousContent } = previous || {}; return { ...item, createdAt: previous?.createdAt || item.createdAt || now, updatedAt: previous && equal(content, previousContent) ? previous.updatedAt || now : now }; });
}
function journal(tx: IDBTransaction, deviceId: string, entity: SyncChange['entity'], entityId: string, before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined, now: string) {
  if (entity === 'song' && after) {
    const maps = ['spliceEdits','noteEdits','tempoEdits','tuningEdits','sourceTunings','tuningCompensation','tuningNoteCompensation','annotationPositions'];
    const excluded = ['sections','sectionsByTrack','annotations','media','fieldUpdatedAt','updatedAt', ...maps];
    const plain = (value: Record<string, unknown> | undefined) => value ? Object.fromEntries(Object.entries(value).filter(([key])=>!excluded.includes(key))) : undefined;
    const old = plain(before), next = plain(after)!, fields = changedFields(old, next), mapPatches: Record<string,Record<string,unknown>> = {};
    for (const name of maps) {
      const previous=before?.[name] as Record<string,unknown> | undefined, incoming=after[name] as Record<string,unknown> | undefined;
      const keys=changedFields(previous,incoming || {});
      if(keys.length)mapPatches[name]=Object.fromEntries(keys.map(key=>[key,incoming?.[key] ?? null]));
    }
    if(fields.length || Object.keys(mapPatches).length)addLocalChange(tx,{deviceId,entity,entityId,timestamp:now,operation:'upsert',fields,patch:Object.fromEntries(fields.map(key=>[key,next[key] ?? null])),mapPatches});
    const lists = (kind: 'section' | 'annotation' | 'recording', oldList: {id:string}[], newList: {id:string}[], track?: string) => {
      for(const item of newList)journal(tx,deviceId,kind,`${entityId}:${track === undefined?'':track+':'}${item.id}`,oldList.find(s=>s.id===item.id) as Record<string,unknown> | undefined,{...item,songId:entityId,...(track===undefined?{}:{trackIndex:Number(track)})},now);
      for(const item of oldList)if(!newList.some(s=>s.id===item.id))journal(tx,deviceId,kind,`${entityId}:${track === undefined?'':track+':'}${item.id}`,undefined,undefined,now);
    };
    for(const track of new Set([...Object.keys(before?.sectionsByTrack || {}),...Object.keys(after.sectionsByTrack || {})])) {
      const list=(after.sectionsByTrack as Record<string,{id:string}[]> || {})[track] || [];
      const oldList=(before?.sectionsByTrack as Record<string,{id:string}[]> | undefined)?.[track] || [];
      // Include parent fields on both sides so unchanged entities create no outbox record.
      lists('section',oldList.map(s=>({...s,songId:entityId,trackIndex:Number(track)})),list,track);
    }
    const media=(value: Record<string,unknown> | undefined) => value ? recordingsFor(value as unknown as Song) : [];
    lists('recording',media(before).map(r=>({...r,songId:entityId})),media(after));
    lists('annotation',((before?.annotations || []) as {id:string}[]).map(a=>({...a,songId:entityId})),(after.annotations || []) as {id:string}[]);
    return;
  }
  const fields = after ? changedFields(before, after) : []; if (after && !fields.length) return;
  addLocalChange(tx,{ deviceId, entity, entityId, timestamp: now, operation: after ? 'upsert' : 'delete', fields, ...(after ? { patch: Object.fromEntries(fields.map(key => [key, after[key] ?? null])) } : {}) });
}
function addLocalChange(tx:IDBTransaction,change:SyncChange){
  const added=tx.objectStore('changes').add(change);
  added.onsuccess=()=>{const revision=Number(added.result),key=syncKey(change.entity,change.entityId),q=tx.objectStore('syncEntities').get(key);q.onsuccess=()=>{const row=mergeSyncRow(q.result,change,revision);if(row)tx.objectStore('syncEntities').put(row);};tx.objectStore('settings').put(revision,'syncHead');if(revision>2000&&revision%100===0)tx.objectStore('changes').delete(IDBKeyRange.upperBound(revision-2000));};
}
export async function syncNow(tx:IDBTransaction){const previous=await request(tx.objectStore('settings').get('syncClock')) || 0;const now=Math.max(Date.now(),Number(previous)+1);tx.objectStore('settings').put(now,'syncClock');return new Date(now).toISOString();}
function updateRefs(tx: IDBTransaction, deviceId: string, owner: string, before: string[], after: string[], now: string) {
  for (const assetId of after) if (!before.includes(assetId)) tx.objectStore('assetRefs').put({ assetId, owner });
  for (const assetId of before) if (!after.includes(assetId)) {
    tx.objectStore('assetRefs').delete([assetId, owner]);
    const removed=removedAssets.get(tx) || new Set<string>();removed.add(assetId);removedAssets.set(tx,removed);
  }
}
function cleanRemovedAssets(tx: IDBTransaction, deviceId: string, now: string) {
  // Check after all owners have been written, including ownership transfers
  // between a song and a newly created guitar within this transaction.
  for(const assetId of removedAssets.get(tx) || []) {
    const count=tx.objectStore('assetRefs').index('assetId').count(assetId);
    count.onsuccess=()=>{if(!count.result){tx.objectStore('assets').delete(assetId);tx.objectStore('artworkThumbs').delete(assetId);journal(tx,deviceId,'asset',assetId,undefined,undefined,now);}};
  }
  removedAssets.delete(tx);
}
function writeIndex(tx: IDBTransaction, deviceId: string, old: SongSummary | undefined, index: SongSummary, now: string) { tx.objectStore('songIndex').put(index); storageMetrics.indexWrites++; updateRefs(tx, deviceId, `song:${index.id}`, old?.assetIds || [], index.assetIds, now); }
function progressState(song: Song): SongSummary['progressState'] { const stats = collectionProgress([song]); return stats.mastered ? 'mastered' : stats.progress ? 'progress' : 'explore'; }

export async function saveSongs(songs: Song[], seeded = false, assets: Asset[] = [], folders?: Folder[], guitars?: GuitarProfile[]): Promise<Song[]> {
  const thumbs = await Promise.all(assets.map(async a => ({id:a.id,blob:a.kind==='artwork'?await thumbnail(a.blob):undefined})));
  const d = await db(), tx = d.transaction(stores, 'readwrite'), done = complete(tx), now = await syncNow(tx), deviceId = await request(tx.objectStore('settings').get('deviceId')), saved: Song[] = [];
  try {
    for (const song of songs) {
      if ('summaryVersion' in song || !(song.source instanceof Uint8Array)) throw new Error('Load the full song before saving notation.');
      const [old, oldIndex] = await Promise.all([request(tx.objectStore('songs').get(song.id)), request(tx.objectStore('songIndex').get(song.id))]);
      if (old?.hash && old.hash !== song.hash) throw new Error('The original tab is immutable. Import the new file as a separate song.');
      let original = sources.get(song.id);
      if (old && !original) { storageMetrics.sourceReads++; original=(await request(tx.objectStore('songSources').get(song.id)))?.source; }
      if(old && !original)throw new Error('The original tab is missing. Restore it from a backup.');
      let next = normalize({...song,source:old ? original! : song.source});
      next.sections = stampItems(next.sections || [], old?.sections, now);
      next.sectionsByTrack = Object.fromEntries(Object.entries(next.sectionsByTrack || {}).map(([track, list]) => [track, stampItems(list, old?.sectionsByTrack?.[track], now)]));
      if (next.media?.recordings) next.media = { ...next.media, recordings: stampItems(next.media.recordings, old?.media?.recordings, now) };
      for (const key of ['lastOpenedAt', 'lastPlayedAt'] as const) if (old?.[key] && (!next[key] || old[key] > next[key]!)) { next[key] = old[key]; if (key === 'lastPlayedAt') next.lastPlayedBar = old.lastPlayedBar; }
      const { source, tuningBuckets: _derived, ...details } = next, fields = changedFields(old, details).filter(k => !['updatedAt', 'fieldUpdatedAt'].includes(k));
      details.updatedAt = fields.length ? now : old?.updatedAt || now; details.fieldUpdatedAt = { ...old?.fieldUpdatedAt, ...Object.fromEntries(fields.map(k => [k, now])) };
      if (!old) { tx.objectStore('songSources').put({ id: song.id, source }); storageMetrics.sourceWrites++; journal(tx, deviceId, 'source', song.id, undefined, { hash: song.hash, byteLength: source.byteLength }, now); }
      if (!old || !equal(old, details)) { tx.objectStore('songs').put(details); storageMetrics.songWrites++; journal(tx, deviceId, 'song', song.id, old, details, now); }
      next = { ...details, source }; saved.push(next);
      const affectsNotation = !oldIndex || fields.some(k => ['spliceEdits', 'tracks', 'trackIndex', 'sourceTunings', 'tuningEdits', 'noteEdits', 'tuning'].includes(k));
      const index: SongSummary = affectsNotation ? summarizeSong(next) : { ...oldIndex, ...Object.fromEntries(Object.keys(oldIndex).filter(k => k in details).map(k => [k, (details as unknown as Record<string, unknown>)[k]])), progress: songProgress(next), progressSplit:songProgressSplit(next), progressState: progressState(next), assetIds: assetIds(next), recordingKinds: [...new Set((next.media?.recordings || []).map(r => r.kind))] };
      if (!equal(oldIndex, index)) writeIndex(tx, deviceId, oldIndex, index, now);
    }
    for (const asset of assets) { const old = await request(tx.objectStore('assets').get(asset.id)); if (old) continue; tx.objectStore('assets').put(asset); const thumb=thumbs.find(t=>t.id===asset.id);if(thumb?.blob)tx.objectStore('artworkThumbs').put(thumb); const { blob, ...meta } = asset; journal(tx, deviceId, 'asset', asset.id, undefined, { ...meta, byteLength: blob.size }, now); }
    // Settings arrays stay compatible; the sync outbox records only changed IDs.
    for (const [key, incoming] of [['folders', folders], ['guitars', guitars]] as const) if (incoming) {
      const previous = await request(tx.objectStore('settings').get(key)) || [];
      for (const item of incoming) { const old = previous.find((p: { id: string }) => p.id === item.id); journal(tx, deviceId, key === 'guitars' ? 'guitar' : 'folder', item.id, old, item, now); if (key === 'guitars') { const g = item as GuitarProfile; updateRefs(tx, deviceId, `guitar:${item.id}`, old?.artworkAssetId ? [old.artworkAssetId] : [], g.artworkAssetId ? [g.artworkAssetId] : [], now); } }
      for (const old of previous) if (!incoming.some(item => item.id === old.id)) { journal(tx, deviceId, key === 'guitars' ? 'guitar' : 'folder', old.id, old, undefined, now); if (old.artworkAssetId) updateRefs(tx, deviceId, `guitar:${old.id}`, [old.artworkAssetId], [], now); }
      if (!equal(previous, incoming)) tx.objectStore('settings').put(incoming, key);
    }
    if (seeded) tx.objectStore('settings').put(true, 'seeded');
  } catch (e) { tx.abort(); await done.catch(() => {}); throw e; }
  cleanRemovedAssets(tx,deviceId,now);await done; for (const song of saved) remember(song.id, song.source);announce(); return saved;
}
type IndexPatch = Partial<Pick<Song, 'title' | 'artist' | 'album' | 'difficulty' | 'folderId' | 'guitars' | 'tags' | 'collectionArt' | 'artworkAssetId' | 'lastOpenedAt' | 'lastPlayedAt' | 'lastPlayedBar'>>;
/** Metadata/activity updates never load or rewrite original tab bytes. */
export async function patchSongs(patches: { id: string; patch: IndexPatch }[]): Promise<SongSummary[]> {
  const d = await db(), tx = d.transaction(stores, 'readwrite'), done = complete(tx), now = await syncNow(tx), result: SongSummary[] = [], deviceId = await request(tx.objectStore('settings').get('deviceId'));
  try { for (const { id, patch } of patches) {
    const [old, index] = await Promise.all([request(tx.objectStore('songs').get(id)), request(tx.objectStore('songIndex').get(id))]); if (!old || !index) continue;
    const details = { ...old, ...patch }, fields = changedFields(old, details); if (!fields.length) { result.push(index); continue; }
    details.updatedAt = now; details.fieldUpdatedAt = { ...old.fieldUpdatedAt, ...Object.fromEntries(fields.map(k => [k, now])) };
    const next = { ...index, ...patch, updatedAt: now, assetIds: [...new Set([details.artworkAssetId, ...Object.values(details.collectionArt || {}), ...(details.media?.recordings || []).filter((r: { kind: string }) => r.kind === 'audio').map((r: { assetId: string }) => r.assetId), details.media?.audio?.assetId].filter((id): id is string => typeof id === 'string' && !!id))] };
    tx.objectStore('songs').put(details); storageMetrics.songWrites++; writeIndex(tx, deviceId, index, next, now); journal(tx, deviceId, 'song', id, old, details, now); result.push(next);
  } } catch (e) { tx.abort(); await done.catch(() => {}); throw e; }
  cleanRemovedAssets(tx,deviceId,now);await done;if(result.length)announce(); return result;
}
export async function removeSong(id: string): Promise<void> {
  const d = await db(), tx = d.transaction(stores, 'readwrite'), done = complete(tx), now = await syncNow(tx), [index, deviceId] = await Promise.all([request(tx.objectStore('songIndex').get(id)), request(tx.objectStore('settings').get('deviceId'))]);
  if (index) { updateRefs(tx, deviceId, `song:${id}`, index.assetIds, [], now); tx.objectStore('songs').delete(id); tx.objectStore('songSources').delete(id); tx.objectStore('songIndex').delete(id); journal(tx, deviceId, 'song', id, undefined, undefined, now); journal(tx, deviceId, 'source', id, undefined, undefined, now); }
  cleanRemovedAssets(tx,deviceId,now);await done; sources.delete(id);announce();
}
export async function getAsset(id: string): Promise<Asset | undefined> { const d = await db(); storageMetrics.assetReads++;let asset=await request(d.transaction('assets').objectStore('assets').get(id));if(asset && !asset.blob && missingContent){await missingContent('asset',id);asset=await request(d.transaction('assets').objectStore('assets').get(id));}return asset?.blob?asset:undefined; }
/** Explicit maintenance only; saves clean up just the removed references. */
export async function pruneAssets(): Promise<void> {
  const d = await db(), tx = d.transaction(['assets', 'assetRefs', 'changes', 'settings', 'artworkThumbs'], 'readwrite'), done = complete(tx), deviceId = await request(tx.objectStore('settings').get('deviceId')), cursor = tx.objectStore('assets').openKeyCursor();
  cursor.onsuccess = () => { const c = cursor.result; if (!c) return; const count = tx.objectStore('assetRefs').index('assetId').count(c.key); count.onsuccess = () => { if (!count.result) { tx.objectStore('assets').delete(c.key);tx.objectStore('artworkThumbs').delete(c.key); journal(tx, deviceId, 'asset', String(c.key), undefined, undefined, new Date().toISOString()); } c.continue(); }; }; await done;
}
/** Durable local outbox for a future authenticated LAN transport. Media bytes
 * are referenced by ID and transferred only when changed/missing, never inline. */
export async function readChanges(afterRevision = 0, limit = 200): Promise<SyncChange[]> { const d = await db(); return request(d.transaction('changes').objectStore('changes').getAll(IDBKeyRange.lowerBound(afterRevision, true), Math.min(1000, Math.max(1, limit)))); }
export async function getDeviceId(): Promise<string> { const d = await db(); return request(d.transaction('settings').objectStore('settings').get('deviceId')); }
export function forgetSource(id:string){sources.delete(id);}
function announce(){if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('guitario:changed'));}

async function thumbnail(blob: Blob): Promise<Blob> {
  if(typeof createImageBitmap==='undefined' || typeof document==='undefined')return blob;
  let bitmap: ImageBitmap | undefined;
  try { bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas'),scale=Math.min(1,256/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b || blob),'image/webp',.78)); }
  catch {return blob;} finally {bitmap?.close();}
}
export async function getArtworkThumbnail(id: string): Promise<Blob | undefined> {
  const d=await db(),saved=await request(d.transaction('artworkThumbs').objectStore('artworkThumbs').get(id));
  if(saved)return saved.blob;
  const asset=await getAsset(id);if(!asset)return;
  if(asset.kind!=='artwork')return asset.blob;
  const blob=await thumbnail(asset.blob),tx=d.transaction('artworkThumbs','readwrite');tx.objectStore('artworkThumbs').put({id,blob});await complete(tx);return blob;
}
