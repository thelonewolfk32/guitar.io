import type {model} from '@coderline/alphatab';
import type {Song,SpliceEdit} from './types';
import {fromBase64,toBase64} from './notation';

function finishVoices(score:model.Score){
  const m=window.alphaTab.model;
  for(const track of score.tracks)for(const staff of track.staves){const max=Math.max(1,...staff.bars.map(b=>b.voices.length));for(const bar of staff.bars)while(bar.voices.length<max){const voice=new m.Voice(),rest=new m.Beat();rest.duration=m.Duration.Whole;rest.isEmpty=false;voice.addBeat(rest);bar.addVoice(voice);}}
  let barId=1,voiceId=1,beatId=1,noteId=1;
  for(const track of score.tracks)for(const staff of track.staves)for(const bar of staff.bars){bar.id=barId++;for(const voice of bar.voices){voice.id=voiceId++;for(const beat of voice.beats){beat.id=beatId++;for(const note of beat.notes)note.id=noteId++;}}}
  score.finish(new window.alphaTab.Settings());
}
const clone=(score:model.Score)=>window.alphaTab.importer.ScoreLoader.loadScoreFromBytes(new window.alphaTab.exporter.Gp7Exporter().export(score));
export function applySplices(score:model.Score,edits:Song['spliceEdits']):model.Score {
  for(const edit of Object.values(edits || {})){
    const staff=score.tracks[edit.track]?.staves[edit.staff],fragment=window.alphaTab.importer.ScoreLoader.loadScoreFromBytes(fromBase64(edit.dataBase64)).tracks[0]?.staves[0];
    if(!staff || !fragment || edit.start<1 || edit.end>staff.bars.length || fragment.bars.length!==edit.end-edit.start+1)throw new Error('A saved splice does not match this score.');
    for(let i=0;i<fragment.bars.length;i++){
      const bar=staff.bars[edit.start-1+i];bar.voices=[];
      for(const voice of fragment.bars[i].voices)bar.addVoice(voice);
    }
  }
  if(Object.keys(edits || {}).length)finishVoices(score);
  return score;
}
export type SplicePlan={destinationTrack:number;sourceTrack:number;start:number;end:number;sourceStart:number;mode:'merge'|'overwrite'};
export type SpliceResult={score:model.Score;edit:SpliceEdit;warnings:{bar:number;message:string}[]};
export function spliceParts(destination:model.Score,source:model.Score,plan:SplicePlan):SpliceResult {
  const a=window.alphaTab,m=a.model,result=clone(destination),incoming=clone(source);
  const target=result.tracks[plan.destinationTrack]?.staves[0],other=incoming.tracks[plan.sourceTrack]?.staves[0];
  const count=plan.end-plan.start+1;
  if(!target || !other || target.isPercussion || other.isPercussion || !target.tuning.length || !other.tuning.length)throw new Error('Choose two fretted guitar or bass parts.');
  if(![plan.start,plan.end,plan.sourceStart].every(Number.isInteger) || count<1 || plan.start<1 || plan.end>target.bars.length || plan.sourceStart<1 || plan.sourceStart+count-1>other.bars.length)throw new Error('Choose matching bar ranges within both tabs.');
  const warnings:SpliceResult['warnings']=[];
  for(let i=0;i<count;i++){
    const targetBar=target.bars[plan.start-1+i],sourceBar=other.bars[plan.sourceStart-1+i],dm=targetBar.masterBar,sm=sourceBar.masterBar;
    if(dm.timeSignatureNumerator!==sm.timeSignatureNumerator || dm.timeSignatureDenominator!==sm.timeSignatureDenominator || dm.isAnacrusis!==sm.isAnacrusis)throw new Error('Time signatures or pickup lengths differ at bar '+(plan.start+i)+'. Select bars with the destination song’s rhythm.');
    const previous=plan.mode==='merge'?targetBar.voices.flatMap(v=>v.beats.flatMap(b=>b.notes)):[];
    const known=previous.map(note=>({note,pitch:note.realValue}));
    if(plan.mode==='overwrite')targetBar.voices=[];
    for(const voice of sourceBar.voices){
      for(const beat of voice.beats)for(const note of [...beat.notes]){
        if(!note.isStringed)continue;
        const pitch=note.realValue,preferred=note.string;
        // A union keeps one copy of an identical sounding note at the same time.
        // Different pitches/durations/techniques remain visible for overlap review.
        const technique=(n:model.Note)=>JSON.stringify([n.isDead,n.isTieDestination,n.isTieOrigin,n.isHammerPullOrigin,n.isPalmMute,n.harmonicType,n.bendType,n.bendPoints?.map(p=>[p.offset,p.value])]);
        if(plan.mode==='merge' && !note.isDead && known.some(({note:existing,pitch:existingPitch})=>existingPitch===pitch && existing.beat.playbackStart===beat.playbackStart && existing.beat.playbackDuration===beat.playbackDuration && technique(existing)===technique(note))){beat.removeNote(note);continue;}
        const candidates=target.tuning.map((_,index)=>({string:target.tuning.length-index,fret:pitch-target.tuning[index]-target.capo})).filter(v=>Number.isInteger(v.fret)&&v.fret>=0&&v.fret<=36);
        const occupied=new Set(beat.notes.filter(n=>n!==note).map(n=>n.string));
        const match=candidates.find(v=>v.string===preferred&&!occupied.has(v.string)) || candidates.find(v=>!occupied.has(v.string)) || candidates[0];
        note.string=match?.string || Math.min(preferred,target.tuning.length);note.fret=match?.fret ?? pitch-target.tuning[target.tuning.length-note.string]-target.capo;
        known.push({note,pitch});
      }
      if(plan.mode==='merge' && !voice.beats.some(beat=>beat.notes.length))continue;
      if(targetBar.voices.length>=4)throw new Error('Merging these parts exceeds four voices. Use overwrite for this section.');
      targetBar.addVoice(voice);
    }

    const added=targetBar.voices.flatMap(v=>v.beats.flatMap(b=>b.notes)).filter(n=>!previous.includes(n));
    const barNotes=targetBar.voices.flatMap(v=>v.beats.flatMap(b=>b.notes));
    const marked=new Set<model.Note>();
    const overlap=(x:model.Note,y:model.Note)=>x.beat.playbackStart<y.beat.playbackStart+Math.max(1,y.beat.playbackDuration) && y.beat.playbackStart<x.beat.playbackStart+Math.max(1,x.beat.playbackDuration);
    if(plan.mode==='merge')for(const x of added)for(const y of previous)if(overlap(x,y)){marked.add(x);marked.add(y);}
    for(const note of barNotes){
      if(note.isDead)continue;
      const simultaneous=barNotes.filter(n=>!n.isDead && overlap(note,n));
      const frets=simultaneous.filter(n=>n.fret>0).map(n=>n.fret);
      if(note.fret<0 || note.fret>36 || simultaneous.some(n=>n!==note && n.string===note.string) || frets.length>1 && Math.max(...frets)-Math.min(...frets)>5)simultaneous.forEach(n=>marked.add(n));
    }
    if(marked.size){
      warnings.push({bar:plan.start+i,message:'Overlapping parts or fingering needs review'});
      for(const n of marked){if(n.isDead || n.isPercussion)continue;n.style ||= new m.NoteStyle();for(const element of [m.NoteSubElement.GuitarTabFretNumber,m.NoteSubElement.StandardNotationNoteHead,m.NoteSubElement.StandardNotationAccidentals])n.style.colors.set(element,new m.Color(210,40,48));}
    }
  }
  finishVoices(result);
  // Store just the affected bars, with destination tuning/signatures. Original GP bytes stay intact.
  const fragment=clone(result),fragmentTrack=fragment.tracks[plan.destinationTrack],fragmentStaff=fragmentTrack.staves[0];
  fragment.tracks=[fragmentTrack];fragmentTrack.index=0;fragmentTrack.score=fragment;fragmentTrack.staves=[fragmentStaff];fragmentStaff.index=0;
  fragment.masterBars=fragment.masterBars.slice(plan.start-1,plan.end);fragmentStaff.bars=fragmentStaff.bars.slice(plan.start-1,plan.end);
  fragment.masterBars.forEach((bar,i)=>{bar.index=i;bar.previousMasterBar=fragment.masterBars[i-1] || null;bar.nextMasterBar=fragment.masterBars[i+1] || null;bar.isRepeatStart=false;bar.repeatCount=0;bar.alternateEndings=0;bar.directions=null;});
  fragmentStaff.bars.forEach((bar,i)=>{bar.index=i;bar.staff=fragmentStaff;bar.previousBar=fragmentStaff.bars[i-1] || null;bar.nextBar=fragmentStaff.bars[i+1] || null;});
  for(const bar of fragmentStaff.bars)for(const voice of bar.voices)for(const beat of voice.beats){beat.previousBeat=null;beat.nextBeat=null;for(const note of beat.notes){note.tieOrigin=null;note.tieDestination=null;note.hammerPullOrigin=null;note.hammerPullDestination=null;note.slideTarget=null;note.slideOrigin=null;}}
  fragment.rebuildRepeatGroups();fragment.finish(new a.Settings());
  const edit:SpliceEdit={track:plan.destinationTrack,staff:0,start:plan.start,end:plan.end,dataBase64:toBase64(new a.exporter.Gp7Exporter().export(fragment)),createdAt:new Date().toISOString()};
  return {score:result,edit,warnings};
}
function inRange(key:string,edit:SpliceEdit){const [t,s,b]=key.split(':').map(Number);return t===edit.track && s===edit.staff && b+1>=edit.start && b+1<=edit.end;}
export function commitSplice(song:Song,result:SpliceResult):Song {
  if(Object.keys(song.spliceEdits || {}).length>=200)throw new Error('This song already contains 200 saved splices. Export the edited GP to consolidate it.');
  const id=crypto.randomUUID(),edit=result.edit;
  const oldNotes=Object.fromEntries(Object.entries(song.noteEdits || {}).filter(([k])=>inRange(k,edit)));
  const oldComp=Object.fromEntries(Object.entries(song.tuningNoteCompensation || {}).filter(([k])=>inRange(k,edit)));
  const affected=(a:NonNullable<Song['annotations']>[number])=>a.track===edit.track && a.bar>=edit.start && a.bar<=edit.end;
  return {...song,spliceEdits:{...song.spliceEdits,[id]:edit},spliceUndo:{editId:id,noteEdits:oldNotes,tuningNoteCompensation:oldComp,annotations:(song.annotations || []).filter(affected)},
    noteEdits:Object.fromEntries(Object.entries(song.noteEdits || {}).filter(([k])=>!inRange(k,edit))),tuningNoteCompensation:Object.fromEntries(Object.entries(song.tuningNoteCompensation || {}).filter(([k])=>!inRange(k,edit))),
    annotations:song.annotations?.map(a=>affected(a)?{...a,noteKey:undefined}:a)};
}
export function undoSplice(song:Song):Song {
  const undo=song.spliceUndo,edit=undo && song.spliceEdits?.[undo.editId];if(!undo || !edit)return song;
  const edits={...song.spliceEdits};delete edits[undo.editId];
  return {...song,spliceEdits:edits,spliceUndo:undefined,
    noteEdits:{...Object.fromEntries(Object.entries(song.noteEdits || {}).filter(([k])=>!inRange(k,edit))),...undo.noteEdits},
    tuningNoteCompensation:{...Object.fromEntries(Object.entries(song.tuningNoteCompensation || {}).filter(([k])=>!inRange(k,edit))),...undo.tuningNoteCompensation},
    annotations:[...(song.annotations || []).filter(a=>a.track!==edit.track || a.bar<edit.start || a.bar>edit.end),...undo.annotations]};
}
