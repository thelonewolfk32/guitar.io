import type { model } from '@coderline/alphatab';
import type { NoteEdit, Song } from './types';
import { readScore, scoreMetadata } from './notation';
import { sectionsFor } from './library-model';
import { tuningPresets } from './tunings';
import {applySplices} from './splicing';

export function noteKey(note: model.Note): string {
  const b = note.beat, v = b.voice, bar = v.bar, staff = bar.staff;
  return [staff.track.index, staff.index, bar.index, v.index, b.index, note.index].join(':');
}
export function allNotes(score: model.Score): model.Note[] {
  return score.tracks.flatMap(t => t.staves.flatMap(s => s.bars.flatMap(b => b.voices.flatMap(v => v.beats.flatMap(b => b.notes)))));
}
export function noteLabel(note: model.Note) {
  return `Bar ${note.beat.voice.bar.index + 1}, beat ${note.beat.index + 1}, ${note.isStringed ? `string ${note.beat.voice.bar.staff.tuning.length - note.string + 1}, fret ${note.fret}` : pitchName(note.realValue)}`;
}
export function pitchName(pitch: number) { return window.alphaTab.model.Tuning.getTextForTuning(pitch, true); }
export function noteFromKey(score: model.Score, key: string): model.Note | undefined {
  const [t, s, b, v, beat, n] = key.split(':').map(Number);
  return score.tracks[t]?.staves[s]?.bars[b]?.voices[v]?.beats[beat]?.notes[n];
}

export function readBaseScore(song: Song): model.Score {
  const score = applySplices(readScore(song.source, song.fileName),song.spliceEdits);
  for (const [key, tuning] of Object.entries(song.sourceTunings || {})) {
    const [t, s] = key.split(':').map(Number), staff = score.tracks[t]?.staves[s];
    if (!staff || tuning.length !== staff.tuning.length || !tuning.every(n => Number.isInteger(n) && n >= 0 && n <= 127)) throw new Error('A corrected tuning does not match this instrument.');
    staff.stringTuning.tunings = [...tuning];
  }
  return score;
}
export function readWorkingScore(song: Song): model.Score {
  const score = readBaseScore(song);
  for(const [key,bpm] of Object.entries(song.tempoEdits || {})){
    const bar=Number(key);
    if(!/^[1-9]\d*$/.test(key) || !Number.isInteger(bar) || bar>score.masterBars.length || !Number.isFinite(bpm) || bpm<20 || bpm>400)throw new Error('Tempo changes need a valid bar and a BPM between 20 and 400.');
    score.masterBars[bar-1].tempoAutomations=[window.alphaTab.model.Automation.buildTempoAutomation(false,0,bpm,2)];
  }
  for(const [key,offsets] of Object.entries(song.tuningCompensation || {})) {
    const [t,s]=key.split(':').map(Number),staff=score.tracks[t]?.staves[s];
    if(!staff || !song.tuningEdits?.[key] || offsets.length!==song.tuningEdits[key].length || !offsets.every(n=>Number.isInteger(n)&&Math.abs(n)<=1000)) throw new Error('Saved tuning offsets do not match this instrument.');
  }
  for(const [key,delta] of Object.entries(song.tuningNoteCompensation || {})){
    const note=noteFromKey(score,key),staff=note?.beat.voice.bar.staff;
    if(!note?.isStringed || !staff || !song.tuningEdits?.[`${staff.track.index}:${staff.index}`] || !Number.isInteger(delta.fret) || Math.abs(delta.fret)>1000 || !Number.isInteger(delta.string) || Math.abs(delta.string)>16)throw new Error('Saved note tuning offsets do not match this score.');
  }
  const baseCounts=new Map(score.tracks.flatMap(t=>t.staves.map(st=>[`${t.index}:${st.index}`,st.tuning.length] as const)));
  const touched = new Set<model.Beat>();
  for (const [key, tuning] of Object.entries(song.tuningEdits || {})) {
    const [t, s] = key.split(':').map(Number), staff = score.tracks[t]?.staves[s];
    if (!staff || tuning.length < 1 || tuning.length > 16 || !tuning.every(n => Number.isInteger(n) && n >= 0 && n <= 127)) throw new Error('A saved tuning does not match this instrument.');
    staff.stringTuning.tunings = [...tuning];
    staff.stringTuning.name = [...tuning].reverse().map(pitchName).join(' · ');
    for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) touched.add(beat);
  }
  for (const [key, edit] of Object.entries(song.noteEdits || {})) {
    const note = noteFromKey(score, key);
    if (!note || note.isPercussion) throw new Error('A saved note edit does not match this score.');
    if ('fret' in edit) {
      if (!note.isStringed || !Number.isInteger(edit.fret) || edit.fret < -1000 || edit.fret > 1000 || !Number.isInteger(edit.string) || edit.string < 1 || edit.string > note.beat.voice.bar.staff.tuning.length) throw new Error('Choose a valid string and a whole fret number.');
      note.fret = edit.fret; note.string = edit.string;
    } else {
      if (!note.isPiano || !Number.isInteger(edit.octave) || !Number.isInteger(edit.tone) || edit.tone < 0 || edit.tone > 11 || edit.octave < -80 || edit.octave > 80) throw new Error('Choose a pitch within MIDI 0–127.');
      note.octave = edit.octave; note.tone = edit.tone;
    }
    touched.add(note.beat);
  }
  // Keep alphaTab's string lookup and extrema consistent without re-parsing or
  // re-finishing ties, bends and other effects already resolved by the importer.
  for (const beat of touched) {
    const strings = new Set<number>(); beat.noteStringLookup.clear();
    for (const n of beat.notes) if (n.isStringed) {
      if (strings.has(n.string) && !Object.values(song.spliceEdits || {}).some(s=>s.track===beat.voice.bar.staff.track.index && s.staff===beat.voice.bar.staff.index && beat.voice.bar.index+1>=s.start && beat.voice.bar.index+1<=s.end) && beat.voice.bar.staff.tuning.length === baseCounts.get(`${beat.voice.bar.staff.track.index}:${beat.voice.bar.staff.index}`)) throw new Error(`Two notes would share string ${n.string} in bar ${beat.voice.bar.index + 1}.`);
      strings.add(n.string); beat.noteStringLookup.set(n.string, n);
    }
    const notes = beat.notes.filter(n => n.isVisible);
    beat.minNote = notes.reduce<model.Note | null>((a, b) => !a || b.realValue < a.realValue ? b : a, null);
    beat.maxNote = notes.reduce<model.Note | null>((a, b) => !a || b.realValue > a.realValue ? b : a, null);
    const fretted = notes.filter(n => n.isStringed);
    beat.minStringNote = fretted.reduce<model.Note | null>((a, b) => !a || b.string < a.string ? b : a, null);
    beat.maxStringNote = fretted.reduce<model.Note | null>((a, b) => !a || b.string > a.string ? b : a, null);
  }
  for (const note of allNotes(score)) {
    if(note.isDead){note.style?.colors.clear();continue;}
    if (!noteIssue(note, song)) continue;
    note.style ||= new window.alphaTab.model.NoteStyle();
    const elements=window.alphaTab.model.NoteSubElement;
    // Effect bands include dynamics; styling them from an invalid note also
    // colours unrelated markings. Restrict red to the pitched glyph itself.
    for (const element of [elements.StandardNotationNoteHead,elements.StandardNotationAccidentals,elements.GuitarTabFretNumber,elements.NumberedNumber,elements.NumberedAccidentals]) note.style.colors.set(element, new window.alphaTab.model.Color(210, 40, 48));
  }
  return score;
}

export function withTempoEdits(song: Song, tempoEdits: Record<string,number>): Song {
  const next={...song,tempoEdits};return {...next,bpm:readWorkingScore(next).tempo};
}

export function noteIssue(note: model.Note, song: Song): string {
  if (note.isPercussion || note.isDead) return '';
  if (note.realValue < 0 || note.realValue > 127) return 'Pitch is outside MIDI 0–127; adjust this note.';
  if(note.isStringed && note.beat.notes.some(n=>n!==note && n.isStringed && n.string===note.string))return 'Two simultaneous notes need the same string; adjust this fingering.';
  if (note.isStringed && (note.fret < 0 || note.fret > 36)) return 'Fret is outside 0–36; adjust this note or its string.';
  if (note.isHarmonic && song.noteEdits?.[noteKey(note)]) return 'Check this harmonic after transposing; its node and sounding pitch may need adjustment.';
  return '';
}

/** A keyboard entry updates a whole selection and its ties in one saved edit. */
export function changeFrets(song: Song, keys: string[], fret: number): Song {
  if (!Number.isInteger(fret) || fret < 0 || fret > 99) throw new Error('Enter a fret from 0 to 99.');
  const score = readWorkingScore(song), edits = { ...song.noteEdits };
  for (const key of keys) {
    const note = noteFromKey(score, key);
    if (!note?.isStringed || note.isPercussion) continue;
    for (const n of tiedNotes(note)) edits[noteKey(n)] = { fret, string: n.string };
  }
  return finishEdit(song, edits);
}

/** Export the working notes; custom label placement stays in the library backup. */
export function exportEditedScore(song: Song): Uint8Array {
  const score = readWorkingScore(song);
  score.title = song.title; score.artist = song.artist; score.album = song.album || '';
  const append = (beat: model.Beat | undefined, text: string) => { if (beat && text.trim()) beat.text = [beat.text, text.trim()].filter(Boolean).join(' · '); };
  for (const track of score.tracks) for (const section of sectionsFor(song, track.index)) append(track.staves[0]?.bars[section.start - 1]?.voices[0]?.beats[0], section.notes);
  for (const a of song.annotations || []) {
    const note = a.noteKey ? noteFromKey(score, a.noteKey) : undefined;
    append(note?.beat || score.tracks[a.track]?.staves[0]?.bars[a.bar - 1]?.voices[0]?.beats[0], a.text);
  }
  return new window.alphaTab.exporter.Gp7Exporter().export(score);
}

function tiedNotes(note: model.Note) {
  const found = new Set<model.Note>(), queue = [note];
  while (queue.length) { const n = queue.pop()!; if (found.has(n)) continue; found.add(n); if (n.tieOrigin) queue.push(n.tieOrigin); if (n.tieDestination) queue.push(n.tieDestination); }
  return [...found];
}
function editable(note: model.Note) {
  if (note.isPercussion) throw new Error('Percussion pitches are not transposed.');
  if (note.isHarmonic || note.isDead) throw new Error(`Bar ${note.beat.voice.bar.index + 1} contains a harmonic or dead note. Select ordinary notes, or change tuning while keeping the fingering.`);
}
function linkedTechnique(note: model.Note) { return note.isHammerPullOrigin || note.isHammerPullDestination || note.slideOutType !== 0 || !!note.slideOrigin; }
function finishEdit(song: Song, noteEdits: Record<string, NoteEdit>, tuningEdits = song.tuningEdits): Song {
  const next = { ...song, noteEdits, tuningEdits };
  const score = readWorkingScore(next), metadata = scoreMetadata(score);
  return { ...next, tracks: metadata.tracks, tuning: tuningEdits !== song.tuningEdits ? metadata.tracks.find(t => t.index === song.trackIndex)?.tuning || song.tuning : song.tuning };
}
export function fretOnString(tuning: number[], fromString: number, fret: number, toString: number): number {
  if(!Number.isInteger(fromString) || !Number.isInteger(toString) || fromString<1 || toString<1 || fromString>tuning.length || toString>tuning.length || !Number.isInteger(fret))throw new Error('Choose valid strings and a whole fret number.');
  return fret+tuning[tuning.length-fromString]-tuning[tuning.length-toString];
}

export function changeNote(song: Song, key: string, fret: number, string: number): Song {
  const score = readWorkingScore(song), note = noteFromKey(score, key);
  if (!note) throw new Error('Select a note first.');
  if (note.isPercussion) throw new Error('Choose a fretted note.');
  if (!note.isStringed) throw new Error('Fret editing is available for fretted instruments.');
  if (linkedTechnique(note) && string !== note.string) throw new Error('Keep slides and hammer-ons on their original string.');
  if(note.beat.notes.some(n=>n!==note && n.isStringed && n.string===string))throw new Error('Two notes would share string '+string+'.');
  const edits = { ...song.noteEdits };
  for (const n of tiedNotes(note)) { if (linkedTechnique(n) && string !== n.string) throw new Error('A tied note connects to a slide or hammer-on. Keep its string.'); edits[noteKey(n)] = { fret, string }; }
  return finishEdit(song, edits);
}
export function transposeNotes(song: Song, keys: string[], semitones: number): Song {
  if (!Number.isInteger(semitones) || semitones < -24 || semitones > 24 || !semitones) throw new Error('Choose a shift from −24 to +24 semitones, excluding zero.');
  const score = readWorkingScore(song), edits = { ...song.noteEdits }, selected = new Set<model.Note>();
  for (const key of keys) { const n = noteFromKey(score, key); if (n && !n.isPercussion) for (const tied of tiedNotes(n)) selected.add(tied); }
  if (!selected.size) throw new Error('Choose at least one pitched note.');
  for (const n of selected) {
    if (n.isStringed) {
      const fret = n.fret + semitones;
      edits[noteKey(n)] = { fret, string: n.string };
    } else { const pitch = n.octave * 12 + n.tone + semitones; edits[noteKey(n)] = { octave: Math.floor(pitch / 12), tone: ((pitch % 12) + 12) % 12 }; }
  }
  return finishEdit(song, edits);
}

export function retuneTrack(song: Song, trackIndex: number, lowToHigh: number[], keepPitch: boolean): Song {
  const score=readWorkingScore(song), track=score.tracks[trackIndex];
  if(!track)throw new Error('Choose an instrument.');
  if(lowToHigh.length<1 || lowToHigh.length>16 || !lowToHigh.every(n=>Number.isInteger(n)&&n>=0&&n<=127))throw new Error('Use valid tuning notes with octaves.');
  const tunings={...song.tuningEdits}, edits={...song.noteEdits}, compensation={...song.tuningCompensation}, noteComp={...song.tuningNoteCompensation}, base=readBaseScore(song);
  let count=0;
  for(const staff of track.staves){
    if(!staff.tuning.length)continue;
    const key=`${trackIndex}:${staff.index}`, target=[...lowToHigh].reverse(), resized=target.length!==staff.tuning.length;
    const prior=compensation[key] || staff.tuning.map((p,i)=>song.tuningEdits?.[key]?(base.tracks[trackIndex].staves[staff.index].tuning[i]??p)-p:0);
    tunings[key]=target;compensation[key]=target.map((p,i)=>(prior[i]||0)+(keepPitch?(staff.tuning[i]??p)-p:0));count++;
    for(const beat of staff.bars.flatMap(b=>b.voices.flatMap(v=>v.beats))){
      const occupied=new Set<number>();
      for(const note of beat.notes.filter(n=>n.isStringed)){
        const address=noteKey(note), oldIndex=staff.tuning.length-note.string, preferred=Math.max(1,Math.min(target.length,target.length-oldIndex)), pitch=note.fret+staff.tuning[oldIndex];
        let string=resized?preferred:note.string, fret=keepPitch?pitch-target[target.length-string]:note.fret;
        if(resized && (occupied.has(string) || fret<0 || fret>36)){
          const choices=Array.from({length:target.length},(_,i)=>{const string=i+1,fret=keepPitch?pitch-target[target.length-string]:note.fret;return {string,fret,cost:Math.abs(fret-note.fret)+Math.abs(string-preferred)*.25};}).filter(c=>!occupied.has(c.string));
          const playable=choices.filter(c=>c.fret>=0 && c.fret<=36).sort((a,b)=>a.cost-b.cost);
          const choice=playable[0] || choices.sort((a,b)=>Math.abs(a.fret)-Math.abs(b.fret))[0];
          if(choice){string=choice.string;fret=choice.fret;}
        }
        // A tie uses the assignment already chosen for its preceding note.
        const tie=note.tieOrigin && edits[noteKey(note.tieOrigin)];
        if(resized && tie && 'fret' in tie && tie.string>=1 && tie.string<=target.length && !occupied.has(tie.string)){string=tie.string;fret=tie.fret;}
        occupied.add(string);edits[address]={string,fret};
        if(resized || noteComp[address]){const delta=noteComp[address] || {fret:prior[oldIndex]||0,string:0};noteComp[address]={fret:delta.fret+fret-note.fret,string:delta.string+string-note.string};}
      }
    }
  }
  if(!count)throw new Error('Tuning changes are available on fretted instruments.');
  return finishEdit({...song,tuningCompensation:compensation,tuningNoteCompensation:noteComp},edits,tunings);
}
/** Correct mislabeled source strings without changing any written fret numbers. */
export function correctTuningLabel(song: Song, label: string): Song {
  if (label === song.tuning) return song;
  const score = readWorkingScore(song), track = score.tracks[song.trackIndex], staff = track?.staves.find(s => s.tuning.length);
  if (!staff) return { ...song, tuning: label };
  const clean = (s: string) => s.toLowerCase().replace(/♭/g,'b').replace(/♯/g,'#').replace(/\s*·\s*\d+-string/g,'').trim();
  const preset = tuningPresets(staff.tuning.length, track.playbackInfo.program >= 32 && track.playbackInfo.program <= 39).find(t => clean(t.name) === clean(label));
  const pitches = preset?.pitches || parseTuning(label);
  if (pitches.length !== staff.tuning.length) throw new Error('Choose a tuning with the same number of strings.');
  const sourceTunings = { ...song.sourceTunings }, tuningEdits = { ...song.tuningEdits }, tuningCompensation={...song.tuningCompensation},tuningNoteCompensation={...song.tuningNoteCompensation};
  for (const s of track.staves) if (s.tuning.length) { sourceTunings[`${track.index}:${s.index}`] = [...pitches].reverse(); delete tuningEdits[`${track.index}:${s.index}`]; delete tuningCompensation[`${track.index}:${s.index}`];for(const key of Object.keys(tuningNoteCompensation))if(key.startsWith(`${track.index}:${s.index}:`))delete tuningNoteCompensation[key]; }
  const next = { ...song, sourceTunings, tuningEdits, tuningCompensation, tuningNoteCompensation, tuning: label };
  return { ...next, tracks: scoreMetadata(readWorkingScore(next)).tracks };
}
/** Retune all fretted tracks; other string counts retain their intervals and follow the low-string shift. */
export function retuneScore(song: Song, lowToHigh: number[], keepPitch = true): Song {
  const working = readWorkingScore(song), selected = working.tracks[song.trackIndex]?.staves.find(s => s.tuning.length);
  if (!selected) throw new Error('Choose a guitar or bass instrument.');
  const delta = lowToHigh[0] - selected.tuning.at(-1)!;
  let next = song;
  for (const track of working.tracks) {
    const staff = track.staves.find(s => s.tuning.length);
    if (!staff || track.isPercussion) continue;
    const tuning = track.index===song.trackIndex || staff.tuning.length === lowToHigh.length ? lowToHigh : [...staff.tuning].reverse().map(p => p + delta);
    next = retuneTrack(next, track.index, tuning, keepPitch);
  }
  return next;
}
/** Return every retuned staff to its corrected original strings, retaining manual note edits. */
export function restoreOriginalTuning(song: Song): Song {
  const original = readBaseScore(song), working = readWorkingScore(song), edits = { ...song.noteEdits };
  for (const [key] of Object.entries(song.tuningEdits || {})) {
    const [t,s] = key.split(':').map(Number), before = original.tracks[t]?.staves[s], current = working.tracks[t]?.staves[s];
    if (!before || !current) continue;
    const offsets=song.tuningCompensation?.[key] || current.tuning.map((p,i)=>before.tuning[i]-p);
    for (const note of current.bars.flatMap(b => b.voices.flatMap(v => v.beats.flatMap(b => b.notes)))) if (note.isStringed) {
      const delta=song.tuningNoteCompensation?.[noteKey(note)];
      let string=delta?note.string-delta.string:note.string, fret=note.fret-(delta?.fret ?? offsets[current.tuning.length-note.string]);
      if(string<1 || string>before.tuning.length){string=Math.max(1,Math.min(before.tuning.length,string));fret=note.fret+current.tuning[current.tuning.length-note.string]-before.tuning[before.tuning.length-string];}
      edits[noteKey(note)]={fret,string};
    }
  }
  return {...finishEdit({...song,tuningCompensation:{},tuningNoteCompensation:{}}, edits, {}),tuningCompensation:{},tuningNoteCompensation:{}};
}
export function parseTuning(text: string): number[] {
  const pitchClasses: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return text.trim().split(/[\s,·]+/).filter(Boolean).map(value => {
    const match = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/.exec(value);
    if (!match) throw new Error('Use note names with octaves, e.g. D2 A2 D3 G3 B3 E4.');
    const pitch = (Number(match[3]) + 1) * 12 + pitchClasses[match[1].toUpperCase()] + (['#', '♯'].includes(match[2]) ? 1 : ['b', '♭'].includes(match[2]) ? -1 : 0);
    if (pitch < 0 || pitch > 127) throw new Error('Tuning notes must be within MIDI 0–127.');
    return pitch;
  });
}

export type FingeringSuggestion = { song: Song; changes: { key: string; from: string; to: string }[] };
/** A bounded search over simultaneous notes, preferring a compact chosen fret region. */
export function suggestFingerings(song: Song, keys: string[], minFret: number, maxFret: number): FingeringSuggestion {
  if (!Number.isInteger(minFret) || !Number.isInteger(maxFret) || minFret < 0 || maxFret > 36 || minFret > maxFret) throw new Error('Choose a fret region between 0 and 36.');
  const score = readWorkingScore(song), selected = new Map<string, model.Note>();
  for (const key of keys) { const n = noteFromKey(score, key); if (n) for (const tied of tiedNotes(n)) selected.set(noteKey(tied), tied); }
  if (!selected.size || selected.size > 500) throw new Error('Select 1–500 notes for fingering suggestions.');
  const edits = { ...song.noteEdits }, changes: FingeringSuggestion['changes'] = [];
  let lastFret = (minFret + maxFret) / 2;
  const groups = new Map<model.Beat, model.Note[]>();
  for (const n of selected.values()) { editable(n); if (!n.isStringed) throw new Error('Alternate fingerings need a fretted instrument.'); groups.set(n.beat, [...(groups.get(n.beat) || []), n]); }
  for (const [beat, notes] of [...groups].sort(([a], [b]) => a.absolutePlaybackStart - b.absolutePlaybackStart)) {
    const occupied = new Set(beat.notes.filter(n => !selected.has(noteKey(n)) && n.isStringed).map(n => n.string));
    const choices = notes.map(n => {
      const result: { fret: number; string: number; cost: number }[] = [];
      const staff = n.beat.voice.bar.staff, previousTie = n.tieOrigin && edits[noteKey(n.tieOrigin)];
      for (let string = 1; string <= staff.tuning.length; string++) {
        if (occupied.has(string) || (linkedTechnique(n) && string !== n.string)) continue;
        const fret = n.calculateRealValue(false, false) - staff.capo - staff.tuning[staff.tuning.length - string];
        if (fret < minFret || fret > maxFret) continue;
        if (previousTie && 'fret' in previousTie && (previousTie.string !== string || previousTie.fret !== fret)) continue;
        result.push({ fret, string, cost: Math.abs(fret - lastFret) + Math.abs(string - n.string) * 0.25 + fret * 0.01 });
      }
      return result.sort((a, b) => a.cost - b.cost);
    });
    let states: { picks: { fret: number; string: number }[]; cost: number }[] = [{ picks: [], cost: 0 }];
    for (const candidates of choices) states = states.flatMap(state => candidates.filter(c => !state.picks.some(p => p.string === c.string)).map(c => ({ picks: [...state.picks, c], cost: state.cost + c.cost + state.picks.reduce((sum, p) => sum + Math.abs(p.fret - c.fret) * 0.4, 0) }))).sort((a, b) => a.cost - b.cost).slice(0, 128);
    if (!states.length) throw new Error(`No playable assignment in frets ${minFret}–${maxFret} for bar ${beat.voice.bar.index + 1}. Widen the region. Slides and hammer-ons keep their strings.`);
    const best = states[0];
    best.picks.forEach((p, i) => { const n = notes[i], key = noteKey(n), count = n.beat.voice.bar.staff.tuning.length; edits[key] = { fret: p.fret, string: p.string }; if (n.fret !== p.fret || n.string !== p.string) changes.push({ key, from: `string ${count - n.string + 1}, fret ${n.fret}`, to: `string ${count - p.string + 1}, fret ${p.fret}` }); });
    lastFret = best.picks.reduce((sum, p) => sum + p.fret, 0) / best.picks.length;
  }
  return { song: finishEdit(song, edits), changes };
}
