import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import * as alphaTab from '@coderline/alphatab';

export async function serve(root) {
  root=path.resolve(root);
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/seed'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated Guitar.io fixture</title>');return;}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.sf2':'application/octet-stream'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
export function fixtures(count,bars=115) {
  const score=alphaTab.importer.ScoreLoader.loadAlphaTex('\\title "Synthetic study" \\artist "Performance fixture" \\tempo 120 . '+Array.from({length:bars},(_,i)=>`(0.6 2.5).8 ${i%9}.4.8 3.3.8 5.2.8 7.1.8 5.2.8 3.3.8 2.4.8`).join(' | '));
  return Array.from({length:count},(_,i)=>{
    const id=`fixture-${String(i).padStart(3,'0')}`,title=`Synthetic study ${String(i).padStart(3,'0')}`;score.title=title;
    const source=Buffer.from(new alphaTab.exporter.Gp7Exporter().export(score));
    const sections=Array.from({length:Math.min(24,bars)},(_,n)=>({id:`section-${n}`,name:n===0?'Intro':`Phrase ${n+1}`,start:Math.floor(n*bars/Math.min(24,bars))+1,end:Math.floor((n+1)*bars/Math.min(24,bars)),color:['#8b79ff','#24b8a8','#ed9235'][n%3],status:n%3===0?'learning':n%3===1?'comfortable':'new',learnedPercent:n%3===0?60:n%3===1?95:0,notes:`Synthetic practice notes ${n}`,speed:1}));
    return {id,title,artist:`Fixture artist ${i%20}`,album:`Original album ${i%30}`,difficulty:i%5+1,tuning:'Standard',guitars:[],tags:[`Mood ${i%8}`,`Style ${i%6}`,'Practice','Synthetic'],fileName:`${id}.gp`,format:'GP',source:Array.from(source),hash:crypto.createHash('sha256').update(source).digest('hex'),bars,bpm:120,tracks:[{index:0,name:'Guitar',tuning:'Standard',notes:'E2 · A2 · D3 · G3 · B3 · E4',strings:6}],trackIndex:0,sections,sectionsByTrack:{'0':sections},schemaVersion:2,folderId:'',artworkAssetId:`cover-${i}`,noteEdits:{},annotations:[],annotationPositions:{},media:{},demo:false,createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z',lastPlayedAt:i<6?new Date(Date.UTC(2026,9,2,0,i)).toISOString():undefined,lastPlayedBar:1};
  });
}
export async function seed(page,url,songs,modern=false,skipNavigation=false) {
  if(!modern&&!skipNavigation)await page.goto(url+'/seed');
  return page.evaluate(async ({songs,modern})=>{
    localStorage.setItem('guitario-auto-artwork','off');
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('guitar-io-v1',modern?4:2);q.onupgradeneeded=()=>{q.result.createObjectStore('songs',{keyPath:'id'});q.result.createObjectStore('assets',{keyPath:'id'});q.result.createObjectStore('settings');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    const artworks=[];
    for(let i=0;i<songs.length;i++){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
      ctx.fillStyle=`hsl(${i*43%360} 45% 28%)`;ctx.fillRect(0,0,512,512);
      // Deterministic texture stresses artwork storage without using external art.
      let random=i+1;for(let n=0;n<4000;n++){random=(Math.imul(random,1664525)+1013904223)>>>0;ctx.fillStyle=`hsl(${(i*43+n)%360} 45% ${20+n%50}%)`;ctx.fillRect(random%512,(random>>>9)%512,3+n%7,3+n%7);}
      ctx.fillStyle='#eff7dd';ctx.font='bold 120px sans-serif';ctx.textAlign='center';ctx.fillText(String(i+1).padStart(3,'0'),256,310);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));artworks.push({id:`cover-${i}`,kind:'artwork',name:`fixture-${i}.jpg`,mime:'image/jpeg',blob});
    }
    await new Promise((resolve,reject)=>{const tx=db.transaction(modern?['songs','assets','songSources','songIndex']:['songs','assets'],'readwrite');for(const song of songs){
      if(!modern){tx.objectStore('songs').put({...song,source:new Uint8Array(song.source)});continue;}
      const {source,...details}=song;tx.objectStore('songs').put(details);tx.objectStore('songSources').put({id:song.id,source:new Uint8Array(source)});
      const {sections,sectionsByTrack,noteEdits,annotations,annotationPositions,media,...summary}=details;
      const progress=Math.round(sections.reduce((n,s)=>n+(s.end-s.start+1)*(s.learnedPercent || 0),0)/song.bars);
      tx.objectStore('songIndex').put({...summary,summaryVersion:1,progress,progressState:progress?'progress':'explore',tuningCaption:{original:'Standard',change:''},tuningBuckets:['Standard'],originalPitches:[40,45,50,55,59,64],recordingKinds:[],assetIds:[song.artworkAssetId]});
    }for(const asset of artworks)tx.objectStore('assets').put(asset);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
    return {sourceBytes:songs.reduce((n,s)=>n+s.source.length,0),artworkBytes:artworks.reduce((n,a)=>n+a.blob.size,0)};
  },{songs,modern});
}
export async function instrument(page) {
  await page.addInitScript(()=>{
    window.__io={};
    for(const method of ['get','getAll','put','openCursor','openKeyCursor']){const original=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(...args){const key=this.name+'.'+method;window.__io[key]=(window.__io[key]||0)+1;return original.apply(this,args);};}
  });
}
export async function capturePlayer(page) {
  await page.evaluate(()=>{
    const Native=window.alphaTab.AlphaTabApi;window.alphaTab.AlphaTabApi=new Proxy(Native,{construct(Target,args){const api=new Target(...args);if(!args[0]?.closest?.('.splicer-renderers'))window.__testApi=api;return api;}});
  });
}
export async function midiSample(page,seconds=6) {
  await page.waitForFunction(()=>window.__testApi?.isReadyForPlayback && !document.querySelector('.loading-score'));
  await page.evaluate(()=>{
    window.__playSample={gaps:[],frames:[],start:0,end:0,speed:window.__testApi.playbackSpeed,firstTime:0,lastTime:0};
    let previous=0,lastFrame=0;
    window.__testApi.playerPositionChanged.on(e=>{const now=performance.now(),s=window.__playSample;if(!s.start)return;if(previous)s.gaps.push(now-previous);previous=now;if(!s.firstTime)s.firstTime=e.currentTime;s.lastTime=e.currentTime;s.end=now;});
    const frame=now=>{const s=window.__playSample;if(s.start && lastFrame)s.frames.push(now-lastFrame);lastFrame=now;window.__sampleFrame=requestAnimationFrame(frame);};window.__sampleFrame=requestAnimationFrame(frame);
  });
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForFunction(()=>window.__testApi.player?.state===window.alphaTab.synth.PlayerState.Playing);
  await page.evaluate(()=>{window.__playSample.start=performance.now();});
  await page.waitForTimeout(seconds*1000);
  const sample=await page.evaluate(()=>{cancelAnimationFrame(window.__sampleFrame);const s=window.__playSample;window.__testApi.pause();return s;});
  const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)] || 0;
  return {positionEvents:sample.gaps.length,eventGapP95Ms:percentile(sample.gaps,.95),eventGapMaxMs:Math.max(0,...sample.gaps),frameP95Ms:percentile(sample.frames,.95),frameMaxMs:Math.max(0,...sample.frames),scoreAdvanceMs:sample.lastTime-sample.firstTime,elapsedEventMs:sample.end-sample.start,playbackSpeed:sample.speed};
}
