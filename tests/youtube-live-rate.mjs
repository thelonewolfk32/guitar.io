// Optional live smoke test: streams the official IFrame API sample, never downloads media.
import {_electron as electron} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {seed,fixtures,capturePlayer} from './library-harness.mjs';
fs.mkdirSync('test-results',{recursive:true});const profile=fs.mkdtempSync(path.resolve('test-results/youtube-live-'));
const browser=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['.'],env:{...process.env,GUITARIO_TEST_PROFILE:profile}}),page=await browser.firstWindow();page.setDefaultTimeout(20000);
const button=name=>page.getByRole('button',{name,exact:true}),song=fixtures(1,4)[0],videoId='M7lc1UVf-VE';
let liveFrame;
song.media={recordings:[{id:'demo',kind:'youtube',videoId,label:'YouTube API sample',purpose:'full',tags:[],offsetSeconds:0}]};
try{
  await page.getByText('Start by adding your first guitar',{exact:true}).waitFor();await seed(page,'guitario://app/',[song],true);await page.goto('guitario://app/');await capturePlayer(page);await button(`Open ${song.title}`).click();await button('Select bar 4').waitFor();await page.getByRole('tab',{name:'YouTube API sample',exact:true}).click();
  await page.waitForFunction(()=>window.__testApi?.player?.output?.handler && document.querySelector('[aria-label="Playback speed slider"]')?.max==='200');
  const frame=liveFrame=page.frames().find(f=>f.url().startsWith('https://www.youtube.com/embed/'));assert(frame);
  console.log('Live embed initial:',await frame.evaluate(()=>({rate:document.querySelector('video')?.playbackRate,available:document.getElementById('movie_player')?.getAvailablePlaybackRates?.()})));
  for(const value of [90,110,66.66666666666667]){
    await page.getByLabel('Playback speed',{exact:true}).fill(String(value));await page.getByLabel('Playback speed',{exact:true}).press('Enter');await frame.waitForFunction(rate=>Math.abs(document.querySelector('video').playbackRate-rate)<.000001,value/100);console.log('Live rate applied:',value);
  }
  await frame.evaluate(()=>{const player=document.getElementById('movie_player');player.setVolume(0);player.playVideo();});
  await frame.waitForFunction(()=>!document.querySelector('video').paused && document.querySelector('video').currentTime>.5);
  const before=await frame.evaluate(()=>({time:document.querySelector('video').currentTime,wall:performance.now()}));
  await page.waitForTimeout(2000);
  const after=await frame.evaluate(()=>({time:document.querySelector('video').currentTime,wall:performance.now(),rate:document.querySelector('video').playbackRate}));
  assert(Math.abs(after.rate-2/3)<.000001);assert(Math.abs((after.time-before.time)/((after.wall-before.wall)/1000)-2/3)<.15);
  console.log('PASS actual YouTube embed: 90%, 110%, 120→80 BPM speed and muted playback clock',after);
}catch(error){console.log('LIVE CHECK LIMITATION:',error.message,await page.locator('.media-panel .form-error').allTextContents(),await liveFrame?.evaluate(()=>({rate:document.querySelector('video')?.playbackRate,wanted:document.querySelector('video')?.__guitarioRequestedRate,request:document.querySelector('video')?.__guitarioRequest,paused:document.querySelector('video')?.paused,duration:document.querySelector('video')?.duration,time:document.querySelector('video')?.currentTime,publicRate:document.getElementById('movie_player')?.getPlaybackRate?.(),text:document.body.innerText.slice(0,1000)})));process.exitCode=2;
}finally{await browser.close();assert(profile.startsWith(path.resolve('test-results')+path.sep));fs.rmSync(profile,{recursive:true,force:true});}
