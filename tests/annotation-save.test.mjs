/** A slow save must not lose the following text, color or move gesture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import React, { act, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
const win=new Window({url:'http://localhost:5173',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
Object.assign(globalThis,{window:win,document:win.document,HTMLElement:win.HTMLElement,HTMLInputElement:win.HTMLInputElement,HTMLTextAreaElement:win.HTMLTextAreaElement,requestAnimationFrame:cb=>setTimeout(()=>cb(performance.now()),20),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true});
win.alphaTab=alphaTab;
const {createRoot}=await import('react-dom/client');
const {default:NotationTools}=await import('../src/NotationTools.tsx');
const {makeSong}=await import('../src/notation.ts');
const settle=()=>new Promise(r=>setTimeout(r,10));
test('annotation text, color and consecutive moves survive queued slow saves',async()=>{
  const song=await makeSong(new TextEncoder().encode('. 0.6.4'),'annotation.alphatex');
  song.annotations=[{id:'annotation:test',track:0,bar:1,text:'Original text',color:'#efc666',free:true}];
  song.annotationPositions={'annotation:test':{x:0,y:0}};
  const container=document.body.appendChild(document.createElement('div')),host=document.body.appendChild(document.createElement('div')),root=createRoot(host),writes=[],release=[],errors=[];
  function Harness(){const [current,setSong]=useState(song);return React.createElement(NotationTools,{song:current,score:null,api:null,boxes:[{bar:1,x:0,y:0,width:200,height:100}],revision:0,rendering:false,range:{start:1,end:1},selectionRevision:0,onRange:()=>{},container,toolbar:null,sectionUndoTime:0,onUndoSection:async()=>{},notify:message=>errors.push(message),onSave:async next=>{writes.push(next);await new Promise(resolve=>release.push(resolve));setSong(next);}});}
  const button=name=>container.querySelector(`[aria-label="${name}"]`);
  try{
    await act(async()=>root.render(React.createElement(Harness)));
    const input=button('Text note');
    await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype,'value').set.call(input,'Fresh text');input.dispatchEvent(new win.Event('input',{bubbles:true}));});
    await act(async()=>{input.dispatchEvent(new win.FocusEvent('focusout',{bubbles:true}));button('Highlight text note').click();});
    await act(async()=>{button('Highlight #94c4f2').click();const grip=button('Move text note');grip.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));grip.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await settle();});
    assert.equal(writes.length,1,'later saves wait for the first save');
    for(let i=0;i<4;i++){assert.ok(release[i],`save ${i+1} started`);await act(async()=>{release[i]();await settle();});}
    const saved=writes.at(-1);
    assert.equal(saved.annotations[0].text,'Fresh text');assert.equal(saved.annotations[0].color,'#94c4f2');assert.deepEqual(saved.annotationPositions['annotation:test'],{x:10,y:0});assert.deepEqual(errors,[]);
  }finally{await act(async()=>root.unmount());await win.happyDOM.close();}
});
