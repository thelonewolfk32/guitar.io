import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Modal} from './ui';
export type UpdateStatus={autoUpdate:boolean;currentVersion:string;status:string;latestVersion?:string;message:string;progress?:number};
declare global{interface Window{guitarUpdates?:{status:()=>Promise<UpdateStatus>;check:()=>Promise<UpdateStatus>;settings:(value:{autoUpdate:boolean})=>Promise<UpdateStatus>;prepare:()=>Promise<UpdateStatus>;install:()=>Promise<UpdateStatus>;onChange:(callback:(state:UpdateStatus)=>void)=>()=>void;onPrepare:(callback:()=>Promise<void>)=>()=>void};}}
export function useUpdates(canInstall:()=>boolean){
 const [state,setState]=useState<UpdateStatus>(),[working,setWorking]=useState(false),busy=useRef(false),safe=useRef(canInstall);safe.current=canInstall;
 async function install(){if(!safe.current())throw Error('Return to the library and close any editors before updating.');await window.guitarUpdates?.install();}
 async function check(){if(!window.guitarUpdates||busy.current)return;busy.current=true;setWorking(true);try{let next=await window.guitarUpdates.check();setState(next);if(next.status==='available'){next=await window.guitarUpdates.prepare();setState(next);}if(next.status==='ready')await install();}catch(error){setState(s=>s?{...s,message:error instanceof Error?error.message:String(error)}:s);}finally{busy.current=false;setWorking(false);}}
 useEffect(()=>{let disposed=false;const api=window.guitarUpdates;if(!api)return;const stop=api.onChange(s=>{if(!disposed)setState(s);});void api.status().then(async s=>{if(disposed)return;setState(s);if(s.autoUpdate){let next=await api.check();if(disposed)return;setState(next);if(next.status==='available'){next=await api.prepare();if(!disposed)setState(next);}}}).catch(error=>{if(!disposed)setState(s=>s?{...s,message:String(error)}:s);});return()=>{disposed=true;stop();};},[]);
 useEffect(()=>{if(!state?.autoUpdate||state.status!=='ready'||state.message)return;const timer=setInterval(()=>{if(!busy.current&&safe.current()){busy.current=true;void install().catch(error=>setState(s=>s?{...s,message:error.message}:s)).finally(()=>{busy.current=false;});}},2000);return()=>clearInterval(timer);},[state?.autoUpdate,state?.status,state?.message]);
 return {state,working:working||['downloading','preparing','installing'].includes(state?.status || ''),check,save:async(autoUpdate:boolean)=>{if(window.guitarUpdates){setState(await window.guitarUpdates.settings({autoUpdate}));if(autoUpdate)await check();}}};
}
export function UpdateSettings({updates,onClose}:{updates:ReturnType<typeof useUpdates>;onClose:()=>void}){
 const [error,setError]=useState(''),[saving,setSaving]=useState(false),state=updates.state;
 const status=state?.message || (state?.status==='current'?'You’re up to date.':state?.status==='downloading'?`Downloading · ${state.progress || 0}%`:state?.status==='preparing'?'Preparing update…':state?.status==='installing'?'Restarting…':state?.status==='ready'?'Update ready.':state?.status==='available'?`Version ${state.latestVersion} available.`:'');
 return <Modal title="Updates" onClose={onClose}><div className="app-updates">
  <button className="button primary" disabled={updates.working||saving||!window.guitarUpdates} title="Check, download and install the latest update" onClick={()=>void updates.check()}><RefreshCw size={19} className={updates.working?'spin':''}/>Check for updates</button>
  <div className="sync-switch-row"><span>Auto-updater</span><button role="switch" aria-label="Auto-updater" title="Download and install updates automatically when the library is idle" aria-checked={state?.autoUpdate ?? false} className="magnet-switch" disabled={updates.working||saving||!state||!window.guitarUpdates} onClick={async()=>{setSaving(true);setError('');try{await updates.save(!state?.autoUpdate);}catch(e){setError(String(e));}finally{setSaving(false);}}}><span>OFF</span><span>ON</span></button></div>
  {status&&<p role="status">{status}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
 </div></Modal>;
}
