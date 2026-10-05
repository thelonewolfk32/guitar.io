import {chromium,_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {serve,fixtures,seed,capturePlayer} from './library-harness.mjs';

const desktop=process.argv.includes('--desktop'),profile=desktop?fs.mkdtempSync(path.resolve('test-results/desktop-v124-')):undefined;
const version=JSON.parse(fs.readFileSync('package.json')).version,server=await serve('dist');
const browser=desktop?await electron.launch({executablePath:path.resolve(process.env.GUITARIO_OUTPUT_DIR || 'release/artifacts',`Guitar-io-${version}-Windows-x64/Guitar.io.exe`),env:{...process.env,GUITARIO_TEST_PROFILE:profile}}):await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=desktop?browser.context():await browser.newContext({viewport:{width:1512,height:960}}),page=desktop?await browser.firstWindow():await context.newPage(),url=desktop?'guitario://app/':server.url;
const button=name=>page.getByRole('button',{name,exact:true}),song=fixtures(1,16)[0],errors=[];
song.sections=song.sectionsByTrack['0']=[{id:'intro',name:'Intro',start:1,end:8,color:'#8b79ff',status:'new',learnedPercent:0,notes:'',speed:.5},{id:'verse',name:'Verse',start:9,end:16,color:'#24b8a8',status:'new',learnedPercent:0,notes:'',speed:.75}];
song.media={recordings:[{id:'full',kind:'youtube',purpose:'full',label:'Full song',tags:[],offsetSeconds:5,videoId:'dQw4w9WgXcQ',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'},{id:'backing',kind:'audio',purpose:'backing',label:'Backing track',tags:[],offsetSeconds:0,assetId:'test-audio',name:'Controlled audio'}]};
page.on('pageerror',e=>errors.push(e.message));
async function rate(value){const input=page.getByLabel('Playback speed',{exact:true});await input.fill(String(value*100));await input.press('Enter');}
async function seek(bar){await button(`Select bar ${bar}`).click();}
async function expectRate(value,source){await page.waitForFunction(({value,source})=>Math.abs(window.__testApi.playbackSpeed-value)<.0001 && (source==='youtube'?window.__video?.rate===value:source==='audio'?document.querySelector('audio')?.playbackRate===value:true),{value,source});}
try{
  if(desktop)await page.getByText('Start by adding your first guitar',{exact:true}).waitFor();await seed(page,url,[song],desktop);
  // A real PCM audio fixture exercises HTMLAudioElement playback, rate and seeks.
  await page.evaluate(async()=>{
    const samples=8000*90,bytes=new ArrayBuffer(44+samples*2),v=new DataView(bytes),text=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
    text(0,'RIFF');v.setUint32(4,36+samples*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples*2,true);
    for(let i=0;i<samples;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*110/8000)*500,true);
    const db=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});await new Promise((r,j)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put({id:'test-audio',kind:'audio',mime:'audio/wav',name:'Test audio',blob:new Blob([bytes],{type:'audio/wav'})});tx.oncomplete=r;tx.onerror=()=>j(tx.error);});db.close();
  });
  await page.goto(url);await button(`Open ${song.title}`).waitFor();await capturePlayer(page);await button(`Open ${song.title}`).click();await button('Select bar 16').waitFor();await page.waitForFunction(()=>window.__testApi?.isReadyForPlayback);
  await expectRate(.5);await rate(.75);await expectRate(.375);await seek(10);await expectRate(.5625);await seek(1);await expectRate(.375);
  await page.evaluate(()=>{window.YT={Player:class{constructor(el,o){this.time=0;this.rate=1;this.state=2;this.o=o;window.__video=this;const frame=document.createElement('iframe');frame.title='Controlled YouTube test';el.replaceWith(frame);queueMicrotask(()=>o.events.onReady({target:this}));}getCurrentTime(){return this.time;}getDuration(){return 400;}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}getAvailablePlaybackRates(){return [.25,.5,.75,1];}setPlaybackRate(r){this.rate=r;this.o.events.onPlaybackRateChange({data:r});}getVolume(){return 75;}setVolume(){}seekTo(s){this.time=s;}playVideo(){this.state=1;}pauseVideo(){this.state=2;}destroy(){this.state=2;}}};});
  await page.getByRole('tab',{name:'Full song',exact:true}).click();await expectRate(.75,'youtube');assert.equal(await page.locator('.section-rate-badge').count(),0);await seek(10);await expectRate(.75,'youtube');await seek(1);await expectRate(.75,'youtube');
  await page.evaluate(()=>window.__video.setPlaybackRate(.5));await expectRate(.5,'youtube');assert.equal(await page.getByLabel('Playback speed',{exact:true}).inputValue(),'50');await seek(10);await expectRate(.5,'youtube');
  await page.getByRole('tab',{name:'Backing track',exact:true}).click();await expectRate(.5,'audio');await rate(.75);await expectRate(.75,'audio');await seek(1);await expectRate(.75,'audio');await button('Play').click();await page.waitForFunction(()=>!document.querySelector('audio').paused && document.querySelector('audio').currentTime>.25);await seek(10);await expectRate(.75,'audio');await button('Pause').click();
  await page.getByRole('tab',{name:'MIDI',exact:true}).click();await page.waitForFunction(()=>window.__testApi.settings.player.playerMode===window.alphaTab.PlayerMode.EnabledSynthesizer && window.__testApi.isReadyForPlayback);await seek(10);await expectRate(.5625);await seek(1);await expectRate(.375);assert.equal(await page.locator('.section-rate-badge').textContent(),'×0.5');
  await button('Player settings').click();assert.equal(await page.getByLabel('Song default BPM').count(),0);await button('Edit Intro').click();await page.getByLabel('Section playback speed',{exact:true}).waitFor();assert((await page.locator('.section-speed').textContent()).includes('Section speed'));await button('Cancel section edit').click();
  await button('Return to library').click();await button(`Open ${song.title}`).click();await button('Select bar 16').waitFor();await expectRate(.5);
  assert.deepEqual(errors,[]);console.log(`PASS v1.2.4 ${desktop?'Windows':'browser'}: MIDI section speeds, constant full-song YouTube/audio backing rates, native rate changes, source switching, real audio playback, hidden tempo editor and responsive layout.`);
}finally{if(!desktop)await context.close();await browser.close();await server.close();if(profile){assert(profile.startsWith(path.resolve('test-results')+path.sep));fs.rmSync(profile,{recursive:true,force:true});}}
