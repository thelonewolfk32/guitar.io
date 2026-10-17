import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Library, UsersRound, SlidersHorizontal, Guitar, Tags, Plus, X, Upload, FolderOpen, HardDrive, Check, Download, HelpCircle, LoaderCircle, AlertCircle, Trash2, Info, Settings2, Wifi } from 'lucide-react';
import type { Song, SongSummary, LibrarySong, FilterTab, Folder, Asset, GuitarProfile } from './types';
import { filterSongs, songValues } from './domain.mjs';
import { readLibrary, readLibraryIndex, readSong, readSongSummary, patchSongs, removeSong, removeGuitar, saveSongs, flushStorage } from './storage';
import { ACCEPT, download, makeSong } from './notation';
import { migrateSong, songProgress, assetIds } from './library-model';
import { encodeBackup, decodeBackup } from './backups';
import { Modal } from './ui';
import { MetadataEditor, FolderEditor } from './LibraryEditors';
import ImportReview from './ImportReview';
import SongsterrImport from './SongsterrImport';
import { songsterrScore, songsterrRecordings, type SongsterrImportResult } from './songsterr-score';
import LibraryHome, { type LibraryFilters } from './LibraryHome';
import { collectionKey } from './CollectionCard';
import ScoreWorkspace from './ScoreWorkspace';
import { summarizeSong } from './song-summary';
import { recordingsFor, withRecordings } from './recordings';
import GuitarEditor, { newGuitar } from './GuitarEditor';
import { validateGuitars } from './guitars';
import { parseTuning, correctTuningLabel } from './score-editing';
import { findArtwork } from './artwork';
import { automaticGuitars, guitarNamesFor } from './guitar-matching';
import { sortSongs } from './library-order';
import { tuningBuckets } from './tuning-caption';
import {SyncEngine} from './lan-sync';
import DeviceSync, {PairingRequest} from './DeviceSync';
import AccountPlans from './AccountPlans';
import {CloudSyncEngine} from './cloud-sync';
import {account} from './account';
import {servicesReady} from './service-config';
import {featureAccess} from './plans';
import {useUpdates,UpdateSettings,UpdateReadyButton} from './AppUpdates';
import {updateAvailability,type UpdateAvailability} from './update-state';
import {switchStorageScope,storageScope} from './storage';
import {installLibraryPolicy,assertEntryActive,completePending} from './library-access';
import ShareSongs from './ShareSongs';
import Feedback from './Feedback';
import type {PendingSong} from './share-model';
import {usage,flushUsage} from './usage';
import {flushPractice,practice} from './practice';
import {syncSetting} from './sync-storage';

export default function App() {
  const updateBlock=useRef<()=>UpdateAvailability>(()=>({reason:'The library is still loading.',canForce:false})),updateStopping=useRef(false),updatePrepare=useRef<(force:boolean)=>Promise<void>>(async()=>{});
  const [updatePreparing,setUpdatePreparing]=useState(false);
  const updates=useUpdates(()=>updateBlock.current());
  const [songs, setSongs] = useState<SongSummary[]>([]), [folders, setFolders] = useState<Folder[]>([]);
  const [guitars, setGuitars] = useState<GuitarProfile[]>([]), [guitarEditor, setGuitarEditor] = useState<GuitarProfile | null>(null);
  const [addGuitarTuning,setAddGuitarTuning]=useState(false);
  const songsRef = useRef(songs); songsRef.current = songs;
  const [booting, setBooting] = useState(true), [fatal, setFatal] = useState('');
  const [selectedId, setSelectedId] = useState(''), [editingId, setEditingId] = useState(''), [deletingId, setDeletingId] = useState('');
  const [active, setActive] = useState<Song>(), [editing, setEditing] = useState<Song>(), [loadingSong, setLoadingSong] = useState(false);
  const [folderEditor, setFolderEditor] = useState<Folder | 'new' | null>(null), [folderId, setFolderId] = useState('');
  const [tab, setTab] = useState<FilterTab>('All songs'), [group, setGroup] = useState(''), [query, setQuery] = useState(''), [sort, setSort] = useState('added');
  const [filters, setFilters] = useState<LibraryFilters>({ artist: '', tuning: '', guitar: '', tag: '', difficulty: '' });
  const [modal, setModal] = useState<'import' | 'backups' | 'help' | 'sync' | 'updates' | 'account' | 'feedback' | null>(null);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [dragOver, setDragOver] = useState(false);
  const [attachEntry,setAttachEntry]=useState<PendingSong>();
  const [cloudStatus,setCloudStatus]=useState('');
  const [pendingImport, setPendingImport] = useState<{songs:Song[];assets:Asset[]} | null>(null);
  const [importMessages, setImportMessages] = useState<string[]>([]), [deleteError, setDeleteError] = useState('');
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [backupCandidate, setBackupCandidate] = useState<Awaited<ReturnType<typeof decodeBackup>> | null>(null), [backupError, setBackupError] = useState('');
  const [backupMedia, setBackupMedia] = useState(true);
  const [autoArtwork, setAutoArtwork] = useState(() => window.localStorage.getItem('guitario-auto-artwork') !== 'off');
  const fileInput = useRef<HTMLInputElement>(null), backupInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSafe=useRef(false);syncSafe.current=!updateStopping.current&&!booting&&!selectedId&&!editingId&&!busy&&!saving&&!pendingImport&&!guitarEditor&&!folderEditor&&(!modal||modal==='sync'||modal==='help'||modal==='account');
  const [syncEngine]=useState(()=>new SyncEngine(()=>syncSafe.current,()=>{void readLibraryIndex().then(data=>{setSongs(data.songs);setFolders(data.folders);setGuitars(data.guitars);}).catch(error=>notify(String(error),true));}));
  const [cloudEngine]=useState(()=>new CloudSyncEngine(()=>syncSafe.current,()=>{void readLibraryIndex().then(data=>{setSongs(data.songs);setFolders(data.folders);setGuitars(data.guitars);}).catch(error=>notify(String(error),true));}));
  // Read mutable sync status when requested, rather than caching it at render.
  updateBlock.current=()=>updateAvailability({stopping:updateStopping.current,booting,busy,saving,player:!!(selectedId||active||loadingSong),editor:!!(editingId||pendingImport||guitarEditor||folderEditor||backupCandidate||deletingId||(modal&&modal!=='updates'&&modal!=='help')),syncBusy:syncEngine.view.busy||cloudEngine.busy});
  updatePrepare.current=async(force)=>{const block=updateBlock.current();if(block.reason&&(!force||!block.canForce))throw Error('UPDATE_BLOCKED: '+block.reason);updateStopping.current=true;syncSafe.current=false;setUpdatePreparing(true);try{if(force){setSelectedId('');setEditingId('');setGuitarEditor(null);setFolderEditor(null);setPendingImport(null);setBackupCandidate(null);setDeletingId('');setModal(null);}await cloudEngine.pauseForUpdate();await syncEngine.pauseForUpdate();await flushStorage();}catch(error){updateStopping.current=false;setUpdatePreparing(false);syncEngine.resumeAfterUpdate();cloudEngine.resumeAfterUpdate();throw error;}};
  useEffect(()=>{installLibraryPolicy();let stopped=false,changing=Promise.resolve();const changed=()=>{changing=changing.then(async()=>{if(stopped)return;const scope=account.session?.user.id||'';if(storageScope()!==scope){setSelectedId('');setEditingId('');setPendingImport(null);setAttachEntry(undefined);setBooting(true);await cloudEngine.pauseForUpdate();await syncEngine.pauseForUpdate();syncEngine.stop();await switchStorageScope(scope);await syncEngine.start();cloudEngine.resumeAfterUpdate();syncEngine.resumeAfterUpdate();window.dispatchEvent(new Event('guitario:entries-changed'));window.guitarIO?.updateLearn?.('',scope);}const data=await readLibraryIndex();if(!stopped){setSongs(data.songs);setFolders(data.folders);setGuitars(data.guitars);setBooting(false);}}).catch(e=>{notify(String(e),true);setBooting(false);});};window.addEventListener('guitario:account-changed',changed);window.addEventListener('guitario:changed',changed);void account.restore().catch(()=>{});return()=>{stopped=true;window.removeEventListener('guitario:account-changed',changed);window.removeEventListener('guitario:changed',changed);};},[]);
  useEffect(()=>{let stopped=false,running=false,next=0,delay=10000;async function tick(){if(stopped||running||!syncSafe.current||!account.session||storageScope()!==account.session.user.id||Date.now()<next||!await syncSetting('cloud-consent'))return;running=true;try{await cloudEngine.run(setCloudStatus);await flushPractice();await flushUsage();usage('sync_complete');delay=10000;}catch(e){setCloudStatus(e instanceof Error?e.message:String(e));delay=Math.min(300000,delay*2);}finally{next=Date.now()+delay;running=false;}}const timer=setInterval(()=>void tick(),5000);window.addEventListener('online',tick);return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',tick);};},[cloudEngine]);
  useEffect(()=>window.guitarUpdates?.onPrepare(force=>updatePrepare.current(force)),[]);
  useEffect(()=>window.guitarUpdates?.onChange(state=>{if(state.message&&state.status!=='installing'){updateStopping.current=false;setUpdatePreparing(false);syncEngine.resumeAfterUpdate();cloudEngine.resumeAfterUpdate();}}),[syncEngine]);
  useEffect(()=>{if(!booting&&!fatal)void window.guitarUpdates?.activated?.().catch(()=>{});},[booting,fatal]);
  useEffect(()=>{void syncEngine.start().catch(error=>notify('Device sync: '+String(error),true));return()=>syncEngine.stop();},[syncEngine]);
  useEffect(()=>{if(syncSafe.current&&!booting)void syncEngine.run(true);},[selectedId,editingId,modal,booting]);
  function notify(text: string, error = false) {
    setToast({ text, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 9000 : 4500);
  }
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const loaded = await readLibraryIndex();
        if (!disposed) { setSongs(loaded.songs); setFolders(loaded.folders); setGuitars(loaded.guitars); }
      } catch (e) { if (!disposed) setFatal(e instanceof Error ? e.message : 'The library could not be opened.'); }
      finally { if (!disposed) setBooting(false); }
    })();
    return () => { disposed = true; if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  const librarySongs = useMemo(()=>{
    const artists = new Map<string,string>();
    return songs.map(s=>{const key=s.artist.trim().toLocaleLowerCase(); if(!artists.has(key)) artists.set(key,s.artist.trim() || 'Unknown artist'); return {...s,artist:artists.get(key)!,guitars:guitarNamesFor(s,guitars),tuningBuckets:tuningBuckets(s)};});
  },[songs,guitars]);
  const filtered = useMemo(() => {
    const result = (filterSongs(librarySongs, query, tab, group) as SongSummary[]).filter(s => (!folderId || (folderId === 'unfiled' ? !s.folderId : s.folderId === folderId)) && (!filters.artist || s.artist === filters.artist) && (!filters.tuning || songValues(s,'Tunings').includes(filters.tuning)) && (!filters.guitar || songValues(s, 'Guitars').includes(filters.guitar)) && (!filters.tag || songValues(s, 'Vibes & tags').includes(filters.tag)) && (!filters.difficulty || (filters.difficulty === 'unrated' ? !s.difficulty : s.difficulty === Number(filters.difficulty))));
    return sortSongs(result,sort);
  }, [librarySongs, query, tab, group, sort, folderId, filters]);
  const deleting = songs.find(s => s.id === deletingId);
  function mergeSummaries(changed: SongSummary[]) { setSongs(previous => previous.map(s => changed.find(c => c.id === s.id) || s)); }
  useEffect(() => {
    let disposed = false;
    if (!selectedId) { setActive(undefined); setLoadingSong(false); return; }
    setLoadingSong(true);
    (async () => {
      try {
        await assertEntryActive(selectedId);usage('score_open');
        const song = await readSong(selectedId); if (!song) throw new Error('This song is no longer available.');
        const lastOpenedAt = new Date().toISOString();
        const summaries = await patchSongs([{id: song.id, patch: {lastOpenedAt}}]);
        if (!disposed) { mergeSummaries(summaries); setActive({...song,lastOpenedAt}); }
      } catch(e) { if (!disposed) { notify(e instanceof Error ? e.message : 'Could not load the song.',true); setSelectedId(''); } }
      finally { if (!disposed) setLoadingSong(false); }
    })();
    return () => { disposed = true; };
  },[selectedId]);
  useEffect(() => {
    let disposed = false;
    if (!editingId) { setEditing(undefined); return; }
    if (active?.id === editingId) { setEditing(active); return; }
    assertEntryActive(editingId).then(()=>readSong(editingId)).then(song => { if (!disposed) setEditing(song); }).catch(e => { if (!disposed) { notify(String(e),true); setEditingId(''); } });
    return () => { disposed = true; };
  },[editingId]);
  async function recordPlay(songId: string, bar: number) {
    try { mergeSummaries(await patchSongs([{id:songId,patch:{lastPlayedAt:new Date().toISOString(),lastPlayedBar:bar}}])); }
    catch(e) { notify('Could not save playback history. '+String(e),true); }
  }
  useEffect(()=>{ window.guitarIO?.updateLearn?.(active?.id || '',storageScope()); },[active?.id,active?.updatedAt]);
  function openLearn() {
    usage('learn_open');
    if(window.guitarIO?.openLearn) void window.guitarIO.openLearn(active?.id || '',storageScope()).catch(e=>notify(String(e),true));
    else window.open(`?learn=1&song=${encodeURIComponent(active?.id || '')}&scope=${encodeURIComponent(storageScope())}`,'guitario-learn','width=1280,height=920');
  }
  const navItems = [{ label: 'All songs', icon: Library }, { label: 'Artists', icon: UsersRound }, { label: 'Tunings', icon: SlidersHorizontal }, { label: 'Guitars', icon: Guitar }, { label: 'Vibes & tags', icon: Tags }] as const;
  async function saveSong(song: Song, assets: Asset[] = []) {
    setSaving(true);
    try {
      await assertEntryActive(song.id);practice(song.id,'progress',{percent:songProgress(song),trackIndex:song.trackIndex});
      const used=new Set(assetIds(song));
      const [updated] = await saveSongs([song], false, assets.filter(a=>used.has(a.id)));
      const summary = await readSongSummary(updated.id); if (summary) mergeSummaries([summary]);
      setActive(previous => previous?.id === updated.id ? updated : previous);
    } finally { setSaving(false); }
  }
  async function importFiles(files: File[]) {
    if (busy || pendingImport || !files.length) return;
    setBusy(true); setModal('import'); setImportMessages([]);
    const messages: string[] = [], imported: Song[] = [], importedAssets: Asset[] = [], known = new Set(songsRef.current.map(s => s.hash));
    for (const file of files) {
      try {
        if (!ACCEPT.split(',').some(ext => file.name.toLowerCase().endsWith(ext))) throw new Error('Use Guitar Pro, MusicXML or alphaTex. Attach MP3s using + beside the MIDI tab in a song.');
        if (file.size > 30 * 1024 * 1024) throw new Error('Choose a file smaller than 30 MB.');
        let song = migrateSong(await makeSong(new Uint8Array(await file.arrayBuffer()), file.name));
        if (known.has(song.hash)) { messages.push(`${file.name}: already in your library; skipped.`); continue; }
        known.add(song.hash); song.folderId = folders.some(f => f.id === folderId) ? folderId : '';
        if (autoArtwork && featureAccess(account.entitlement).onlineImport) {
          setImportMessages([...messages, `${file.name}: looking for album and artist artwork…`]);
          const found = await findArtwork(song, [...songsRef.current, ...imported]);
          song = found.song; importedAssets.push(...found.assets); messages.push(`${file.name}: ${found.message}`);
        }
        imported.push(song); messages.push(`${file.name}: ready to review · ${song.bars} bars.`);
      } catch (e) { messages.push(`${file.name}: ${e instanceof Error ? e.message : 'Could not read this file.'}`); }
      setImportMessages([...messages]);
    }
    if (imported.length) { setPendingImport({songs:imported,assets:importedAssets}); setModal(null); }
    setBusy(false); if (fileInput.current) fileInput.current.value = '';
  }
  async function importSongsterr(data:SongsterrImportResult) {
    if(!featureAccess(account.entitlement).onlineImport)throw Error('Premium includes online GP import. Manual GP files are free.');
    if(songsRef.current.some(s=>s.songsterr?.songId===data.songId)){notify('This Songsterr song is already in your library.');return;}
    setBusy(true);
    try {
      const score=songsterrScore(data),bytes=new window.alphaTab.exporter.Gp7Exporter().export(score);
      let song=migrateSong(await makeSong(bytes,(data.meta.artist+' - '+data.meta.title).replace(/[<>:"/\\|?*]/g,'_')+'.gp'));
      if(songsRef.current.some(s=>s.hash===song.hash)){notify('This tab is already in your library.');return;}
      song.songsterr={url:data.url,songId:data.songId,revisionId:data.revisionId,importedAt:new Date().toISOString()};
      song.folderId=folders.some(f=>f.id===folderId)?folderId:'';
      song=withRecordings(song,songsterrRecordings(data,song.bars));
      let assets:Asset[]=[];
      if(autoArtwork&&featureAccess(account.entitlement).onlineImport){const found=await findArtwork(song,songsRef.current);song=found.song;assets=found.assets;}
      const [saved]=await saveSongs([song],true,assets);
      setSongs(previous=>[summarizeSong(saved),...previous]);setModal(null);setSelectedId('');setTab('All songs');setGroup('');setQuery('');setFolderId('');setFilters({artist:'',tuning:'',guitar:'',tag:'',difficulty:''});
      notify(data.syncWarning || saved.title+' added to your library.');
    } finally {setBusy(false);}
  }
  async function acceptImport(reviewed: Song[]) {
    if(attachEntry){if(reviewed.length!==1)throw Error('Choose one GP file for this shared song.');reviewed=[{...reviewed[0],id:attachEntry.id,sharedLink:attachEntry.link}];}
    const fresh = reviewed.filter(s => !songsRef.current.some(existing => existing.hash === s.hash));
    if (!fresh.length) { setPendingImport(null); notify('These tabs are already in your library.'); return; }
    const used = new Set(fresh.flatMap(assetIds));
    const saved = await saveSongs(fresh, true, (pendingImport?.assets || []).filter(a => used.has(a.id)));
    if(attachEntry){await completePending(attachEntry.id);setAttachEntry(undefined);}usage('manual_import');
    setSongs(previous => [...saved.map(summarizeSong),...previous]); setPendingImport(null);
    setSelectedId(''); setTab('All songs'); setGroup(''); setQuery(''); setFolderId(''); setFilters({artist:'',tuning:'',guitar:'',tag:'',difficulty:''});
    notify(`${fresh.length} ${fresh.length === 1 ? 'song' : 'songs'} added to your library.`);
  }
  async function exportBackup() {
    setBusy(true); setBackupError('');
    try {
      const json = JSON.stringify(await encodeBackup((await readLibrary()).songs, folders, backupMedia, guitars));
      if (new Blob([json]).size > 250 * 1024 * 1024) throw new Error('This backup exceeds the 250 MB restore limit. Untick “Include MP3s and artwork” to export your tabs, sections and progress without those large attachments.');
      download(`Guitar-io-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
      notify(backupMedia ? 'Backup exported, including recordings, artwork and progress.' : 'Tabs, folders and progress exported. MP3s and artwork were excluded.');
    }
    catch (e) { setBackupError(String(e)); } finally { setBusy(false); }
  }
  async function readBackup(file: File) {
    setBackupError(''); setBackupCandidate(null); setBusy(true);
    try {
      if (file.size > 250 * 1024 * 1024) throw new Error('Choose a backup smaller than 250 MB.');
      setBackupCandidate(await decodeBackup(JSON.parse(await file.text())));
    } catch (e) { setBackupError(e instanceof Error ? e.message : 'Could not read this backup.'); }
    finally { setBusy(false); if (backupInput.current) backupInput.current.value = ''; }
  }
  async function restoreBackup(replace: boolean) {
    if (!backupCandidate) return;
    setBusy(true); setBackupError('');
    try {
      // New attachment IDs protect other songs' files during a merge.
      const assetMap = new Map(backupCandidate.assets.map(a => [a.id, crypto.randomUUID()]));
      const folderMap = new Map(backupCandidate.folders.map(f => [f.id, crypto.randomUUID()]));
      const toSave = backupCandidate.songs.flatMap(s => {
        const same = songsRef.current.find(e => e.id === s.id || e.hash === s.hash);
        if (same && !replace) return [];
        return [withRecordings({ ...s, id: same?.id || s.id, folderId: folderMap.get(s.folderId || '') || '', artworkAssetId: assetMap.get(s.artworkAssetId || ''), collectionArt: Object.fromEntries(Object.entries(s.collectionArt || {}).map(([key, id]) => [key, assetMap.get(id)!])), updatedAt: new Date().toISOString() }, recordingsFor(s).map(r => r.kind === 'audio' ? { ...r, assetId: assetMap.get(r.assetId)! } : r))];
      });
      const mergedFolders = [...folders, ...backupCandidate.folders.map(f => ({ ...f, id: folderMap.get(f.id)! })).filter(f => toSave.some(s => s.folderId === f.id))];
      const mergedGuitars = [...guitars];
      for (const original of backupCandidate.guitars) {
        const incoming = { ...original, artworkAssetId: assetMap.get(original.artworkAssetId || '') };
        const index = mergedGuitars.findIndex(g => g.id === incoming.id || g.name.toLowerCase() === incoming.name.toLowerCase());
        if (index < 0) mergedGuitars.push(incoming);
        else if (replace) mergedGuitars[index] = { ...incoming, id: mergedGuitars[index].id };
      }
      const used = new Set([...toSave.flatMap(assetIds), ...mergedGuitars.flatMap(g => g.artworkAssetId ? [g.artworkAssetId] : [])]);
      const assets = backupCandidate.assets.map(a => ({ ...a, id: assetMap.get(a.id)! })).filter(a => used.has(a.id));
      const restored = await saveSongs(toSave, true, assets, mergedFolders, validateGuitars(mergedGuitars)); setGuitars(mergedGuitars);
      setSongs(previous => [...previous.filter(s => !toSave.some(n => n.id === s.id)), ...restored.map(summarizeSong)]); setFolders(mergedFolders);
      setSelectedId(''); setBackupCandidate(null); notify(`${toSave.length} songs restored.`);
    } catch (e) { setBackupError(e instanceof Error ? e.message : 'Restore failed.'); } finally { setBusy(false); }
  }
  function requestDelete(song: LibrarySong) { setDeleteError(''); setDeletingId(song.id); }
  function guitarDraft(name?: string) {
    const profile = newGuitar(name);
    if (!name) return profile;
    for (const song of songsRef.current.filter(s => s.guitars.includes(name))) {
      const track = song.tracks.find(t => t.index === song.trackIndex);
      try { const pitches = parseTuning(track?.notes || ''); if (pitches.length && !profile.tunings.some(t => t.pitches.join() === pitches.join())) { profile.strings = pitches.length; profile.tunings.push({ name: track?.tuning || song.tuning, pitches }); } } catch {}
      profile.artworkAssetId ||= song.collectionArt?.['Guitars:' + name];
    }
    profile.tunings = profile.tunings.filter(t => t.pitches.length === profile.strings);
    return profile;
  }
  async function saveCollectionArtwork(tab: FilterTab, name: string, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { notify('Choose a JPG, PNG or WebP smaller than 8 MB.', true); return; }
    const asset: Asset = { id: crypto.randomUUID(), kind: 'artwork', name: file.name, mime: file.type, blob: file };
    const changed = songsRef.current.filter(s => (tab === 'Guitars' ? guitarNamesFor(s,guitars) : songValues(s,tab)).includes(name)).map(s => ({ ...s, collectionArt: { ...s.collectionArt, [collectionKey(tab, name)]: asset.id } }));
    const profile = tab === 'Guitars' ? guitars.find(g => g.name === name) || guitarDraft(name) : undefined;
    const profiles = profile ? validateGuitars([...guitars.filter(g => g.id !== profile.id), { ...profile, artworkAssetId: asset.id }]) : undefined;
    setSaving(true);
    try { await saveSongs([], false, [asset], undefined, profiles); const updated = await patchSongs(changed.map(s=>({id:s.id,patch:{collectionArt:s.collectionArt}}))); if (profiles) setGuitars(profiles); mergeSummaries(updated); notify('Collection picture saved.'); }
    catch (e) { notify(String(e), true); } finally { setSaving(false); }
  }
  async function saveGuitar(guitar: GuitarProfile, assets: Asset[] = []) {
    const next = validateGuitars([...guitars.filter(g => g.id !== guitar.id), guitar]);
    const oldName = guitars.find(g => g.id === guitar.id)?.name || guitarEditor?.name || guitar.name;
    const changed = songsRef.current.filter(s => s.guitars.includes(oldName)).map(s => ({ ...s, guitars: [...new Set(s.guitars.map(g => g === oldName ? guitar.name : g))], collectionArt: s.collectionArt?.['Guitars:' + oldName] ? { ...s.collectionArt, ['Guitars:' + guitar.name]: s.collectionArt['Guitars:' + oldName] } : s.collectionArt }));
    await saveSongs([], false, assets, undefined, next); const updated = await patchSongs(changed.map(s=>({id:s.id,patch:{guitars:s.guitars,collectionArt:s.collectionArt}}))); setGuitars(next); 
    mergeSummaries(updated);
    if (tab === 'Guitars' && group === oldName) setGroup(guitar.name);
    if(!songsRef.current.length){setTab('All songs');setGroup('');}
    notify('Guitar saved.');
  }
  function openImport() { setAttachEntry(undefined);if(fileInput.current)fileInput.current.multiple=true;setImportMessages([]); setModal('import'); }
  return <div inert={updatePreparing} className={`app ${dragOver ? 'is-dragging' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('Files') && !(e.target as HTMLElement).closest('.media-panel')) { e.preventDefault(); setDragOver(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }} onDropCapture={() => setDragOver(false)} onDrop={e => { if ((e.target as HTMLElement).closest('.media-panel') || e.dataTransfer.types.includes('application/x-guitario-song')) return; e.preventDefault(); setDragOver(false); void importFiles([...e.dataTransfer.files]); }}>
    <header className="app-header"><div className="brand"><div className="brand-icon"><AudioLines size={25} strokeWidth={1.8} /></div><span>guitar<span className="brand-dot">.</span>io</span></div><div className="header-actions"><button className="learn-link" aria-label="Learn" onClick={openLearn}>Learn (beta)</button>{saving && <LoaderCircle className="spin" size={14} aria-label="Saving"/>}<button className="icon-button" aria-label="Account and plans" onClick={()=>setModal('account')}><UsersRound size={18}/></button><UpdateReadyButton updates={updates} onClick={()=>setModal('updates')}/><button className="icon-button" aria-label="Device sync" title="Sync your devices over Wi-Fi or LAN" onClick={()=>setModal('sync')}><Wifi size={18}/></button><button className="icon-button" aria-label="Help" onClick={() => setModal('help')}><HelpCircle size={18} /></button></div></header>
    {!active && <><nav className="library-tabs" aria-label="Library filters">{navItems.map(({ label, icon: Icon }) => <button key={label} className={tab === label ? 'active' : ''} aria-pressed={tab === label} onClick={() => { setTab(label); setGroup(''); }}><Icon size={16} />{label}</button>)}</nav></>}
    {booting ? <div className="main-empty"><LoaderCircle size={32} className="spin" /><h2>Setting the stage…</h2></div> : fatal ? <div className="main-empty"><AlertCircle size={32} /><h2>Couldn’t open the library</h2><p>{fatal}</p><button className="button secondary" onClick={() => location.reload()}>Try again</button></div> : loadingSong ? <div className="main-empty"><LoaderCircle className="spin"/><p>Opening song…</p></div> : active ? <ScoreWorkspace key={`workspace:${active.id}`} song={active} onPlayed={bar=>recordPlay(active.id,bar)} onSave={saveSong} onEdit={() => setEditingId(active.id)} onBack={() => setSelectedId('')} notify={notify} /> : <LibraryHome onDifficulty={async (id,difficulty)=>{const song=songsRef.current.find(s=>s.id===id);if(!song)return;try{mergeSummaries(await patchSongs([{id,patch:{difficulty}}]));}catch(e){notify(e instanceof Error?e.message:"Could not save difficulty.",true);}}} onBackups={() => setModal('backups')} onMoveSong={async (id, folderId) => { const song = songsRef.current.find(s => s.id === id); if (!song || (folderId && !folders.some(f => f.id === folderId))) return; try { mergeSummaries(await patchSongs([{id,patch:{folderId}}])); notify(`Moved ${song.title} to ${folders.find(f => f.id === folderId)?.name || 'Unfiled'}.`); } catch { notify('Could not move the song. Try again.', true); } }} guitars={guitars} onGuitar={(name,addTuning=false) => {setAddGuitarTuning(addTuning);setGuitarEditor(guitars.find(g => g.name === name) || guitarDraft(name));}} tab={tab} group={group} setGroup={setGroup} filters={filters} setFilters={setFilters} onArtwork={saveCollectionArtwork} songs={librarySongs} filtered={filtered} folders={folders} folderId={folderId} setFolderId={setFolderId} query={query} setQuery={setQuery} sort={sort} setSort={setSort} onOpen={s => setSelectedId(s.id)} onEdit={s => setEditingId(s.id)} onDelete={requestDelete} onImport={openImport} onFolder={f => setFolderEditor(f || 'new')} clearFilters={() => { setFilters({ artist: '', tuning: '', guitar: '', tag: '', difficulty: '' }); setQuery(''); setGroup(''); setTab('All songs'); setFolderId(''); }} />}
    <input ref={fileInput} id="import-files" className="hidden" type="file" accept={ACCEPT} multiple onChange={e => importFiles([...e.target.files || []])} />
    {cloudStatus&&modal==='sync'&&<p className="cloud-status" role="status">{cloudStatus}</p>}
    {modal==='feedback'&&<Feedback onClose={()=>setModal(null)}/>}
    {modal==='account'&&<AccountPlans cloud={cloudEngine} onClose={()=>setModal(null)}/>}
    <PairingRequest engine={syncEngine}/>{modal==='sync'&&<DeviceSync engine={syncEngine} onClose={()=>setModal(null)}/>}
    <input ref={backupInput} id="restore-file" className="hidden" type="file" accept=".json" onChange={e => { if (e.target.files?.[0]) void readBackup(e.target.files[0]); }} />
    {dragOver && <div className="drop-overlay"><Upload size={42} /><h2>Drop it. Learn it.</h2><p>Import into your library.</p></div>}
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle size={17} /> : <Check size={17} />}<span>{toast.text}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
    {modal === 'import' && <Modal title="Add songs" onClose={() => { if (!busy) setModal(null); }}><div className="import-drop"><Upload className="upload-symbol" size={28}/><h3>Drop tabs here</h3><button className="button primary" disabled={busy} onClick={() => fileInput.current?.click()}><FolderOpen size={16}/>{busy ? 'Reading…' : 'Choose files'}</button><div className="import-file-hints"><span>30 MB max per file</span><span className="format-info" tabIndex={0} role="note" aria-label="Compatible formats: Guitar Pro GP, GPX, GP3–8; MusicXML, MXL; alphaTex. PDF and images are not supported."><Info size={15}/><span className="format-tooltip" role="tooltip">Guitar Pro · GP / GPX / GP3–8<br/>MusicXML · XML / MXL<br/>alphaTex · ATEX / TEX</span></span></div></div><ShareSongs onAttach={entry=>{setAttachEntry(entry);if(fileInput.current){fileInput.current.multiple=false;fileInput.current.click();}}}/><details className="import-options"><summary aria-label="Import options"><Settings2 size={14}/></summary><label><input type="checkbox" checked={autoArtwork} disabled={busy} onChange={e=>{setAutoArtwork(e.target.checked);window.localStorage.setItem('guitario-auto-artwork',e.target.checked?'on':'off');}}/>Automatic artwork</label></details>{importMessages.length>0 && <div className="import-results" aria-live="polite">{importMessages.map((m,i)=><p key={i}>{m}</p>)}</div>}</Modal>}

    {pendingImport && <ImportReview guitars={guitars} songs={pendingImport.songs} assets={pendingImport.assets} library={songs} folders={folders} guitarNames={[...new Set([...guitars.map(g=>g.name),...songs.flatMap(s=>songValues(s,'Guitars'))])].sort()} onSave={async (reviewed,assets)=>{if(pendingImport) pendingImport.assets.push(...assets); await acceptImport(reviewed);}} onClose={() => setPendingImport(null)} />}
    {editing && <MetadataEditor automaticGuitars={editing ? automaticGuitars(editing,guitars) : []} key={`metadata:${editing.id}`} song={editing} folders={folders} guitarNames={[...new Set([...guitars.map(g => g.name), ...songs.flatMap(s => s.guitars)])]} tuningLabels={[...songs.map(s => s.tuning), ...guitars.flatMap(g => g.tunings.map(t => t.name))]} onSave={saveSong} onClose={() => setEditingId('')} />}
    {deleting && <Modal title="Delete this song?" subtitle={deleting.title} onClose={() => { if (!busy) setDeletingId(''); }}><p className="import-explainer">This removes the imported tab, saved sections, progress and attached files from Guitar.io. Your original files outside the app stay where they are.</p>{deleteError && <p className="form-error" role="alert">{deleteError}</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setDeletingId('')}>Keep song</button><button className="button danger-button" disabled={busy} onClick={async () => { setBusy(true); try { await removeSong(deleting.id); setSongs(s => s.filter(x => x.id !== deleting.id)); if (selectedId === deleting.id) setSelectedId(''); setDeletingId(''); notify('Song deleted from Guitar.io.'); } catch (e) { setDeleteError(String(e)); } finally { setBusy(false); } }}><Trash2 size={15} />Delete song</button></div></Modal>}
    {guitarEditor && <GuitarEditor key={guitarEditor.id} guitar={guitarEditor} addTuning={addGuitarTuning} onClose={() => setGuitarEditor(null)} onSave={saveGuitar} onDelete={guitars.some(g=>g.id===guitarEditor.id)||songs.some(s=>s.guitars.includes(guitarEditor.name))?async()=>{setSaving(true);try{await removeGuitar(guitarEditor.id,guitarEditor.name);const data=await readLibraryIndex();setSongs(data.songs);setGuitars(data.guitars);if(tab==='Guitars'&&group===guitarEditor.name)setGroup('');setFilters(f=>f.guitar===guitarEditor.name?{...f,guitar:''}:f);notify('Guitar deleted. Your songs are still in the library.');}finally{setSaving(false);}}:undefined} />}
    {folderEditor && <FolderEditor key={`folder-editor:${typeof folderEditor === 'string' ? 'new' : folderEditor.id}`} folder={folderEditor === 'new' ? undefined : folderEditor} onClose={() => setFolderEditor(null)} onSave={async f => { const next = [...folders.filter(x => x.id !== f.id), f]; await saveSongs([], false, [], next); setFolders(next); }} onDelete={async id => { const next = folders.filter(f => f.id !== id), changed = songsRef.current.filter(s => s.folderId === id).map(s => ({ ...s, folderId: '' })); await patchSongs(changed.map(s=>({id:s.id,patch:{folderId:''}}))); await saveSongs([], false, [], next); setFolders(next); setSongs(s => s.map(x => x.folderId === id ? { ...x, folderId: '' } : x)); if (folderId === id) setFolderId(''); }} />}
    {modal === 'backups' && <Modal title="Keep your collection safe." subtitle="Songs, sections, progress, folders and attached files." onClose={() => { if (!busy) { setModal(null); setBackupCandidate(null); setBackupError(''); } }}><div className="backup-row"><Download size={23} /><div><h3>Export your library</h3><p>All {songs.length} songs, sections, folders and progress.</p></div><button className="button primary" onClick={exportBackup} disabled={busy}>Export</button></div><div className="backup-row"><Upload size={23} /><div><h3>Restore a backup</h3><p>Supports earlier Guitar.io backups.</p></div><button className="button secondary" disabled={busy} onClick={() => backupInput.current?.click()}>{busy ? 'Working…' : 'Choose file'}</button></div><label className="backup-media"><input type="checkbox" aria-label="Include MP3s and artwork" checked={backupMedia} onChange={e => setBackupMedia(e.target.checked)} /> Include MP3s and artwork</label>{backupCandidate && <div className="backup-preview"><h3>{backupCandidate.songs.length} songs in this backup</h3><p>{backupCandidate.songs.filter(s => songs.some(e => e.id === s.id || e.hash === s.hash)).length} match existing songs. Replace matches only if you want their saved details and progress from this backup.</p><button className="button primary" disabled={busy} onClick={() => restoreBackup(false)}>Add new songs only</button><button className="button secondary" disabled={busy} onClick={() => restoreBackup(true)}>Restore & replace matches</button></div>}{backupError && <p className="form-error" role="alert">{backupError}</p>}<p className="import-explainer">Maximum backup import: 250 MB. Export before moving computers or removing app data. Browser previews and the Windows app have separate collections.</p></Modal>}
    {modal==='updates'&&<UpdateSettings updates={updates} onClose={()=>setModal(null)}/>}
    {modal === 'help' && <Modal title="Guitar.io help" subtitle={<button className="help-version" title="Updates" aria-label="Version and updates" onClick={()=>setModal('updates')}>Version {updates.state?.currentVersion || '1.6.0'}</button>} onClose={() => setModal(null)}><button className="button secondary help-backups" onClick={()=>setModal('backups')}><Download size={16}/>Backups</button><button className="button secondary" onClick={()=>setModal('feedback')}>Feedback & ideas</button><div className="help-steps"><div><span>01</span><p><strong>Add a guitar.</strong> Set its tuning.</p></div><div><span>02</span><p><strong>Add a song.</strong> Import a Guitar Pro file, then open it to practise.</p></div></div></Modal>}
  </div>;
}

