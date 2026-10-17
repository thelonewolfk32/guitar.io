import test from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';import {fixtures} from './library-harness.mjs';import {saveSongs,readLibraryIndex,readSong,removeSong,switchStorageScope,mergeGuestLibrary,setWriteGuard} from '../src/storage.ts';import {installLibraryPolicy,chooseActive,isEntryActive,captureShare,completePending,entries,readDrafts,refreshEntries} from '../src/library-access.ts';import {syncSetting,setIncomingGuard} from '../src/sync-storage.ts';import {account} from '../src/account.ts';import {entitlementFor} from '../src/plans.ts';import {usage,setUsageConsent,flushUsage} from '../src/usage.ts';import {BridgeAssembler,chunkMessage} from '../shared/score-bridge.ts';
test('library policy preserves legacy archives, enforces all saved entries and completes a pending song in place',async()=>{
 const oldWindow=globalThis.window;globalThis.window={dispatchEvent:()=>{}};const songs=fixtures(7,4).map(s=>({...s,source:new Uint8Array(s.source)}));
 try{
 await saveSongs(songs.slice(0,6),true);installLibraryPolicy();assert.equal(await isEntryActive(songs[0].id),false);await chooseActive(songs.slice(0,5).map(s=>s.id));assert.equal(await isEntryActive(songs[0].id),true);assert.equal(await isEntryActive(songs[5].id),false);
 await saveSongs([{...songs[0],title:'Edited offline'}]);await assert.rejects(saveSongs([songs[6]],true),/limit/);assert.deepEqual((await readDrafts())[0].song.source,songs[6].source);
 await removeSong(songs[5].id);await assert.rejects(captureShare('https://youtu.be/abcdefghijk'),/limit/);await removeSong(songs[4].id);
 const pending=await captureShare('https://youtu.be/abcdefghijk','Shared fixture');assert.equal((await entries()).length,5);
 await saveSongs([{...songs[6],id:pending.id,sharedLink:pending.link}],true);await completePending(pending.id);assert.equal((await entries()).length,5);assert.deepEqual((await readSong(pending.id)).source,songs[6].source);await assert.rejects(captureShare('https://youtu.be/abcdefghijk'),/already in your library/);
 }finally{setWriteGuard(undefined);setIncomingGuard(undefined);globalThis.window=oldWindow;}
});
test('account workspaces isolate songs and verified guest copy preserves the original workspace',async()=>{
 const a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';await switchStorageScope(a);assert.equal((await readLibraryIndex()).songs.length,0);await saveSongs(fixtures(1,4).map(s=>({...s,source:new Uint8Array(s.source)})));await switchStorageScope(b);assert.equal((await readLibraryIndex()).songs.length,0);await mergeGuestLibrary();assert.equal((await readLibraryIndex()).songs.length,5);await switchStorageScope(a);assert.equal((await readLibraryIndex()).songs.length,1);await switchStorageScope('');assert.equal((await readLibraryIndex()).songs.length,5);
});
test('usage opt-in serialises counts arriving during a flush, and opt-out clears unsent events',async()=>{
 const old={session:account.session,request:account.request,entitlement:account.entitlement};const id='00000000-0000-4000-8000-000000000013';await switchStorageScope(id);account.session={user:{id}};account.entitlement=entitlementFor();const sent=[];
 account.request=async(route,body)=>{if(route==='usage')sent.push(structuredClone(body));return {};};
 try{await setUsageConsent(true);await usage('score_open');await Promise.all([flushUsage(),usage('manual_import')]);await flushUsage();assert.equal(sent[0].counts.score_open,1);assert.equal(sent[1].counts.manual_import,1);assert(!JSON.stringify(sent).includes(id));await usage('learn_open');await setUsageConsent(false);assert.equal(await syncSetting('usage-outbox'),null);await usage('score_open');assert.equal(await syncSetting('usage-outbox'),null);}
 finally{account.session=old.session;account.request=old.request;account.entitlement=old.entitlement;await switchStorageScope('');}
});
test('score bridge reassembles large binary payloads and rejects out-of-order or oversized chunks',()=>{
 const value={base64:'a'.repeat(300000),title:'Dotted quarter ♪'},parts=chunkMessage('fixture',value),a=new BridgeAssembler();let decoded;for(const part of parts)decoded=a.accept(part);assert.deepEqual(decoded,value);assert.throws(()=>new BridgeAssembler().accept(parts[1]),/order/);assert.throws(()=>new BridgeAssembler().accept({...parts[0],total:99999}),/Invalid/);
});

test('cloud catalogue tombstones remove shared links captured on another device',async()=>{
 const old={session:account.session,request:account.request};const id='00000000-0000-4000-8000-000000000014';await switchStorageScope(id);account.session={user:{id}};let deleted=false;
 account.request=async(route,body)=>route==='entries'?{entries:[{id:'shared-deleted',kind:'pending',active:!deleted,deleted,details:{title:'Shared',link:{provider:'youtube',id:'abcdefghijk',url:'https://youtu.be/abcdefghijk'}}}]}:{};
 try{await refreshEntries();assert.equal((await entries()).length,1);deleted=true;await refreshEntries();assert.equal((await entries()).length,0);}
 finally{account.session=old.session;account.request=old.request;await switchStorageScope('');}
});
