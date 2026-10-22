import type {PracticeEvent} from './education';
import {syncSetting,setSyncSetting} from './sync-storage';
import {account} from './account';
import {storageScope} from './storage';
let serial:Promise<unknown>=Promise.resolve();
function exclusive<T>(task:()=>Promise<T>){const result=serial.then(task);serial=result.catch(()=>{});return result;}
export function practice(songId:string,kind:PracticeEvent['kind'],data:Omit<PracticeEvent['data'],'at'>){if(typeof window!=='undefined'&&(window as any).guitarNativePractice){(window as any).guitarNativePractice(songId,kind,data);return Promise.resolve();}const scope=storageScope();return exclusive(async()=>{if(scope!==storageScope())return;const events=await syncSetting<PracticeEvent[]>('practice-outbox')||[];events.push({id:crypto.randomUUID(),version:1,songId,kind,data:{...data,at:new Date().toISOString()}});await setSyncSetting('practice-outbox',events);});}
export function flushPractice(){const scope=storageScope();return exclusive(async()=>{if(!account.session||scope!==storageScope()||scope!==account.session.user.id)return;const events=await syncSetting<PracticeEvent[]>('practice-outbox')||[];for(let i=0;i<events.length;i+=100)await account.request('practice',{events:events.slice(i,i+100)});if(scope===storageScope())await setSyncSetting('practice-outbox',[]);});}
