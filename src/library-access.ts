import {account} from './account';
import {featureAccess,canAddEntries} from './plans';
import {db,readLibraryIndex,setWriteGuard,storageScope} from './storage';
import {syncSetting,setSyncSetting,req,done,setIncomingGuard} from './sync-storage';
import {newPendingSong,type PendingSong} from './share-model';
export type Entry={id:string;kind:'pending'|'score';active:boolean;deleted?:boolean;details?:any};
export async function pendingSongs():Promise<PendingSong[]>{return await syncSetting<PendingSong[]>('pending-songs')||[];}
export async function entries():Promise<Entry[]>{const [index,pending]=await Promise.all([readLibraryIndex(),pendingSongs()]);return [...index.songs.map(s=>({id:s.id,kind:'score' as const,active:true,details:{title:s.title}})),...pending.filter(p=>!index.songs.some(s=>s.id===p.id)).map(p=>({id:p.id,kind:'pending' as const,active:true,details:p}))];}
export async function isEntryActive(id:string){const all=await entries(),limit=featureAccess(account.entitlement).limits.songs;if(limit===null||all.length<=limit)return true;const selected=await syncSetting<string[]>('active-entries');return !!selected&&selected.length<=limit&&selected.includes(id);}
export async function assertEntryActive(id:string){if(!await isEntryActive(id))throw Error('This song is archived. Choose your active songs in Account & plans, or upgrade to Premium.');}
export async function chooseActive(ids:string[]){const all=await entries(),limit=featureAccess(account.entitlement).limits.songs;if(new Set(ids).size!==ids.length||ids.some(id=>!all.some(e=>e.id===id))||(limit!==null&&ids.length>limit))throw Error('Choose songs within your allowance.');if(account.session){await account.request('reserve-entries',{entries:all.filter(e=>ids.includes(e.id)).map(e=>({id:e.id,kind:e.kind,details:e.kind==='pending'?e.details:undefined}))});await account.request('active-entries',{ids});}await setSyncSetting('active-entries',ids);if(account.session)await setSyncSetting('push:cloud:'+account.session.user.id,0);changed();}
export async function reserveEntries(incoming:{id:string;kind:'score'|'pending';details?:unknown}[]){
 const all=await entries(),fresh=incoming.filter(e=>!all.some(x=>x.id===e.id));
 if(fresh.length&&!canAddEntries(all.length,new Set(fresh.map(e=>e.id)).size,account.entitlement))throw Error('Your saved-song limit is reached. Delete a song or shared link, upgrade, or request a limit increase.');
 for(const entry of incoming)if(all.some(e=>e.id===entry.id))await assertEntryActive(entry.id);
 if(account.session&&fresh.length){if(storageScope()!==account.session.user.id)throw Error('Wait for your account library to open.');try{await account.request('reserve-entries',{entries:incoming});}catch(e){throw Error('Could not reserve account song slots. Your import can be retried when online. '+(e instanceof Error?e.message:String(e)));}}
}
export function installLibraryPolicy(){setIncomingGuard(async(rows)=>{const ids=[...new Set(rows.filter(r=>['song','source'].includes(r.entity)&&r.operation==='upsert').map(r=>r.entityId))];if(ids.length)await reserveEntries(ids.map(id=>({id,kind:'score'})));for(const row of rows)if(['section','annotation','recording'].includes(row.entity)&&row.operation==='upsert')await assertEntryActive(row.entityId.split(':')[0]);});setWriteGuard(async(ids,assets)=>{for(const a of assets)if(a.blob.size>featureAccess(account.entitlement).limits.fileBytes)throw Error('Files must be at most 30 MB.');if(ids.length)await reserveEntries(ids.map(id=>({id,kind:'score'})));});}
export async function captureShare(url:string,title=''){
 const pending=newPendingSong(url,title),all=await pendingSongs(),duplicate=all.find(p=>p.link.provider===pending.link.provider&&p.link.id===pending.link.id);if(duplicate)return duplicate;const ready=(await readLibraryIndex()).songs.find(s=>s.sharedLink?.provider===pending.link.provider&&s.sharedLink?.id===pending.link.id);if(ready)throw Error('This song link is already in your library.');
 await reserveEntries([{id:pending.id,kind:'pending',details:pending}]);await setSyncSetting('pending-songs',[pending,...all]);changed();return pending;
}
export async function deletePending(id:string){if(account.session)await account.request('delete-entry',{id});await setSyncSetting('pending-songs',(await pendingSongs()).filter(p=>p.id!==id));changed();}
export async function completePending(id:string){await setSyncSetting('pending-songs',(await pendingSongs()).filter(p=>p.id!==id));changed();}
export async function refreshEntries(){if(!account.session)return;const {entries:remote}=await account.request<{entries:Entry[]}>('entries');const local=await pendingSongs();const pending=remote.filter(e=>e.kind==='pending'&&!e.deleted).map(e=>({...e.details,id:e.id,kind:'pending'} as PendingSong));await setSyncSetting('pending-songs',[...pending,...local.filter(p=>!remote.some(e=>e.id===p.id))]);await setSyncSetting('active-entries',remote.filter(e=>e.active&&!e.deleted).map(e=>e.id));changed();}
export async function readDrafts():Promise<{id:string;song:any;assets:any[]}[]>{const d=await db(),tx=d.transaction('settings');return (await req<any[]>(tx.objectStore('settings').getAll(IDBKeyRange.bound('draft:','draft:\uffff'))))||[];}
export async function deleteDraft(id:string){const d=await db(),tx=d.transaction('settings','readwrite'),p=done(tx);tx.objectStore('settings').delete('draft:'+id);await p;changed();}
function changed(){if(typeof window!=='undefined')window.dispatchEvent(new Event('guitario:entries-changed'));}
