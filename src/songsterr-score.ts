import type { model } from '@coderline/alphatab';
import type { Recording, YouTubeSync } from './types';

export type SongsterrVideo = { videoId:string; purpose:'full'|'backing'; points:number[]; tracks?:number[] };
export type SongsterrSyncResult = { url:string; songId:number; revisionId:number; videos:SongsterrVideo[] };
type RawNote = {rest?:boolean;fret?:number;string?:number;tie?:boolean;hp?:boolean;dead?:boolean;ghost?:boolean;staccato?:boolean;accentuated?:boolean;letRing?:boolean;palmMute?:boolean;leftHandVibrato?:boolean;vibrato?:boolean;slide?:string;harmonic?:string;harmonicFret?:number;pickScrape?:string;bend?:{points:{position:number;tone:number}[]}};
type RawBeat = {type?:number;dots?:number;tuplet?:number;duration?:number[];notes?:RawNote[];rest?:boolean;velocity?:string;gradualVelocity?:string;letRing?:boolean;palmMute?:boolean;text?:{text?:string};graceNote?:string;pickStroke?:string;downStroke?:boolean;upStroke?:boolean;wahwah?:string;vibratoWithTremoloBar?:string;brushStroke?:{direction:string;duration:number};tremoloBar?:{points:{position:number;tone:number}[]}};
type RawMeasure = {voices?:{beats?:RawBeat[]}[];signature?:number[];marker?:{text?:string};keySignature?:{accidentalCount:number;mode:string};tripletFeel?:string;repeatStart?:boolean;repeatCount?:number};
export type SongsterrTrack = {name?:string;tuning?:number[];strings?:number;instrumentId?:number;volume?:number;balance?:number;capo?:number;anacrusis?:boolean;measures:RawMeasure[];automations?:{tempo?:{bpm:number;bar?:number;measure?:number;position?:number;type?:number}[]}};
export type SongsterrImportResult = SongsterrSyncResult & {meta:{title:string;artist:string};tracks:SongsterrTrack[];syncWarning?:string};

/** Preserve the imported score's tuning and tempo; video alignment lives on its recording. */
export function songsterrScore(data:SongsterrImportResult):model.Score {
  const a=window.alphaTab,m=a.model,score=new m.Score();
  score.title=data.meta.title;score.artist=data.meta.artist;score.tab='Songsterr';
  const count=Math.max(...data.tracks.map(t=>t.measures.length));
  if(!count || count>20000 || !data.tracks.length || data.tracks.length>64)throw new Error('Unsupported Songsterr score size.');
  let signature=[4,4],feel=m.TripletFeel.NoTripletFeel;
  for(let i=0;i<count;i++){
    const raw=data.tracks.map(t=>t.measures[i]).find(b=>b?.signature) || data.tracks[0].measures[i] || {};
    if(raw.signature)signature=raw.signature;
    if(signature.length!==2 || !signature.every(n=>Number.isInteger(n)&&n>0&&n<=64))throw new Error('Unsupported Songsterr time signature.');
    const bar=new m.MasterBar();bar.timeSignatureNumerator=signature[0];bar.timeSignatureDenominator=signature[1];
    if(raw.tripletFeel!==undefined)feel=raw.tripletFeel==='8th'?m.TripletFeel.Triplet8th:raw.tripletFeel==='16th'?m.TripletFeel.Triplet16th:m.TripletFeel.NoTripletFeel;
    bar.tripletFeel=feel;bar.isAnacrusis=i===0 && !!data.tracks[0].anacrusis;
    bar.isRepeatStart=!!raw.repeatStart;bar.repeatCount=raw.repeatCount || 0;
    const marker=data.tracks.map(t=>t.measures[i]?.marker?.text).find(Boolean);
    if(marker){bar.section=new m.Section();bar.section.text=marker;}
    score.addMasterBar(bar);
  }
  const tempos=data.tracks.find(t=>t.automations?.tempo?.length)?.automations?.tempo || [];
  for(const t of tempos){
    const index=t.measure ?? t.bar ?? 0,bpm=t.bpm;
    if(!Number.isInteger(index) || index<0 || index>=count || !Number.isFinite(bpm) || bpm<10 || bpm>999)continue;
    const position=(t.position || 0)/960;
    if(position<0 || position>1)continue;
    score.masterBars[index].tempoAutomations.push(m.Automation.buildTempoAutomation(false,position,bpm*4/(t.type || 4),2));
  }
  if(!score.masterBars[0].tempoAutomations.some(t=>t.ratioPosition===0))score.masterBars[0].tempoAutomations.unshift(m.Automation.buildTempoAutomation(false,0,120,2));
  const dynamics:Record<string,model.DynamicValue>={ppp:m.DynamicValue.PPP,pp:m.DynamicValue.PP,p:m.DynamicValue.P,mp:m.DynamicValue.MP,mf:m.DynamicValue.MF,f:m.DynamicValue.F,ff:m.DynamicValue.FF,fff:m.DynamicValue.FFF};
  data.tracks.forEach((raw,ti)=>{
    const track=new m.Track(),staff=new m.Staff();track.name=raw.name || 'Track '+(ti+1);score.addTrack(track);track.addStaff(staff);
    staff.isPercussion=raw.instrumentId===1024;
    const tuning=raw.tuning || [];
    if(tuning.length>16 || !tuning.every(n=>Number.isInteger(n)&&n>=0&&n<=127))throw new Error('Invalid Songsterr tuning.');
    staff.stringTuning.tunings=[...tuning];staff.showTablature=tuning.length>0 && !staff.isPercussion;
    staff.showStandardNotation=true;staff.capo=raw.capo || 0;
    track.playbackInfo.program=staff.isPercussion?0:Math.max(0,Math.min(127,raw.instrumentId ?? 25));
    track.playbackInfo.primaryChannel=staff.isPercussion?9:ti%15>=9?ti%15+1:ti%15;track.playbackInfo.secondaryChannel=track.playbackInfo.primaryChannel;
    track.playbackInfo.volume=Math.max(0,Math.min(16,Math.round((raw.volume ?? 1)*16)));track.playbackInfo.balance=Math.max(0,Math.min(16,Math.round(((raw.balance ?? 0)+1)*8)));
    let dynamic=m.DynamicValue.MF;
    const previous=new Map<string,model.Note>();
    for(let bi=0;bi<count;bi++){
      const rb=raw.measures[bi],bar=new m.Bar();staff.addBar(bar);
      bar.clef=staff.isPercussion?m.Clef.Neutral:tuning.length>0 && Math.max(...tuning)<60?m.Clef.F4:m.Clef.G2;
      if(rb?.keySignature){bar.keySignature=rb.keySignature.accidentalCount;bar.keySignatureType=rb.keySignature.mode==='minor'?m.KeySignatureType.Minor:m.KeySignatureType.Major;}
      for(const [vi,rv] of (rb?.voices?.length?rb.voices:[{beats:[{type:1,rest:true}]}]).entries()){
        const voice=new m.Voice();bar.addVoice(voice);
        for(const b of rv.beats || []){
          const beat=new m.Beat();voice.addBeat(beat);beat.isEmpty=false;
          const duration=b.type || 4;
          if(![-4,-2,1,2,4,8,16,32,64,128,256].includes(duration))throw new Error('Unsupported Songsterr note duration.');
          beat.duration=duration;beat.dots=b.dots || 0;
          if(b.tuplet && b.tuplet!==1){beat.tupletNumerator=b.tuplet;beat.tupletDenominator=b.tuplet===3?2:b.tuplet===5?4:b.tuplet===6?4:b.tuplet===7?4:b.tuplet===9?8:b.tuplet-1;}
          dynamic=dynamics[b.velocity || ''] ?? dynamic;beat.dynamics=dynamic;
          beat.crescendo=b.gradualVelocity==='crescendo'?m.CrescendoType.Crescendo:b.gradualVelocity==='decrescendo'?m.CrescendoType.Decrescendo:m.CrescendoType.None;
          beat.text=b.text?.text || null;beat.isLetRing=!!b.letRing;beat.isPalmMute=!!b.palmMute;
          beat.pickStroke=b.pickStroke==='down' || b.downStroke?m.PickStroke.Down:b.pickStroke==='up' || b.upStroke?m.PickStroke.Up:m.PickStroke.None;
          if(b.brushStroke){beat.brushType=b.brushStroke.direction==='up'?m.BrushType.BrushUp:m.BrushType.BrushDown;beat.brushDuration=b.brushStroke.duration;}
          beat.wahPedal=b.wahwah==='open'?m.WahPedal.Open:b.wahwah==='closed'?m.WahPedal.Closed:m.WahPedal.None;
          beat.vibrato=b.vibratoWithTremoloBar?m.VibratoType.Slight:m.VibratoType.None;
          beat.graceType=b.graceNote==='onBeat'?m.GraceType.OnBeat:b.graceNote==='beforeBeat'?m.GraceType.BeforeBeat:m.GraceType.None;
          for(const p of b.tremoloBar?.points || [])beat.addWhammyBarPoint(new m.BendPoint(p.position,p.tone/25));
          if(b.rest)continue;
          for(const n of b.notes || []){
            if(n.rest)continue;
            const note=new m.Note();note.dynamics=dynamic;
            if(staff.isPercussion)note.percussionArticulation=n.fret ?? 38;
            else if(tuning.length){const fret=n.fret ?? (n.dead?0:undefined);if(!Number.isInteger(n.string) || n.string!<0 || n.string!>=tuning.length || !Number.isInteger(fret) || fret!<0 || fret!>100)throw new Error('Unsupported Songsterr fret or string.');note.string=tuning.length-n.string!;note.fret=fret!;}
            else {const pitch=n.fret ?? 60;note.octave=Math.floor(pitch/12);note.tone=pitch%12;}
            note.isDead=!!n.dead;note.isGhost=!!n.ghost;note.isStaccato=!!n.staccato;note.isLetRing=!!n.letRing || !!b.letRing;note.isPalmMute=!!n.palmMute || !!b.palmMute;
            note.accentuated=n.accentuated?m.AccentuationType.Normal:m.AccentuationType.None;note.vibrato=n.vibrato || n.leftHandVibrato?m.VibratoType.Slight:m.VibratoType.None;
            note.isTieDestination=!!n.tie;
            const key=vi+':'+note.string+':'+(staff.isPercussion?note.percussionArticulation:0);
            if(n.hp && previous.has(key))previous.get(key)!.isHammerPullOrigin=true;
            previous.set(key,note);
            note.harmonicType=n.harmonic==='natural'?m.HarmonicType.Natural:n.harmonic==='pinch'?m.HarmonicType.Pinch:n.harmonic==='artificial'?m.HarmonicType.Artificial:n.harmonic==='tapped'?m.HarmonicType.Tap:n.harmonic==='semi'?m.HarmonicType.Semi:m.HarmonicType.None;
            note.harmonicValue=n.harmonicFret ?? note.fret;
            note.slideInType=n.slide?.startsWith('below') || n.slide==='fromBelow'?m.SlideInType.IntoFromBelow:n.slide?.startsWith('above') || n.slide==='fromAbove'?m.SlideInType.IntoFromAbove:m.SlideInType.None;
            note.slideOutType=n.slide?.includes('legato')?m.SlideOutType.Legato:n.slide==='shift' || n.slide==='toNext' || n.slide==='belowshift' || n.slide==='aboveshift'?m.SlideOutType.Shift:n.slide==='downwards'?m.SlideOutType.OutDown:n.slide==='upwards'?m.SlideOutType.OutUp:m.SlideOutType.None;
            for(const p of n.bend?.points || [])note.addBendPoint(new m.BendPoint(p.position,p.tone/25));
            beat.addNote(note);
          }
        }
        if(!voice.beats.length){const rest=new m.Beat();rest.duration=m.Duration.Whole;rest.isEmpty=false;voice.addBeat(rest);}
      }
    }
  });
  score.finish(new a.Settings());return score;
}
export function videoSync(data:SongsterrSyncResult,video:SongsterrVideo,bars:number):YouTubeSync {
  // Keep original bar indices when pickup/duplicate timestamps are omitted.
  const points:YouTubeSync['points']=[];let last=-1;
  video.points.slice(0,bars).forEach((seconds,i)=>{if(seconds>last){points.push({bar:i+1,seconds});last=seconds;}});
  return {source:'Songsterr',enabled:true,songId:data.songId,revisionId:data.revisionId,videoId:video.videoId,fetchedAt:new Date().toISOString(),points};
}
export function songsterrRecordings(data:SongsterrSyncResult,bars:number):Recording[] {
  return [data.videos.find(v=>v.purpose==='full'),data.videos.find(v=>v.purpose==='backing')].filter((v):v is SongsterrVideo=>!!v).map((v,i)=>({id:crypto.randomUUID(),kind:'youtube',purpose:v.purpose,label:v.purpose==='backing'?'Backing track '+(i+1):'Songsterr video '+(i+1),tags:[],videoId:v.videoId,url:'https://www.youtube.com/watch?v='+v.videoId,offsetSeconds:v.points[0],youtubeSync:videoSync(data,v,bars)}));
}
