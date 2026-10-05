import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {youtubeFrame,rateScript}=createRequire(import.meta.url)('../electron/youtube-rate.cjs');

test('fine YouTube rates apply to the selected video and preserve pitch with actual-rate feedback',()=>{
  const listeners=[],messages=[],video={playbackRate:1,addEventListener:(event,fn)=>{if(event==='ratechange')listeners.push(fn);}};
  const context=vm.createContext({performance,document:{addEventListener:()=>{},querySelector:()=>video,getElementById:()=>({setPlaybackRate:value=>video.playbackRate=Math.round(value*4)/4})},parent:{postMessage:value=>messages.push(value)}});
  for(const rate of [.9,80/120,.37,1.1])assert.equal(vm.runInContext(rateScript('dQw4w9WgXcQ',rate),context),rate);
  assert.equal(video.preservesPitch,true);assert.equal(listeners.length,1);assert.equal(messages.at(-1).rate,1.1);
  video.__guitarioControl.userAction=performance.now();video.playbackRate=.8;listeners[0]();assert.equal(messages.at(-1).rate,.8,'Gear changes report actual speed');
  vm.runInContext(rateScript('dQw4w9WgXcQ',.9,10),context);
  vm.runInContext(rateScript('dQw4w9WgXcQ',.5,9),context);
  assert.equal(video.playbackRate,.9,'A late older request cannot revert the latest speed');
  assert.equal(messages.at(-1).request,10);assert.equal(messages.at(-1).requested,true);
  video.playbackRate=.75;listeners[0]();assert.equal(video.playbackRate,.9,'Media loading retains the selected fine rate');
  video.__guitarioControl.disabled=true;assert.equal(vm.runInContext(rateScript('dQw4w9WgXcQ',.8,11),context),null);
});
test('native speed bridge rejects code/URLs/rates outside the selected HTTPS YouTube embed',()=>{
  const good={url:'https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1'},wrong={url:'https://evil.test/embed/dQw4w9WgXcQ'};
  assert.equal(youtubeFrame({mainFrame:{framesInSubtree:[wrong,good]}},'dQw4w9WgXcQ'),good);
  for(const rate of [NaN,Infinity,.1,2.1,'0.9'])assert.throws(()=>rateScript('dQw4w9WgXcQ',rate));
  assert.throws(()=>rateScript('x;alert(1)',1));assert.throws(()=>youtubeFrame({mainFrame:{framesInSubtree:[]}},'https://evil.test/'));
  assert.equal(youtubeFrame({mainFrame:{framesInSubtree:[wrong,{url:'http://www.youtube.com/embed/dQw4w9WgXcQ'}]}},'dQw4w9WgXcQ'),undefined);
});
