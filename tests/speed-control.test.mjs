import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import React,{act,useState} from 'react';
import {steppedRate,supportedRate} from '../src/playback-timing.ts';

test('user speeds and combined section rates snap to 5% while precise timing helpers stay exact',()=>{
 for(const [input,output] of [[.927,.95],[.92,.9],[80/120,.65],[.95*.95,.9],[.65*.75,.5],[.001,.1],[3,2]])assert.equal(steppedRate(input),output);
 assert.equal(steppedRate(.001,undefined,.25),.25);
 assert.equal(steppedRate(.65,[.25,.5,.75,1],.25),.75);
 assert.equal(supportedRate(.375),.375,'Raw timing calculations are not quantised');
});

const win=new Window({url:'http://localhost:5173'});
Object.assign(globalThis,{window:win,document:win.document,HTMLElement:win.HTMLElement,HTMLInputElement:win.HTMLInputElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client'),{default:SpeedControl}=await import('../src/SpeedControl.tsx');
test('percentage and BPM inputs apply the same snapped speed and show the actual result',async()=>{
 const host=document.body.appendChild(document.createElement('div')),root=createRoot(host),applied=[];
 function Harness(){const [speed,setSpeed]=useState(1);return React.createElement(SpeedControl,{speed,bpm:120,onChange:value=>{applied.push(value);setSpeed(value);}});}
 const input=label=>host.querySelector(`[aria-label="${label}"]`);
 async function enter(label,value){await act(async()=>{const field=input(label);Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new win.Event('input',{bubbles:true}));});await act(async()=>input(label).dispatchEvent(new win.FocusEvent('focusout',{bubbles:true})));}
 try{
  await act(async()=>root.render(React.createElement(Harness)));
  assert.equal(input('Playback speed slider').step,'5');assert.equal(input('Playback speed').step,'5');
  await enter('Playback speed','92.7');assert.equal(applied.at(-1),.95);assert.equal(input('Playback speed').value,'95');
  await act(async()=>input('Speed display unit').click());assert.equal(input('Playback BPM').step,'6');
  await enter('Playback BPM','80');assert.equal(applied.at(-1),.65);assert.equal(input('Playback BPM').value,'78');
  await enter('Playback BPM','0');assert.equal(applied.at(-1),.65);assert.equal(input('Playback BPM').value,'78');
  await act(async()=>input('Speed display unit').click());assert.equal(input('Playback speed').value,'65');
 }finally{await act(async()=>root.unmount());await win.happyDOM.close();}
});
