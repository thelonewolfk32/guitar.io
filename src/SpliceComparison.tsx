import {useEffect,useRef,useState} from 'react';
import type {AlphaTabApi,model,rendering} from '@coderline/alphatab';
import {applyScoreColors} from './score-colors';

type Piece={svg:string;width:number;height:number;staffTop:number;surfaceClass:string};
// Two renderers, irrespective of bar count. Selection never rerenders/crops the score.
function useBarPieces(score:model.Score|undefined,track:number,dark:boolean,host:React.RefObject<HTMLDivElement|null>){
  const [pieces,setPieces]=useState<Map<number,Piece>>(new Map()),[error,setError]=useState('');
  useEffect(()=>{
    setPieces(new Map());setError('');if(!score || !host.current)return;
    let api:AlphaTabApi|undefined,disposed=false,frame=0;
    const partials=new Map<number,rendering.RenderFinishedEventArgs>();
    try{
      const a=window.alphaTab,settings=new a.Settings();
      settings.core.scriptFile=new URL('./vendor/alphatab/alphaTab.js',document.baseURI).href;
      settings.core.fontDirectory=new URL('./vendor/alphatab/font/',document.baseURI).href;
      settings.core.useWorkers=false;settings.core.enableLazyLoading=false;
      settings.display.staveProfile=a.StaveProfile.Tab;settings.display.scale=.85;
      settings.display.barsPerRow=1;settings.display.barCountPerPartial=1;settings.display.padding=[20,12,20,12];
      settings.display.systemsLayoutMode=a.SystemsLayoutMode.Automatic;
      settings.player.playerMode=a.PlayerMode.Disabled;settings.player.enableUserInteraction=false;settings.player.enableCursor=false;
      for(const key of ['ScoreTitle','ScoreSubTitle','ScoreArtist','ScoreAlbum','ScoreWords','ScoreMusic','ScoreCopyright','GuitarTuning'] as const)settings.notation.elements.set(a.NotationElement[key],false);
      applyScoreColors(settings,dark);
      api=new a.AlphaTabApi(host.current,settings);
      api.error.on(e=>{if(!disposed)setError(e.message);});
      api.renderStarted.on(()=>partials.clear());
      api.renderer.partialRenderFinished.on(e=>{if(e.firstMasterBarIndex>=0 && typeof e.renderResult==='string')partials.set(e.firstMasterBarIndex,e);});
      api.postRenderFinished.on(()=>{
        if(disposed)return;
        const next=new Map<number,Piece>();
        for(const [index,e] of partials){
          const bounds=api?.boundsLookup?.findMasterBarByIndex(index);
          next.set(index+1,{svg:e.renderResult as string,width:e.width,height:e.height,staffTop:Math.max(0,(bounds?.lineAlignedBounds.y ?? e.y)-e.y),surfaceClass:host.current?.querySelector('.at-surface')?.className || 'at-surface'});
        }
        setPieces(next);
      });
      frame=requestAnimationFrame(()=>{if(!disposed)api?.renderScore(score,[track]);});
    }catch(e){setError(e instanceof Error?e.message:'Could not display this part.');}
    return()=>{disposed=true;cancelAnimationFrame(frame);api?.destroy();host.current?.replaceChildren();};
  },[score,track,dark]);
  return {pieces,error};
}

export default function SpliceComparison({leftScore,leftTrack,rightScore,rightTrack=0,rightOffset=0,start,end,dark,onSelect}:{leftScore:model.Score;leftTrack:number;rightScore?:model.Score;rightTrack?:number;rightOffset?:number;start:number;end:number;dark:boolean;onSelect?:(bar:number,shift:boolean)=>void}){
  const leftHost=useRef<HTMLDivElement>(null),rightHost=useRef<HTMLDivElement>(null);
  const left=useBarPieces(leftScore,leftTrack,dark,leftHost),right=useBarPieces(rightScore,rightTrack,dark,rightHost);
  const count=Math.max(leftScore.masterBars.length,rightScore?rightScore.masterBars.length-rightOffset:0);
  return <div className={`splicer-score ${dark?'dark':'light'} ${rightScore?'two-parts':'one-part'}`}>
    <div className="splicer-renderers" aria-hidden="true"><div ref={leftHost}/><div ref={rightHost}/></div>
    {(left.error || right.error) && <p className="form-error">{left.error || right.error}</p>}
    {!left.pieces.size && !left.error && <p className="splicer-loading" role="status">Loading comparison…</p>}
    <div className="splice-bar-grid">
      {Array.from({length:count},(_,index)=>{
        const bar=index+1,sourceBar=bar+rightOffset,l=left.pieces.get(bar),r=rightScore?right.pieces.get(sourceBar):undefined,baseline=Math.max(l?.staffTop || 0,r?.staffTop || 0),selected=bar>=start && bar<=end;
        return <div className={'splice-bar-row'+(selected?' selected':'')} data-bar={bar} key={bar}>
          {[l,...(rightScore?[r]:[])].map((piece,column)=><button key={column} className="splice-bar-cell" aria-label={`Select splice bar ${bar} on ${column?'right':'left'}`} aria-pressed={selected} disabled={!onSelect || bar>leftScore.masterBars.length} title={`Bar ${bar}${onSelect?' · Shift-click to select a range':''}`} onClick={e=>onSelect?.(bar,e.shiftKey)}>
            <span className="splice-bar-number">{column && rightOffset?`Source ${sourceBar>0?sourceBar:'—'}`:bar}</span>
            {piece?<span className="splice-bar-notation" data-staff-top={piece.staffTop} style={{paddingTop:baseline-piece.staffTop}}><span className={piece.surfaceClass} style={{width:piece.width,height:piece.height}} dangerouslySetInnerHTML={{__html:piece.svg}}/></span>:<span className="splice-empty-bar">{column && (sourceBar<1 || sourceBar>rightScore!.masterBars.length)?'No matching bar':' '}</span>}
          </button>)}
        </div>;
      })}
    </div>
  </div>;
}
