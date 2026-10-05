import {chromium,_electron as electron} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import * as a from '@coderline/alphatab';
import {serve,seed,capturePlayer} from './library-harness.mjs';
import {songsterrFixture} from './songsterr-fixture.mjs';
import {songsterrScore} from '../src/songsterr-score.ts';
import {makeSong} from '../src/notation.ts';
globalThis.window={alphaTab:a};
const desktop=process.argv.includes('--desktop'),packaged=process.argv.includes('--packaged');
fs.mkdirSync('test-results',{recursive:true});
const version=JSON.parse(fs.readFileSync('package.json')).version,profile=desktop?fs.mkdtempSync(path.resolve('test-results/v142-')):undefined,server=await serve('dist');
const browser=desktop?await electron.launch({executablePath:packaged?path.resolve(`../../Guitar-io-${version}-Windows-x64/Guitar.io.exe`):path.resolve('node_modules/electron/dist/electron.exe'),args:packaged?[]:['.'],env:{...process.env,GUITARIO_TEST_PROFILE:profile}}):await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=desktop?browser.context():await browser.newContext({viewport:{width:1512,height:960}}),page=desktop?await browser.firstWindow():await context.newPage(),url=desktop?'guitario://app/':server.url;
page.setDefaultTimeout(30000);
const button=name=>page.getByRole('button',{name,exact:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const f=songsterrFixture();f.tracks[0].automations.tempo[0].bpm=120;
f.tracks[1]={...f.tracks[0],name:'Solo guitar',tuning:[62,57,53,48,43,38],measures:Array.from({length:4},(_,i)=>({voices:[{beats:[{type:1,dynamic:i%2?'ppp':'fff',text:i===1?'Solo enters here':undefined,notes:[{string:0,fret:7}]}]}]}))};
const score=songsterrScore(f);score.tracks[1].staves[0].bars[1].voices[0].beats[0].text='Solo enters here';
const bytes=new a.exporter.Gp7Exporter().export(score),song={...await makeSong(bytes,'fixture.gp'),source:Array.from(bytes),artworkAssetId:'cover-0',media:{recordings:[{id:'video',label:'Full song',kind:'youtube',purpose:'full',tags:[],offsetSeconds:5,videoId:'dQw4w9WgXcQ',youtubeSync:{enabled:true,source:'manual',videoId:'dQw4w9WgXcQ',points:[{bar:1,seconds:5},{bar:2,seconds:7},{bar:3,seconds:10},{bar:4,seconds:12}]}}]}};
async function number(name,value){const field=page.getByLabel(name,{exact:true});await field.fill(String(value));await field.press('Enter');}
try{
  await page.goto(url);await page.getByText('Start by adding your first guitar',{exact:true}).waitFor();await seed(page,url,[song],true);await page.goto(url);await capturePlayer(page);await button('Open Sync Study').click();await button('Select bar 4').waitFor();await page.waitForFunction(()=>window.__testApi.isReadyForPlayback);
  await number('Playback speed',90);await page.waitForFunction(()=>window.__testApi.playbackSpeed===.9);
  await button('Speed display unit').click();assert.equal(await page.getByLabel('Playback BPM',{exact:true}).inputValue(),'108');
  await number('Playback BPM',80);await page.waitForFunction(()=>Math.abs(window.__testApi.playbackSpeed-2/3)<.000001);
  await button('Select bar 3').click();assert.equal(await page.getByLabel('Playback BPM',{exact:true}).inputValue(),'80','Bar tempo stays internal');
  assert.equal(await page.locator('.song-title-row h1').evaluate(e=>getComputedStyle(e).color),'rgb(231, 233, 235)');
  assert.equal(await page.getByLabel('Playback BPM',{exact:true}).evaluate(e=>getComputedStyle(e).borderRadius),'12px');
  await page.evaluate(()=>window.__workspaceApi=window.__testApi);await button('Player settings').click();await button('Splicer').click();await page.getByLabel('Splicer right part').selectOption('1');
  await page.waitForFunction(()=>document.querySelectorAll('.splice-bar-notation svg').length===8);
  assert.equal(await page.locator('.splice-bar-row').count(),4);assert.equal(await page.getByLabel('Splicer Songsterr URL').count(),0);
  await page.getByLabel('Splicer jump to section').selectOption(song.sections.find(s=>s.name==='Intro').id);
  assert.equal(await page.getByLabel('Splicer jump to section').inputValue(),song.sections.find(s=>s.name==='Intro').id);
  assert.equal(await page.locator('.splice-bar-row').count(),4,'Selection keeps every bar visible');
  await button('Select splice bar 2 on left').click();await button('Select splice bar 3 on right').click({modifiers:['Shift']});
  assert.equal(await page.getByLabel('Splice start bar').inputValue(),'2');assert.equal(await page.getByLabel('Splice end bar').inputValue(),'3');assert.equal(await page.locator('.splice-bar-row.selected').count(),2);assert.equal(await page.locator('.splice-bar-notation svg').count(),8);
  const alignment=await page.locator('.splice-bar-row').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('.splice-bar-notation')].map(cell=>cell.getBoundingClientRect().top+Number(cell.dataset.staffTop)+parseFloat(getComputedStyle(cell).paddingTop))));
  for(const pair of alignment)assert(Math.abs(pair[0]-pair[1])<1,'Tab staff baselines align despite different dynamics/text');
  await button('Import a separate tab').click();assert(await page.getByLabel('Splicer Songsterr URL').isVisible());await button('Import a separate tab').click();
  await page.screenshot({path:`test-results/v142-splicer-${desktop?'desktop':'browser'}.png`});
  await button('Merge notes').click();await button('Splice into left part').click();await page.waitForFunction(()=>document.querySelectorAll('.splice-bar-notation svg').length===4);assert.equal(await page.locator('.splice-bar-row').count(),4);
  await button('Back to comparison').click();await button('Close dialog').click();
  await button('Dark mode').click();await button('Splicer').click();await page.waitForFunction(()=>document.querySelectorAll('.splice-bar-notation svg').length===8);assert(await page.locator('.splicer-score').evaluate(e=>e.classList.contains('dark')));await page.screenshot({path:`test-results/v142-splicer-dark-${desktop?'desktop':'browser'}.png`});await button('Close dialog').click();await page.evaluate(()=>window.__testApi=window.__workspaceApi);
  await context.route('https://www.youtube.com/embed/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><video></video><div class="ytp-settings-menu"><button onclick="document.querySelector('video').playbackRate=.8">80% gear speed</button></div><script>const video=document.querySelector('video');window.movie_player={setPlaybackRate:r=>video.playbackRate=Math.round(r*4)/4};document.getElementById=()=>movie_player;<\/script>`}));
  if(desktop)console.log('Desktop comparison verified; connecting controlled YouTube embed.');
  await page.evaluate(()=>{window.YT={Player:class{constructor(el,o){this.time=0;this.rate=1;this.state=2;this.o=o;window.__video=this;this.frame=document.createElement('iframe');this.frame.src='https://www.youtube.com/embed/'+o.videoId+'?enablejsapi=1';this.frame.onload=()=>o.events.onReady({target:this});el.replaceWith(this.frame);}getIframe(){return this.frame;}getCurrentTime(){return this.time;}getDuration(){return 60;}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}getAvailablePlaybackRates(){return [.25,.5,.75,1,1.25,1.5,2];}setPlaybackRate(r){this.rate=r;this.o.events.onPlaybackRateChange({data:r});}getVolume(){return 75;}setVolume(){}seekTo(s){this.time=s;}playVideo(){this.state=1;}pauseVideo(){this.state=2;}destroy(){this.frame.remove();}}};});
  await page.getByRole('tab',{name:'Full song',exact:true}).click();await page.waitForFunction(()=>window.__video && window.__testApi.player?.output?.handler);
  if(desktop)console.log('Desktop media bridge ready; setting 90% speed.');
  await number('Playback BPM',108);await page.waitForFunction(value=>Math.abs(window.__testApi.playbackSpeed-value)<.00001,desktop?.9:1);
  if(desktop){
    console.log('Desktop 90% accepted; checking native video rate.');
    const frame=page.frames().find(f=>f.url().startsWith('https://www.youtube.com/embed/'));assert(frame);
    await frame.waitForFunction(()=>document.querySelector('video').playbackRate===.9);await number('Playback BPM',80);await frame.waitForFunction(()=>Math.abs(document.querySelector('video').playbackRate-2/3)<.000001);
    await button('Select bar 2').click();await page.waitForFunction(()=>window.__video.time===7);assert.equal(await page.getByLabel('Playback BPM',{exact:true}).inputValue(),'80');
    await frame.getByRole('button',{name:'80% gear speed'}).click();await page.waitForFunction(()=>window.__testApi.playbackSpeed===.8);assert.equal(await page.getByLabel('Playback BPM',{exact:true}).inputValue(),'96');
    // Cross-origin frames cannot invoke native IPC, and unrelated messages cannot change speed.
    assert.equal(await frame.evaluate(()=>typeof window.guitarIO),'undefined');
    await page.evaluate(()=>window.postMessage({type:'guitario-youtube-rate',videoId:'dQw4w9WgXcQ',rate:.4},'*'));assert.equal(await page.evaluate(()=>window.__testApi.playbackSpeed),.8);
    await frame.evaluate(()=>document.querySelector('video').__guitarioControl.disabled=true);
    await number('Playback BPM',80);await page.waitForFunction(()=>window.__testApi.playbackSpeed===.75 && window.__video.rate===.75);assert.equal(await page.getByLabel('Playback BPM',{exact:true}).inputValue(),'90','Fine-control failure shows the applied standard speed');
  }
  await button('Edit recording Full song').click();await page.locator('.youtube-sync-editor summary').click();assert.equal(await page.getByLabel('Sync seconds 2').inputValue(),'7');assert.equal(await page.getByLabel('Sync seconds 4').inputValue(),'12');
  assert(await page.locator('.youtube-sync-list').evaluate(e=>e.scrollWidth<=e.clientWidth),'Sync controls fit without clipped trash icons');
  assert((await page.getByRole('dialog').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('gradient'));await page.screenshot({path:`test-results/v142-recording-${desktop?'desktop':'browser'}.png`});await button('Close dialog').click();
  assert.deepEqual(errors,[]);console.log(`PASS V1.4.2 ${desktop?'desktop':'browser'}: equivalent BPM/% speeds, stable reference BPM, full-score aligned comparison, click/shift-click, section label, light/dark, import toggle, full preview, menu theme${desktop?', exact native rates, raw anchors retained, gear feedback and frame isolation':''}.`);
}catch(error){console.log('Acceptance failure state:',await page.evaluate(()=>({speed:window.__testApi?.playbackSpeed,playerReady:window.__testApi?.isReadyForPlayback,frame:document.querySelector('.youtube-frame iframe')?.src,video:!!window.__video,error:document.querySelector('.media-panel .form-error')?.textContent,field:document.querySelector('[aria-label="Playback BPM"]')?.value})).catch(()=>({closed:true})));throw error;
}finally{if(!desktop)await context.close();await browser.close();await server.close();if(profile){assert(profile.startsWith(path.resolve('test-results')+path.sep));fs.rmSync(profile,{recursive:true,force:true});}}
