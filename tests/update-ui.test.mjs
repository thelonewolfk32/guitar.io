import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {updateAvailability} from '../src/update-state.ts';
const win=new Window({url:'http://localhost'});
Object.assign(globalThis,{window:win,document:win.document,HTMLElement:win.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const {useUpdates,UpdateSettings,UpdateReadyButton}=await import('../src/AppUpdates.tsx');
const idle={stopping:false,booting:false,busy:false,saving:false,player:false,editor:false,syncBusy:false};
const tick=ms=>new Promise(r=>setTimeout(r,ms));
test('force can close views but never bypass an active save, import or initial library load',()=>{
 for(const key of ['saving','busy','booting','stopping'])assert.equal(updateAvailability({...idle,[key]:true}).canForce,false,key);
 for(const key of ['player','editor','syncBusy'])assert.equal(updateAvailability({...idle,[key]:true}).canForce,true,key);
 assert.equal(updateAvailability(idle).reason,'');
});
async function harness(autoUpdate,fn){
 let state={autoUpdate,currentVersion:'1.5.0',latestVersion:'1.5.1',status:'unchecked',message:''},changes,hook;
 const calls={check:0,prepare:0,install:[]},live={...idle};
 window.guitarUpdates={status:async()=>state,check:async()=>{calls.check++;return state={...state,status:'available'};},prepare:async()=>{calls.prepare++;return state={...state,status:'ready'};},install:async options=>{calls.install.push(options);return state={...state,status:'installing'};},settings:async p=>state={...state,...p},onChange:cb=>{changes=cb;return()=>{};}};
 function View(){hook=useUpdates(()=>updateAvailability(live));return React.createElement(React.Fragment,null,React.createElement(UpdateReadyButton,{updates:hook,onClick:()=>{}}),React.createElement(UpdateSettings,{updates:hook,onClose:()=>{}}));}
 const host=document.body.appendChild(document.createElement('div')),root=createRoot(host);
 try{await act(async()=>{root.render(React.createElement(View));await tick(20);});await fn({calls,live,get hook(){return hook;},change:s=>{state={...state,...s};changes(state);}});}finally{await act(()=>root.unmount());host.remove();delete window.guitarUpdates;}
}
test('launch checks with auto-updater OFF; manual check downloads then waits for Install update',()=>harness(false,async ctx=>{
 assert.equal(ctx.calls.check,1);assert.equal(ctx.calls.prepare,0);assert(document.querySelector('button[aria-label="Update ready"]'));
 await act(async()=>ctx.hook.check());assert.equal(ctx.calls.prepare,1);assert.equal(ctx.calls.install.length,0);assert(document.body.textContent.includes('Install update'));
 ctx.live.player=true;await act(async()=>ctx.hook.install());assert.equal(ctx.calls.install.length,0);assert(document.body.textContent.includes('Close the song player'));
 const force=[...document.querySelectorAll('button')].find(b=>b.textContent==='Force install');await act(()=>force.click());assert(document.body.textContent.includes('Unsaved form changes will be discarded'));
 await act(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel').click());assert.equal(ctx.calls.install.length,0);
 ctx.live.player=false;await act(async()=>ctx.hook.install());assert.deepEqual(ctx.calls.install,[{force:false}]);
}));
test('background auto install uses live sync state after it finishes without another React render',()=>harness(true,async ctx=>{
 ctx.live.syncBusy=true;assert.equal(ctx.calls.prepare,1);
 await act(async()=>tick(2100));assert.equal(ctx.calls.install.length,0);
 ctx.live.syncBusy=false;await act(async()=>tick(2100));assert.deepEqual(ctx.calls.install,[{force:false}]);
}));
test('manual download with auto-updater ON still requires explicit installation',()=>harness(true,async ctx=>{
 await act(async()=>ctx.hook.check());await act(async()=>tick(2100));assert.equal(ctx.calls.install.length,0);
 ctx.live.editor=true;await act(async()=>ctx.hook.install());await act(async()=>ctx.hook.install(true));assert.deepEqual(ctx.calls.install,[{force:true}]);
}));
