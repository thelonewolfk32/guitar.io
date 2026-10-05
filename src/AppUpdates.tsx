import {useEffect,useState} from 'react';
import {Download,RefreshCw,Check,X,Github} from 'lucide-react';
import {Modal} from './ui';
export type UpdateStatus={repository:string;checkOnLaunch:boolean;currentVersion:string;status:string;latestVersion?:string;message:string;lastChecked?:string};
declare global{interface Window{guitarUpdates?:{status:()=>Promise<UpdateStatus>;check:()=>Promise<UpdateStatus>;settings:(value:{repository:string;checkOnLaunch:boolean})=>Promise<UpdateStatus>;open:(target:'download'|'release'|'repository')=>Promise<void>};}}
export function useUpdates(){
  const [state,setState]=useState<UpdateStatus>(),[working,setWorking]=useState(false),[dismissed,setDismissed]=useState(false);
  async function check(){if(!window.guitarUpdates)return;setWorking(true);try{setState(await window.guitarUpdates.check());}catch(error){setState(s=>s?{...s,status:'error',message:String(error)}:s);}finally{setWorking(false);}}
  useEffect(()=>{let disposed=false;void window.guitarUpdates?.status().then(async status=>{if(disposed)return;setState(status);if(status.checkOnLaunch){setWorking(true);try{const result=await window.guitarUpdates!.check();if(!disposed)setState(result);}finally{if(!disposed)setWorking(false);}}}).catch(()=>{});return()=>{disposed=true;};},[]);
  return {state,working,dismissed,dismiss:()=>setDismissed(true),check,save:async(value:{repository:string;checkOnLaunch:boolean})=>{if(window.guitarUpdates){setState(await window.guitarUpdates.settings(value));setDismissed(false);}}};
}
export function UpdateNotice({updates,onOpen}:{updates:ReturnType<typeof useUpdates>;onOpen:()=>void}){return updates.state?.status==='available'&&!updates.dismissed?<div className="app-update-notice" role="status"><button className="button secondary" title="View the new version and download the build for this computer" onClick={onOpen}><Download size={18}/>Guitar.io {updates.state.latestVersion} available</button><button className="icon-button" title="Dismiss this update notice" aria-label="Dismiss update notice" onClick={updates.dismiss}><X size={17}/></button></div>:null;}
export function UpdateSettings({updates,onClose}:{updates:ReturnType<typeof useUpdates>;onClose:()=>void}){
  const state=updates.state,[repository,setRepository]=useState(state?.repository || 'thelonewolfk32/guitar.io'),[automatic,setAutomatic]=useState(state?.checkOnLaunch ?? true),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  return <Modal title="App updates" subtitle={'Guitar.io '+(state?.currentVersion || '1.4.3')} onClose={onClose}><div className="app-updates">
    {!window.guitarUpdates?<p>Release checks are available in the Windows and Mac apps.</p>:<>
      <label>GitHub repository<input aria-label="GitHub update repository" value={repository} onChange={e=>setRepository(e.target.value)} placeholder="https://github.com/owner/repository"/></label>
      <label className="online-tempo-choice"><input type="checkbox" aria-label="Check for updates on launch" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>Check for updates on launch</label>
      <div className="sync-debug-actions"><button className="button primary" disabled={saving||updates.working} title="Save the release repository and launch preference" onClick={async()=>{setSaving(true);setError('');try{await updates.save({repository,checkOnLaunch:automatic});await updates.check();}catch(e){setError(String(e));}finally{setSaving(false);}}}><Check size={18}/>Save</button><button className="button secondary" disabled={saving||updates.working} title="Check the saved repository for a newer stable release" onClick={()=>void updates.check()}><RefreshCw size={18} className={updates.working?'spin':''}/>Check now</button><button className="icon-button" title="Open GitHub Releases" aria-label="Open GitHub Releases" onClick={()=>void window.guitarUpdates?.open('repository')}><Github size={21}/></button></div>
      <p role="status">{updates.working?'Checking GitHub…':state?.status==='available'?`Version ${state.latestVersion} is ready to download.`:state?.status==='current'?`You’re up to date · ${state.currentVersion}.`:state?.message || 'Check GitHub for the latest release.'}</p>
      {state?.status==='available'&&<button className="button primary" title="Download the ZIP for this computer from GitHub" onClick={()=>void window.guitarUpdates?.open('download')}><Download size={19}/>Download {state.latestVersion}</button>}
      {state?.status==='missing-build'&&<button className="button secondary" onClick={()=>void window.guitarUpdates?.open('release')}><Github size={19}/>View release</button>}
      <p className="import-explainer">Download, close Guitar.io, then replace the app files. Your saved library stays in this computer’s app data. Mac test builds use the included preparation command.</p>
      {error&&<p className="form-error" role="alert">{error}</p>}
    </>}
  </div></Modal>;
}
