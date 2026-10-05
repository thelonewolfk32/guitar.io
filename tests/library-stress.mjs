import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {serve,fixtures,seed,instrument,capturePlayer,midiSample} from './library-harness.mjs';
const project=path.resolve('.'),temporary=await fs.mkdtemp(path.join(project,'test-results/v12-stress-'));
const require=createRequire(import.meta.url),packages=await fs.readdir('node_modules/.pnpm'),asar=require(path.resolve('node_modules/.pnpm',packages.find(p=>p.startsWith('@electron+asar@')),'node_modules/@electron/asar/lib/asar.js'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results={testedAt:new Date().toISOString(),environment:'Windows x64 / installed Edge / isolated browser storage / headless WebAudio',fixture:'115-bar original GP scores; 24 sections; four tags; unique 512px textured JPEG covers; five recent playback entries',thresholds:{startupMs:1500,eventGapP95Ms:150,frameP95Ms:50,timelineErrorMs:600},rows:[],limitations:'Synthetic scores and simulated output timing; no subjective listening, cloud latency, iOS or LAN transfer. A 300-song cap is not a universal maximum.'};
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)] || 0;
let oldServer,newServer;
try{
  asar.extractAll(path.resolve('../../Guitar-io-1.1.1-Windows-x64/resources/app.asar'),path.join(temporary,'baseline'));
  oldServer=await serve(path.join(temporary,'baseline/dist'));newServer=await serve('dist');
  const all=fixtures(300);
  for(const [version,server] of [['1.1.1',oldServer],['1.2.0',newServer]]) {
    for(const count of [25,50,100,200,300]) {
      const context=await browser.newContext({viewport:{width:1512,height:960}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);
      try{
        const sizes=await seed(page,server.url,all.slice(0,count));
        const first=performance.now();await page.goto(server.url);await page.waitForFunction(n=>document.querySelectorAll('.song-card').length===n,count);const firstLaunchMs=performance.now()-first;
        const startup=[],io=[];
        for(let n=0;n<3;n++){const start=performance.now();await page.reload();await page.waitForFunction(n=>document.querySelectorAll('.song-card').length===n,count);startup.push(performance.now()-start);io.push(await page.evaluate(()=>window.__io));}
        await capturePlayer(page);const open=performance.now();await page.getByRole('button',{name:'Open Synthetic study 000',exact:true}).click();await page.waitForFunction(()=>window.__testApi?.isReadyForPlayback && !document.querySelector('.loading-score'));const playerReadyMs=performance.now()-open;
        const midi=await midiSample(page),timelineErrorMs=Math.abs(midi.scoreAdvanceMs-midi.elapsedEventMs*midi.playbackSpeed);
        const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const metrics=await cdp.send('Performance.getMetrics');const heap=metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value;
        assert(midi.positionEvents>20,'Actual MIDI position events must arrive');assert.deepEqual(errors,[]);
        const row={version,count,...sizes,firstLaunchMs,startupMedianMs:percentile(startup,.5),startupSamplesMs:startup,playerReadyMs,midi,timelineErrorMs,jsHeapBytes:heap,startupIO:io[2]};
        row.thresholdExceeded=row.startupMedianMs>results.thresholds.startupMs || midi.eventGapP95Ms>results.thresholds.eventGapP95Ms || midi.frameP95Ms>results.thresholds.frameP95Ms || timelineErrorMs>results.thresholds.timelineErrorMs;
        results.rows.push(row);console.log(JSON.stringify(row));
        if(row.thresholdExceeded){console.log(`Stopping ${version} at ${count}: declared performance threshold exceeded.`);break;}
      }finally{await context.close();}
    }
  }
  await fs.writeFile('PERFORMANCE.json',JSON.stringify(results,null,2)+'\n');
}finally{
  await browser.close();await oldServer?.close();await newServer?.close();
  // Delete only this run's verified workspace temporary directory.
  assert(temporary.startsWith(path.join(project,'test-results','v12-stress-')));await fs.rm(temporary,{recursive:true,force:true});
}
console.log('Temporary scores, artwork, browser stores and extracted baseline removed. Results retained in PERFORMANCE.json.');
