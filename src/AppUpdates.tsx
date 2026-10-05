import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Download,AlertTriangle} from 'lucide-react';
import {Modal} from './ui';
import type {UpdateAvailability} from './update-state';
export type UpdateStatus={autoUpdate:boolean;currentVersion:string;status:string;latestVersion?:string;message:string;progress?:number;autoInstallPaused?:boolean};
declare global{interface Window{guitarUpdates?:{status:()=>Promise<UpdateStatus>;check:()=>Promise<UpdateStatus>;settings:(value:{autoUpdate:boolean})=>Promise<UpdateStatus>;prepare:()=>Promise<UpdateStatus>;install:(options?:{force:boolean})=>Promise<UpdateStatus>;activated?:()=>Promise<void>;onChange:(callback:(state:UpdateStatus)=>void)=>()=>void;onPrepare:(callback:(force:boolean)=>Promise<void>)=>()=>void};}}
export function useUpdates(availability:()=>UpdateAvailability){
 const [state,setState]=useState<UpdateStatus>(),[working,setWorking]=useState(false),[blocked,setBlocked]=useState<UpdateAvailability>(),busy=useRef(false),manual=useRef(false),safe=useRef(availability);safe.current=availability;
 const message=(e:unknown)=>{const raw=e instanceof Error?e.message:String(e);return raw.replace(/^.*UPDATE_BLOCKED:\s*/,'');};
 async function install(force=false){
  if(!window.guitarUpdates||busy.current)return;manual.current=true;const block=safe.current();
  if(block.reason&&(!force||!block.canForce)){setBlocked(block);setState(s=>s?{...s,message:block.reason}:s);return;}
  busy.current=true;setWorking(true);setBlocked(undefined);
  try{setState(await window.guitarUpdates.install({force}));}catch(e){const raw=e instanceof Error?e.message:String(e),text=message(e);if(raw.includes('UPDATE_BLOCKED:'))setBlocked({reason:text,canForce:safe.current().canForce});setState(s=>s?{...s,message:text}:s);}finally{busy.current=false;setWorking(false);}
 }
 async function check(manualCheck=true){
  const api=window.guitarUpdates;if(!api||busy.current)return;manual.current=manualCheck;busy.current=true;setWorking(true);setBlocked(undefined);
  try{let next=await api.check();setState(next);if(next.status==='available'){next=await api.prepare();setState(next);}}catch(e){setState(s=>s?{...s,message:message(e)}:s);}finally{busy.current=false;setWorking(false);}
 }
 useEffect(()=>{let disposed=false;const api=window.guitarUpdates;if(!api)return;const stop=api.onChange(s=>{if(!disposed)setState(s);});
  busy.current=true;setWorking(true);void(async()=>{try{let next=await api.status();if(disposed)return;setState(next);next=await api.check();if(disposed)return;setState(next);if(next.autoUpdate&&next.status==='available'){next=await api.prepare();if(!disposed)setState(next);}}catch(e){if(!disposed)setState(s=>s?{...s,message:message(e)}:s);}finally{busy.current=false;if(!disposed)setWorking(false);}})();
  return()=>{disposed=true;stop();};
 },[]);
 useEffect(()=>{if(!state?.autoUpdate||state.autoInstallPaused||state.status!=='ready'||state.message||manual.current)return;const timer=setInterval(()=>{if(!manual.current&&!busy.current&&!safe.current().reason)void install();},2000);return()=>clearInterval(timer);},[state?.autoUpdate,state?.autoInstallPaused,state?.status,state?.message]);
 return {state,blocked,working:working||['downloading','preparing','installing'].includes(state?.status || ''),check:()=>check(),install,save:async(autoUpdate:boolean)=>{if(window.guitarUpdates){setState(await window.guitarUpdates.settings({autoUpdate}));if(autoUpdate)await check(false);}}};
}
export function UpdateReadyButton({updates,onClick}:{updates:ReturnType<typeof useUpdates>;onClick:()=>void}){
 const state=updates.state;if(!state||!['available','ready'].includes(state.status))return null;
 const ready=state.status==='ready';return <button className="icon-button update-ready-button" aria-label="Update ready" title={`${ready?'Install':'Download'} Guitar.io ${state.latestVersion}`} onClick={onClick}><Download size={20} aria-hidden="true"/></button>;
}
export function UpdateSettings({updates,onClose}:{updates:ReturnType<typeof useUpdates>;onClose:()=>void}){
 const [error,setError]=useState(''),[saving,setSaving]=useState(false),[confirm,setConfirm]=useState(false),state=updates.state,ready=state?.status==='ready';
 const status=state?.message || (state?.status==='current'?'You’re up to date.':state?.status==='downloading'?`Downloading · ${state.progress || 0}%`:state?.status==='preparing'?'Preparing update…':state?.status==='installing'?'Restarting…':ready?`Version ${state.latestVersion} ready to install.`:state?.status==='available'?`Version ${state.latestVersion} available.`:'');
 return <><Modal title="Updates" onClose={onClose}><div className="app-updates">
  <button className="button primary" disabled={updates.working||saving||!window.guitarUpdates} title={ready?'Install the downloaded update':'Check for updates and download a newer version'} onClick={()=>void(ready?updates.install():updates.check())}>{ready?<Download size={19}/>:<RefreshCw size={19} className={updates.working?'spin':''}/>} {ready?'Install update':'Check for updates'}</button>
  {ready&&updates.blocked&&<button className="button secondary" disabled={updates.working||!updates.blocked.canForce} title={updates.blocked.canForce?'Close open views and install after saving finishes':updates.blocked.reason} onClick={()=>setConfirm(true)}><AlertTriangle size={18}/>Force install</button>}
  <div className="sync-switch-row"><span>Auto-updater</span><button role="switch" aria-label="Auto-updater" title="Download and install updates automatically when the library is idle" aria-checked={state?.autoUpdate ?? false} className="magnet-switch" disabled={updates.working||saving||!state||!window.guitarUpdates} onClick={async()=>{setSaving(true);setError('');try{await updates.save(!state?.autoUpdate);}catch(e){setError(String(e));}finally{setSaving(false);}}}><span>OFF</span><span>ON</span></button></div>
  {status&&<p role="status">{status}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
 </div></Modal>{confirm&&<Modal title="Force install update?" onClose={()=>setConfirm(false)}><p>Guitar.io will close the player, Learn and open editors, then install and restart. Unsaved form changes will be discarded. Saved changes are flushed first, and active saves or imports must finish.</p><div className="modal-actions"><button className="button secondary" onClick={()=>setConfirm(false)}>Cancel</button><button className="button primary" onClick={()=>{setConfirm(false);void updates.install(true);}}><Download size={18}/>Force install</button></div></Modal>}</>;
}
