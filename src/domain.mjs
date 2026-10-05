/** Pure domain helpers, shared by UI and Node tests. Bars are always 1-based and inclusive. */
export function validateRange(start, end, total) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return 'Choose whole bar numbers.';
  if (start < 1 || end > total) return `Bars must be between 1 and ${total}.`;
  if (end < start) return 'The end bar must be at or after the start bar.';
  return '';
}

export function sectionError(candidate, sections, total) {
  if (candidate.speed !== undefined && (!Number.isFinite(candidate.speed) || candidate.speed<.25 || candidate.speed>1)) return 'Section speed must be between 25% and 100%.';
  if (!candidate.name?.trim()) return 'Give this section a name.';
  const rangeError = validateRange(candidate.start, candidate.end, total);
  if (rangeError) return rangeError;
  const overlap = sections.find(s => s.id !== candidate.id && candidate.start <= s.end && candidate.end >= s.start);
  return overlap ? `This overlaps “${overlap.name}” (bars ${overlap.start}–${overlap.end}). Edit that section or choose another range.` : '';
}

export function normaliseRange(a, b, total) {
  const clamp = n => Math.max(1, Math.min(total, Math.round(n)));
  return { start: clamp(Math.min(a, b)), end: clamp(Math.max(a, b)) };
}

export function parseTags(text) {
  return [...new Map(text.split(',').map(t => t.trim()).filter(Boolean).map(t => [t.toLowerCase(), t])).values()];
}

export function songValues(song, tab) {
  if (tab === 'Artists') return [song.artist || 'Unknown artist'];
  if (tab === 'Tunings') return song.tuningBuckets?.length ? song.tuningBuckets : [song.tuning || 'Unspecified'];
  if (tab === 'Guitars') return song.guitars.filter(name => name.trim() && name.toLowerCase() !== 'unassigned');
  if (tab === 'Vibes & tags') return song.tags.length ? song.tags : ['Untagged'];
  return [];
}

export function filterSongs(songs, query, tab, group) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return songs.filter(song => {
    const haystack = [song.title, song.artist, song.album || '', song.tuning, ...song.guitars, ...song.tags].join(' ').toLocaleLowerCase();
    return words.every(word => haystack.includes(word)) && (!group || songValues(song, tab).includes(group));
  });
}

export function coverage(sections, total) {
  if (!total) return 0;
  const covered = new Set();
  for (const s of sections) for (let b = s.start; b <= s.end; b++) covered.add(b);
  return Math.round(covered.size / total * 100);
}

/** Choose a complete contiguous pass, rather than truncating at an earlier repeat jump. */
export function playbackTicks(masterBars, startBar, endBar) {
  if (!Number.isInteger(startBar) || !Number.isInteger(endBar) || startBar < 1 || endBar < startBar) return null;
  for (let index = 0; index < masterBars.length; index++) {
    if (masterBars[index].masterBar.index !== startBar - 1) continue;
    const seen = new Set();
    let endTick = masterBars[index].end;
    for (let i = index; i < masterBars.length; i++) {
      const n = masterBars[i].masterBar.index + 1;
      if (n < startBar || n > endBar) break;
      seen.add(n); endTick = masterBars[i].end;
    }
    if (seen.size === endBar - startBar + 1) return { startTick: masterBars[index].start, endTick };
  }
  return null;
}

export function validateBackup(value) {
  if (!value || value.app !== 'guitar.io' || ![1, 2].includes(value.version) || !Array.isArray(value.songs)) throw new Error('This is not a supported Guitar.io backup.');
  if (value.songs.length > 2000) throw new Error('Backup is too large (maximum 2,000 songs).');
  const ids = new Set();
  for (const song of value.songs) {
    for (const field of ['id', 'title', 'artist', 'tuning', 'fileName', 'format', 'hash', 'createdAt', 'updatedAt', 'sourceBase64']) {
      if (typeof song[field] !== 'string') throw new Error(`Invalid backup field: ${field}.`);
    }
    if (ids.has(song.id)) throw new Error('The backup contains duplicate song IDs.');
    ids.add(song.id);
    if (!Array.isArray(song.guitars) || !song.guitars.every(v => typeof v === 'string') || !Array.isArray(song.tags) || !song.tags.every(v => typeof v === 'string')) throw new Error('Invalid guitar or tag list.');
    if (!Array.isArray(song.tracks) || !Array.isArray(song.sections) || !Number.isInteger(song.bars) || song.bars < 1 || song.bars > 100000) throw new Error('Invalid song structure.');
    if (song.sourceBase64.length > 42 * 1024 * 1024) throw new Error('A file in this backup exceeds the 30 MB limit.');
    const sectionLists = [song.sections];
    if (song.sectionsByTrack !== undefined) {
      if (!song.sectionsByTrack || typeof song.sectionsByTrack !== 'object' || Array.isArray(song.sectionsByTrack)) throw new Error('Invalid instrument sections.');
      for (const [key, list] of Object.entries(song.sectionsByTrack)) {
        if (!/^\d+$/.test(key) || !Array.isArray(list)) throw new Error('Invalid instrument sections.');
        sectionLists.push(list);
      }
    }
    for (const list of sectionLists) {
      const sectionIds = new Set();
      for (const s of list) {
      if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.notes !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.color) || !['new', 'learning', 'comfortable', 'mastered'].includes(s.status)) throw new Error('Invalid section in backup.');
      if (sectionIds.has(s.id)) throw new Error('Duplicate section ID in backup.');
      sectionIds.add(s.id);
      if (s.learnedPercent !== undefined && (!Number.isFinite(s.learnedPercent) || s.learnedPercent < 0 || s.learnedPercent > 100)) throw new Error('Invalid learning percentage.');
      if (s.instructionalTimestamps !== undefined && (!s.instructionalTimestamps || typeof s.instructionalTimestamps !== 'object' || Array.isArray(s.instructionalTimestamps) || Object.keys(s.instructionalTimestamps).length > 200 || Object.entries(s.instructionalTimestamps).some(([id,time]) => !id || id.length > 200 || !Number.isInteger(time) || time < 0 || time > 604800))) throw new Error('Invalid instructional timestamp.');
      const error = sectionError(s, list, song.bars);
      if (error) throw new Error(error);
      }
    }
    for (const key of ['lastOpenedAt','lastPlayedAt']) if(song[key]!==undefined && (typeof song[key]!=='string' || !Number.isFinite(Date.parse(song[key])))) throw new Error('Invalid playback timestamp.');
    if(song.lastPlayedBar!==undefined && (!Number.isInteger(song.lastPlayedBar) || song.lastPlayedBar<1 || song.lastPlayedBar>song.bars)) throw new Error('Invalid playback bar.');
    if(song.fieldUpdatedAt!==undefined && (!song.fieldUpdatedAt || typeof song.fieldUpdatedAt!=='object' || Array.isArray(song.fieldUpdatedAt) || Object.entries(song.fieldUpdatedAt).some(([key,time])=>key.length>200 || typeof time!=='string' || !Number.isFinite(Date.parse(time))))) throw new Error('Invalid change timestamps.');
    if (song.folderId !== undefined && typeof song.folderId !== 'string') throw new Error('Invalid folder.');
    if (song.artworkAssetId !== undefined && typeof song.artworkAssetId !== 'string') throw new Error('Invalid artwork.');
    if (song.album !== undefined && typeof song.album !== 'string') throw new Error('Invalid album.');
    if (song.difficulty !== undefined && (!Number.isInteger(song.difficulty) || song.difficulty < 1 || song.difficulty > 5)) throw new Error('Difficulty must be 1–5 stars.');
    const record = value => value && typeof value === 'object' && !Array.isArray(value);
    if (song.noteEdits !== undefined) {
      if (!record(song.noteEdits) || Object.keys(song.noteEdits).length > 250000) throw new Error('Invalid note edits.');
      for (const [key, edit] of Object.entries(song.noteEdits)) {
        if (!/^\d{1,6}(:\d{1,6}){5}$/.test(key) || !record(edit)) throw new Error('Invalid note edit address.');
        if ('fret' in edit) { if (!Number.isInteger(edit.fret) || edit.fret < -1000 || edit.fret > 1000 || !Number.isInteger(edit.string) || edit.string < 1 || edit.string > 16) throw new Error('Invalid fret edit.'); }
        else if (!Number.isInteger(edit.octave) || !Number.isInteger(edit.tone) || edit.tone < 0 || edit.tone > 11 || edit.octave < -80 || edit.octave > 80) throw new Error('Invalid pitch edit.');
      }
    }
    if(song.tempoEdits!==undefined){if(!record(song.tempoEdits) || Object.keys(song.tempoEdits).length>song.bars)throw new Error('Invalid tempo edits.');for(const [key,bpm] of Object.entries(song.tempoEdits))if(!/^[1-9]\d*$/.test(key) || Number(key)>song.bars || !Number.isFinite(bpm) || bpm<20 || bpm>400)throw new Error('Invalid tempo edit.');}
    if (song.tuningEdits !== undefined) {
      if (!record(song.tuningEdits) || Object.keys(song.tuningEdits).length > 1000) throw new Error('Invalid tuning edits.');
      for (const [key, tuning] of Object.entries(song.tuningEdits)) if (!/^\d{1,6}:\d{1,6}$/.test(key) || !Array.isArray(tuning) || !tuning.length || tuning.length > 16 || !tuning.every(n => Number.isInteger(n) && n >= 0 && n <= 127)) throw new Error('Invalid tuning edit.');
    }
    if (song.sourceTunings !== undefined) {
      if (!record(song.sourceTunings) || Object.keys(song.sourceTunings).length > 1000) throw new Error('Invalid corrected tunings.');
      for (const [key, tuning] of Object.entries(song.sourceTunings)) if (!/^\d{1,6}:\d{1,6}$/.test(key) || !Array.isArray(tuning) || !tuning.length || tuning.length > 16 || !tuning.every(n => Number.isInteger(n) && n >= 0 && n <= 127)) throw new Error('Invalid corrected tuning.');
    }
    if(song.tuningCompensation!==undefined){
      if(!record(song.tuningCompensation) || Object.keys(song.tuningCompensation).length>1000) throw new Error('Invalid tuning compensation.');
      for(const [key,offsets] of Object.entries(song.tuningCompensation)) if(!/^\d{1,6}:\d{1,6}$/.test(key) || !Array.isArray(offsets) || !offsets.length || offsets.length>16 || !offsets.every(n=>Number.isInteger(n)&&Math.abs(n)<=1000)) throw new Error('Invalid tuning compensation.');
    }
    if(song.tuningNoteCompensation!==undefined){
      if(!record(song.tuningNoteCompensation) || Object.keys(song.tuningNoteCompensation).length>250000)throw new Error('Invalid note tuning offsets.');
      for(const [key,delta] of Object.entries(song.tuningNoteCompensation)) if(!/^\d{1,6}(:\d{1,6}){5}$/.test(key) || !record(delta) || !Number.isInteger(delta.fret) || Math.abs(delta.fret)>1000 || !Number.isInteger(delta.string) || Math.abs(delta.string)>16)throw new Error('Invalid note tuning offsets.');
    }
    if (song.annotations !== undefined) {
      if (!Array.isArray(song.annotations) || song.annotations.length > 10000) throw new Error('Invalid annotations.');
      const annotationIds = new Set();
      for (const a of song.annotations) {
        if (!a || typeof a.id !== 'string' || !/^annotation:[\w-]{1,80}$/.test(a.id) || annotationIds.has(a.id) || !Number.isInteger(a.track) || a.track < 0 || !Number.isInteger(a.bar) || a.bar < 1 || a.bar > song.bars || typeof a.text !== 'string' || a.text.length > 4000 || !/^#[\da-f]{6}$/i.test(a.color) || (a.noteKey !== undefined && !/^\d{1,6}(:\d{1,6}){5}$/.test(a.noteKey))) throw new Error('Invalid annotation.');
        if(a.free !== undefined && typeof a.free !== 'boolean') throw new Error('Invalid free annotation.');
        annotationIds.add(a.id);
      }
    }
    if (song.annotationPositions !== undefined) {
      if (!record(song.annotationPositions) || Object.keys(song.annotationPositions).length > 20000) throw new Error('Invalid annotation positions.');
      for (const [key, p] of Object.entries(song.annotationPositions)) if (key.length > 200 || !record(p) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000) throw new Error('Invalid annotation position.');
    }
    if (song.artworkSource !== undefined && (typeof song.artworkSource !== 'string' || song.artworkSource.length>2000 || !/^https:\/\/(musicbrainz\.org|en\.wikipedia\.org|music\.apple\.com|itunes\.apple\.com)\//.test(song.artworkSource))) throw new Error('Invalid artwork source.');
    if (song.collectionArt !== undefined && (!song.collectionArt || typeof song.collectionArt !== 'object' || Array.isArray(song.collectionArt) || Object.values(song.collectionArt).some(v => typeof v !== 'string'))) throw new Error('Invalid collection artwork.');
    if(song.spliceEdits!==undefined){
      if(!record(song.spliceEdits) || Object.keys(song.spliceEdits).length>200)throw new Error('Invalid splice list.');
      let total=0;
      for(const [id,t] of Object.entries(song.spliceEdits)){if(!/^[\w-]{1,100}$/.test(id) || !record(t) || !Number.isInteger(t.track) || t.track<0 || !Number.isInteger(t.staff) || t.staff<0 || !Number.isInteger(t.start) || !Number.isInteger(t.end) || t.start<1 || t.end<t.start || t.end>song.bars || typeof t.dataBase64!=='string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(t.dataBase64) || typeof t.createdAt!=='string' || !Number.isFinite(Date.parse(t.createdAt)))throw new Error('Invalid saved splice.');total+=t.dataBase64.length;}
      if(total>40*1024*1024)throw new Error('Saved splices exceed the 30 MB limit.');
    }
    if(song.spliceUndo!==undefined){const u=song.spliceUndo;if(!record(u) || !song.spliceEdits?.[u.editId] || !record(u.noteEdits) || !record(u.tuningNoteCompensation) || !Array.isArray(u.annotations))throw new Error('Invalid splice undo.');}
    if(song.songsterr!==undefined){const t=song.songsterr;if(!record(t) || typeof t.url!=='string' || !/^https:\/\/(www\.)?songsterr\.com\//.test(t.url) || !Number.isSafeInteger(t.songId) || t.songId<=0 || !Number.isSafeInteger(t.revisionId) || t.revisionId<=0 || typeof t.importedAt!=='string' || !Number.isFinite(Date.parse(t.importedAt)))throw new Error('Invalid Songsterr source.');}
    if (song.media !== undefined) {
      if (!song.media || typeof song.media !== 'object') throw new Error('Invalid media.');
      if (song.media.recordings !== undefined) {
        if (!Array.isArray(song.media.recordings) || song.media.recordings.length > 200) throw new Error('Invalid recording list.');
        const recordingIds = new Set();
        for (const r of song.media.recordings) {
          if (!r || typeof r.id !== 'string' || recordingIds.has(r.id) || typeof r.label !== 'string' || !r.label.trim() || !Array.isArray(r.tags) || !r.tags.every(t => typeof t === 'string')) throw new Error('Invalid recording details.');
          recordingIds.add(r.id);
          if(r.onlineTempo!==undefined){const t=r.onlineTempo;if(!record(t) || r.purpose==='instructional' || !Number.isFinite(t.bpm) || t.bpm<20 || t.bpm>400 || !/^[0-9a-f-]{36}$/i.test(t.recordingId || '') || t.source!=='AcousticBrainz' || typeof t.enabled!=='boolean' || typeof t.fetchedAt!=='string' || !Number.isFinite(Date.parse(t.fetchedAt)))throw new Error('Invalid online recording tempo.');}
          if(r.youtubeSync!==undefined){
            const t=r.youtubeSync;
            if(!record(t) || r.kind!=='youtube' || r.purpose==='instructional' || t.videoId!==r.videoId || !['Songsterr','manual'].includes(t.source) || typeof t.enabled!=='boolean' || !Array.isArray(t.points) || t.points.length>20000 || t.songId!==undefined && (!Number.isSafeInteger(t.songId) || t.songId<=0) || t.revisionId!==undefined && (!Number.isSafeInteger(t.revisionId) || t.revisionId<=0) || t.fetchedAt!==undefined && (typeof t.fetchedAt!=='string' || !Number.isFinite(Date.parse(t.fetchedAt))))throw new Error('Invalid YouTube sync data.');
            for(let i=0;i<t.points.length;i++){const p=t.points[i],previous=t.points[i-1];if(!record(p) || !Number.isInteger(p.bar) || p.bar<1 || p.bar>song.bars || !Number.isFinite(p.seconds) || p.seconds< -3600 || p.seconds>604800 || p.occurrence!==undefined && (!Number.isInteger(p.occurrence) || p.occurrence<0 || p.occurrence>99) || previous && p.seconds<=previous.seconds)throw new Error('Invalid YouTube bar timestamp.');}
          }
          if(r.tempo!==undefined){const t=r.tempo;if(!t || r.purpose==='instructional' || !Number.isFinite(t.bpm) || t.bpm<30 || t.bpm>300 || !Number.isFinite(t.referenceBpm) || t.referenceBpm<=0 || t.referenceBpm>1000 || !['audio','tap','manual'].includes(t.method) || t.confidence!==undefined && (!Number.isFinite(t.confidence) || t.confidence<0 || t.confidence>1) || t.analyzedAt!==undefined && (typeof t.analyzedAt!=='string' || !Number.isFinite(Date.parse(t.analyzedAt))))throw new Error('Invalid recording tempo.');}
          if(r.syncAnchors!==undefined) {
            if(!Array.isArray(r.syncAnchors) || r.syncAnchors.length>200 || r.purpose==='instructional') throw new Error('Invalid recording timing.');
            for(let i=0;i<r.syncAnchors.length;i++){const p=r.syncAnchors[i],prev=r.syncAnchors[i-1];if(!p || !Number.isFinite(p.scoreSeconds) || !Number.isFinite(p.mediaSeconds) || p.scoreSeconds<0 || p.mediaSeconds<0 || p.scoreSeconds>604800 || p.mediaSeconds>604800 || prev && (p.scoreSeconds<=prev.scoreSeconds || p.mediaSeconds<=prev.mediaSeconds)) throw new Error('Invalid recording timing.');}
          }
          if (r.purpose !== undefined && (!['full','backing','instructional'].includes(r.purpose) || (r.purpose === 'instructional' && r.kind !== 'youtube'))) throw new Error('Instructional videos must be YouTube links.');
          if (!Number.isFinite(r.offsetSeconds) || r.offsetSeconds < -3600 || r.offsetSeconds > 86400) throw new Error('Invalid recording offset.');
          if (r.kind === 'audio') { if (typeof r.assetId !== 'string' || typeof r.name !== 'string') throw new Error('Invalid recording asset.'); }
          else if (r.kind === 'youtube') { if (typeof r.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(r.videoId)) throw new Error('Invalid recording video.'); }
          else throw new Error('Invalid recording kind.');
        }
      }
      for (const key of ['audio', 'youtube']) {
        const media = song.media[key];
        if (!media) continue;
        if (!Number.isFinite(media.offsetSeconds) || media.offsetSeconds < -3600 || media.offsetSeconds > 86400) throw new Error('Invalid media offset.');
        if (key === 'audio' && (typeof media.assetId !== 'string' || typeof media.name !== 'string')) throw new Error('Invalid audio attachment.');
        if (key === 'youtube' && (typeof media.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(media.videoId))) throw new Error('Invalid YouTube link.');
      }
    }
    const instructionalIds = new Set((song.media?.recordings || []).filter(r => r.kind === 'youtube' && r.purpose === 'instructional').map(r => r.id));
    for (const list of sectionLists) for (const s of list) for (const id of Object.keys(s.instructionalTimestamps || {})) if (!instructionalIds.has(id)) throw new Error('An instructional timestamp references a missing video.');
  }
  if (value.version === 2) {
    if (!Array.isArray(value.assets) || !Array.isArray(value.folders)) throw new Error('Missing backup assets or folders.');
    const assetIds = new Set();
    for (const a of value.assets) {
      if (!a || typeof a.id !== 'string' || assetIds.has(a.id) || !['artwork', 'audio'].includes(a.kind) || typeof a.name !== 'string' || typeof a.mime !== 'string' || typeof a.dataBase64 !== 'string') throw new Error('Invalid backup asset.');
      if (a.dataBase64.length > 140 * 1024 * 1024) throw new Error('A media attachment is too large.');
      if (a.kind === 'artwork' && !['image/png', 'image/jpeg', 'image/webp'].includes(a.mime)) throw new Error('Unsupported artwork format.');
      if (a.kind === 'audio' && !['audio/mpeg', 'audio/mp3'].includes(a.mime)) throw new Error('Unsupported audio format.');
      assetIds.add(a.id);
    }
    const folderIds = new Set();
    for (const f of value.folders) {
      if (!f || typeof f.id !== 'string' || folderIds.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || !/^#[0-9a-f]{6}$/i.test(f.color)) throw new Error('Invalid backup folder.');
      folderIds.add(f.id);
    }
    for (const song of value.songs) {
      for (const id of Object.values(song.collectionArt || {})) if (value.assets.find(a => a.id === id)?.kind !== 'artwork') throw new Error('A collection artwork attachment is missing.');
      for (const r of song.media?.recordings || []) if (r.kind === 'audio' && value.assets.find(a => a.id === r.assetId)?.kind !== 'audio') throw new Error('A recording attachment is missing.');
      for (const id of [song.artworkAssetId, song.media?.audio?.assetId].filter(Boolean)) if (!assetIds.has(id)) throw new Error('A referenced media attachment is missing from this backup.');
      if (song.artworkAssetId && value.assets.find(a => a.id === song.artworkAssetId)?.kind !== 'artwork') throw new Error('Invalid artwork attachment.');
      if (song.media?.audio && value.assets.find(a => a.id === song.media.audio.assetId)?.kind !== 'audio') throw new Error('Invalid audio attachment.');
      if (song.folderId && !folderIds.has(song.folderId)) throw new Error('A referenced folder is missing from this backup.');
    }
  }
  return value;
}
