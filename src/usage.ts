import {account} from './account';
import {syncSetting,setSyncSetting} from './sync-storage';
import {storageScope} from './storage';
export const USAGE_EVENTS=['score_open','manual_import','share_capture','auto_sections','sync_complete','learn_open','feedback_sent'] as const;
type UsageEvent=typeof USAGE_EVENTS[number];
let serial:Promise<unknown>=Promise.resolve();
function exclusive<T>(task:()=>Promise<T>):Promise<T>{const result=serial.then(task);serial=result.catch(()=>{});return result;}
export async function usageEnabled(){return await syncSetting<boolean>('usage-consent')===true;}
export function usage(event:UsageEvent){return exclusive(async()=>{if(!USAGE_EVENTS.includes(event)||!await usageEnabled())return;const batch=await syncSetting<any>('usage-outbox')||{batchId:crypto.randomUUID(),counts:{}};batch.counts[event]=Math.min(100,(batch.counts[event]||0)+1);await setSyncSetting('usage-outbox',batch);});}
export function setUsageConsent(enabled:boolean){return exclusive(async()=>{if(!enabled){await setSyncSetting('usage-consent',false);await setSyncSetting('usage-outbox',null);}if(!account.session)throw Error('Sign in to save your usage preference.');await account.request('usage-consent',{enabled});if(enabled)await setSyncSetting('usage-consent',true);});}
export function flushUsage(){return exclusive(async()=>{if(!account.session||storageScope()!==account.session.user.id||!await usageEnabled())return;const batch=await syncSetting<any>('usage-outbox');if(!batch)return;await account.request('usage',batch);await setSyncSetting('usage-outbox',null);});}
