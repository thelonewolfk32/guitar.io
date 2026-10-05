import {chromium,_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {serve,fixtures,seed,instrument,capturePlayer} from './library-harness.mjs';
import {songsterrFixture} from './songsterr-fixture.mjs';
const desktop=process.argv.includes('--desktop'),dev=process.argv.includes('--dev'),version=JSON.parse(fs.readFileSync('package.json')).version;
fs.mkdirSync('test-results',{recursive:true});
const profile=desktop?fs.mkdtempSync(path.resolve('test-results/desktop-v13-')):undefined,server=dev?{url:'http://127.0.0.1:5176',close:async()=>{}}:await serve('dist');
const browser=desktop?await electron.launch({executablePath:path.resolve('../../Guitar-io-'+version+'-Windows-x64/Guitar.io.exe'),env:{...process.env,GUITARIO_TEST_PROFILE:profile}}):await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=desktop?browser.context():await browser.newContext({viewport:{width:1512,height:960}}),page=desktop?await browser.firstWindow():await context.newPage(),url=desktop?'guitario://app/':server.url;
const button=name=>page.getByRole('button',{name,exact:true}),f=songsterrFixture(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await instrument(page);await page.goto(url);await page.getByText('Start by adding your first guitar',{exact:true}).waitFor();await seed(page,url,fixtures(1,4),true);await page.goto(url);await button('Open Synthetic study 000').waitFor();
  if(desktop)await browser.evaluate(({net},f)=>{const native=net.fetch.bind(net);globalThis.__songsterrRequests=0;net.fetch=(url,options)=>{
    if(String(url).includes('/api/meta/123')){globalThis.__songsterrRequests++;return Promise.resolve(Response.json({...f.meta,revisionId:456,image:'test-image',tracks:f.tracks}));}
    if(String(url).includes('.cloudfront.net/123/456/test-image/')){globalThis.__songsterrRequests++;return Promise.resolve(Response.json(f.tracks[Number(/(\d+)\.json$/.exec(url)[1])]));}
    if(String(url).includes('/api/video-points/123/456/list')){globalThis.__songsterrRequests++;return Promise.resolve(Response.json(f.videos.map(v=>({...v,status:'done',feature:null}))));}
    return native(url,options);
  };},f);
  else await page.evaluate(f=>{window.__songsterrRequests=0;window.guitarIO={downloadSongsterr:async()=>{window.__songsterrRequests++;return f;},songsterrSync:async()=>{window.__songsterrRequests++;return f;}};},f);
  await button('Add songs').click();
  await page.getByLabel('Songsterr song link').evaluate((el,url)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',url);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));},f.url);
  await button('Open Sync Study').waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  if(desktop)assert.equal(await browser.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1,'Import never opens an external downloader window');
  const requestsBefore=desktop?await browser.evaluate(()=>globalThis.__songsterrRequests):await page.evaluate(()=>window.__songsterrRequests);
  assert.equal(requestsBefore,desktop?5:1);
  await capturePlayer(page);await button('Open Sync Study').click();await button('Select bar 4').waitFor();await page.waitForFunction(()=>window.__testApi?.isReadyForPlayback);
  assert.equal(await page.evaluate(()=>window.__testApi.score.tempo),137);
  await button('Edit Intro').click();assert(!/Applies to MIDI only/.test(await page.locator('.section-speed').textContent()));
  await page.getByLabel('Section playback speed',{exact:true}).focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  await button('Save section').click();await page.waitForFunction(()=>window.__testApi.playbackSpeed===.5);
  await page.getByRole('tab',{name:'MIDI',exact:true}).focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.__testApi.player.state===window.alphaTab.synth.PlayerState.Playing);
  await button('Player settings').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.__testApi.player.state===window.alphaTab.synth.PlayerState.Paused);assert.equal(await page.locator('.player-settings').count(),0,'Space does not activate a focused button');
  await page.evaluate(()=>{window.YT={Player:class{constructor(el,o){this.time=0;this.rate=1;this.state=2;this.o=o;window.__video=this;const frame=document.createElement('iframe');frame.title='Controlled YouTube test';el.replaceWith(frame);queueMicrotask(()=>o.events.onReady({target:this}));}getCurrentTime(){return this.time;}getDuration(){return 60;}getPlayerState(){return this.state;}getPlaybackRate(){return this.rate;}getAvailablePlaybackRates(){return [.25,.5,.75,1,1.25,1.5,2];}setPlaybackRate(r){this.rate=r;this.o.events.onPlaybackRateChange({data:r});}getVolume(){return 75;}setVolume(){}seekTo(s){this.time=s;}playVideo(){this.state=1;}pauseVideo(){this.state=2;}destroy(){this.state=2;}}};});
  await page.getByRole('tab',{name:'Songsterr video 1',exact:true}).click();await page.waitForFunction(()=>window.__testApi.player.output.handler && window.__video.rate===.5);
  await button('Select bar 3').click();await page.waitForFunction(()=>Math.abs(window.__video.time-10)<.01 && window.__video.rate===1,null,{timeout:4000});
  await button('Select bar 2').click();await page.waitForFunction(()=>Math.abs(window.__video.time-7)<.01 && window.__video.rate===.5);
  await button('Edit recording Songsterr video 1').click();await page.locator('.youtube-sync-editor summary').click();assert.equal(await page.getByLabel('Sync seconds 3').inputValue(),'10');await page.getByLabel('Recording name').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.__video.state===1);await page.keyboard.press('Space');await page.waitForFunction(()=>window.__video.state===2);
  await page.screenshot({path:'test-results/v13-youtube-sync.png'});
  const writes=await page.evaluate(()=>window.__io['songSources.put']);await page.getByLabel('Sync seconds 3').fill('11');await button('Save recording').click();await button('Select bar 3').click();await page.waitForFunction(()=>Math.abs(window.__video.time-11)<.01);assert.equal(await page.evaluate(()=>window.__io['songSources.put']),writes);
  await button('Player settings').click();assert.equal(await page.getByLabel('Song default BPM').count(),0);
  await button('Song map').click();assert(!/Read left to right|Click a section to select/.test(await page.getByRole('dialog').textContent()));await button('Close dialog').click();
  await button('Suggest sections').click();assert(!/Quick hints|Repeated phrases get matching/.test(await page.getByRole('dialog').textContent()));await button('Close dialog').click();
  await button('Return to library').click();await button('Open Sync Study').click();await button('Select bar 4').waitFor();await page.getByRole('tab',{name:'Songsterr video 1',exact:true}).click();await button('Select bar 3').click();await page.waitForFunction(()=>Math.abs(window.__video.time-11)<.01);
  assert.equal(desktop?await browser.evaluate(()=>globalThis.__songsterrRequests):await page.evaluate(()=>window.__songsterrRequests),requestsBefore,'Saved timing data plays without refetching');
  assert.deepEqual(errors,[]);console.log('PASS V1.3 '+(desktop?'Windows':'browser')+': paste-to-import, no extra window, correct tuning/tempo, variable bar timing, section speeds with complete YouTube points, Space from controls/settings, editing/reopen without source writes or refetches, cleaned section copy.');
} finally {
  if(!desktop)await context.close();await browser.close();await server.close();if(profile){assert(profile.startsWith(path.resolve('test-results')+path.sep));fs.rmSync(profile,{recursive:true,force:true});}
}
