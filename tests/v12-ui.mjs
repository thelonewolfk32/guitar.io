import {chromium,_electron as electron} from 'playwright';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {serve,fixtures,seed,instrument,capturePlayer} from './library-harness.mjs';
const desktop=process.argv.includes('--desktop'),profile=desktop?fs.mkdtempSync(path.resolve('test-results/desktop-v12-')):undefined;
const server=await serve('dist'),browser=desktop?await electron.launch({executablePath:process.env.GUITARIO_DESKTOP_EXECUTABLE || path.resolve('../../Guitar-io-1.2.2-Windows-x64/Guitar.io.exe'),env:{...process.env,GUITARIO_TEST_PROFILE:profile}}):await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=desktop?browser.context():await browser.newContext({viewport:{width:1512,height:960}}),page=desktop?await browser.firstWindow():await context.newPage(),errors=[];
const url=desktop?'guitario://app/':server.url;
page.on('pageerror',e=>errors.push(e.message));const button=name=>page.getByRole('button',{name,exact:true});
await instrument(page);
const songs=fixtures(6,16);songs[5].sectionsByTrack['0']=songs[5].sections=[{id:'intro',name:'Intro',start:1,end:8,color:'#8b79ff',status:'learning',learnedPercent:70,notes:'',speed:1},{id:'verse',name:'Verse',start:9,end:16,color:'#24b8a8',status:'new',learnedPercent:0,notes:'',speed:1}];
try{
  if(desktop)await page.getByText('Start by adding your first guitar',{exact:true}).waitFor();await seed(page,url,songs,desktop);await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.song-card').length===6);
  await page.reload();await button('Preview Synthetic study 005').waitFor();
  assert.equal(await page.locator('.recent-story').count(),6);
  assert.deepEqual(await page.locator('.story-title').allTextContents(),[5,4,3,2,1,0].map(i=>`Synthetic study ${String(i).padStart(3,'0')}`));
  const io=await page.evaluate(()=>window.__io);assert.equal(io['songs.getAll'] || 0,0);assert.equal(io['songSources.get'] || 0,0);assert.equal(io['songs.get'] || 0,0);
  assert(await page.locator('.recent-stories').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.collection-heading').getBoundingClientRect().top));
  await page.screenshot({path:'test-results/v12-library.png'});
  await page.evaluate(()=>{
    window.__storySynths=[];const Native=window.alphaTab.synth.AlphaSynth;window.alphaTab={...window.alphaTab,synth:{...window.alphaTab.synth,AlphaSynth:new Proxy(Native,{construct(Target,args){const synth=new Target(...args);window.__storySynths.push(synth);const destroy=synth.destroy.bind(synth);synth.destroy=()=>{synth.__destroyed=true;destroy();};return synth;}})}};
  });
  await button('Preview Synthetic study 005').click();await page.getByRole('dialog').getByText('35% learnt',{exact:true}).waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Preview progress"]')?.getAttribute('aria-valuenow'))>0);
  assert.equal(await button('Pause preview').count(),0);assert.equal(await button('Resume preview').count(),0);
  const shape=await page.locator('.story-window').boundingBox();assert(shape.height/shape.width>1.7);assert(shape.width<=390.5);
  assert(await page.locator('.story-backdrop').evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur')));
  await page.screenshot({path:'test-results/v12-story.png'});
  await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Synthetic study 004',exact:true})}).waitFor({timeout:15000});
  assert.equal(await page.evaluate(()=>window.__storySynths.length),1,'One synth is reused across automatic previews');
  await button('Close dialog').click();assert(await page.evaluate(()=>window.__storySynths.every(s=>s.__destroyed)));
  await capturePlayer(page);await button('Preview Synthetic study 005').click();await button('Open Synthetic study 005 in full viewer').click();await button('Select bar 16').waitFor();await page.waitForFunction(()=>window.__testApi?.isReadyForPlayback);
  assert.equal(await page.locator('.workspace').count(),1);assert.equal(await page.locator('.story-cover').count(),0);
  await button('Edit Intro').click();await page.getByLabel('Section playback speed',{exact:true}).evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'50');el.dispatchEvent(new Event('input',{bubbles:true}));});await button('Save section').click();
  await page.waitForFunction(()=>window.__testApi.playbackSpeed===.5);await button('Select bar 10').click();await page.waitForFunction(()=>window.__testApi.playbackSpeed===1);await button('Select bar 1').click();await page.waitForFunction(()=>window.__testApi.playbackSpeed===.5);
  await page.getByLabel('Playback speed',{exact:true}).fill('50');await page.getByLabel('Playback speed',{exact:true}).press('Enter');await page.waitForFunction(()=>window.__testApi.playbackSpeed===.25);
  await button('Play').click();await button('Select bar 10').click();await button('Return to library').click();await button('Preview Synthetic study 005').waitFor();
  await page.reload();await button('Open Synthetic study 005').click();await button('Select bar 16').waitFor();await button('Edit Intro').click();assert.equal(await page.getByLabel('Section playback speed',{exact:true}).inputValue(),'50');await button('Cancel section edit').click();
  // A controlled YouTube adapter verifies the calibration flow without a network video.
  await page.evaluate(()=>{window.YT={Player:class{constructor(_el,o){this.time=0;this.rate=1;this.state=2;this.o=o;window.__video=this;queueMicrotask(()=>o.events.onReady({target:this}));}getCurrentTime(){return this.time;}getDuration(){return 400;}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}getAvailablePlaybackRates(){return [.25,.5,.75,1];}setPlaybackRate(r){this.rate=r;this.o.events.onPlaybackRateChange({data:r});}getVolume(){return 75;}setVolume(){}seekTo(s){this.time=s;}playVideo(){this.state=1;}pauseVideo(){this.state=2;}destroy(){this.state=2;}}};});
  await button('Add recording').click();await button('YouTube link').click();await page.getByLabel('YouTube video link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');await button('Add recording').last().click();await button('Edit recording Full song').waitFor();await button('Edit recording Full song').click();
  await page.getByLabel('Recording start offset').fill('10');await button('Save recording').click();
  await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  const stored=await page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});const song=await new Promise(r=>{const q=db.transaction('songs').objectStore('songs').get('fixture-005');q.onsuccess=()=>r(q.result);});db.close();return song;});
  assert.equal(stored.media.recordings[0].offsetSeconds,10);assert(stored.lastPlayedAt);assert(stored.lastOpenedAt);assert.equal(stored.lastPlayedBar,10,'Exit while playing records the last bar');assert.equal('source' in stored,false);
  assert.deepEqual(errors,[]);console.log('PASS v1.2: recent songs, portrait artwork/blur, actual 10-second MIDI progression/cleanup, viewer opening, per-section speed/restore/reload, lazy startup and YouTube offset persistence.');
}finally{if(!desktop)await context.close();await browser.close();await server.close();if(profile){assert(profile.startsWith(path.resolve('test-results')+path.sep));fs.rmSync(profile,{recursive:true,force:true});}}
