import {useEffect,useState} from 'react';
import {Wifi,RefreshCw,Plus,Copy,Trash2,ShieldCheck,Check,X,Bug,Download} from 'lucide-react';
import {Modal} from './ui';
import {download} from './notation';
import type {SyncEngine} from './lan-sync';

export function PairingRequest({engine}:{engine:SyncEngine}){
  const [,render]=useState(0);useEffect(()=>engine.subscribe(()=>render(n=>n+1)),[engine]);
  const request=engine.view.incoming;
  return request?<Modal title="Confirm device" onClose={()=>engine.approvePair(false)}><div className="pairing-confirm"><p>Check that these digits also appear on {request.name} before allowing the connection.</p><strong className="pairing-digits" aria-label="Pairing verification digits">{request.digits}</strong><div className="modal-actions"><button className="icon-button danger" aria-label="Reject device" title="Reject device" onClick={()=>engine.approvePair(false)}><X size={22}/></button><button className="button primary" onClick={()=>engine.approvePair(true)}><Check size={19}/>Digits match</button></div></div></Modal>:null;
}
export default function DeviceSync({engine,onClose}:{engine:SyncEngine;onClose:()=>void}){
  const [debug,setDebug]=useState(false);
  const [,render]=useState(0),[code,setCode]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[adding,setAdding]=useState(false),[copied,setCopied]=useState(false);
  const [session,setSession]=useState<Awaited<ReturnType<SyncEngine['beginPair']>>>();
  useEffect(()=>engine.subscribe(()=>render(n=>n+1)),[engine]);const view=engine.view;
  useEffect(()=>setCopied(false),[view.code]);
  async function act(task:()=>Promise<void>){setWorking(true);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setWorking(false);}}
  return <Modal title="Device sync" onClose={onClose}>
    {!view.available?<p className="import-explainer">Local sync is available in the Windows, Mac and iOS apps.</p>:<div className="device-sync">
      <div className="sync-switch-row"><Wifi size={22}/><span>Local sync</span><button role="switch" aria-label="Enable local sync" title="Enable or disable connections on your Wi-Fi or LAN" aria-checked={view.enabled} className="magnet-switch" disabled={working} onClick={()=>void act(()=>engine.enable(!view.enabled))}><span>OFF</span><span>ON</span></button></div>
      {view.enabled&&<>
        {view.code&&<div className="sync-code-row"><div><small>This device’s code</small><strong className="pairing-digits" aria-label="This device’s pairing code">{view.code}</strong></div><button className="icon-button" aria-label={copied?'Code copied':'Copy pairing code'} title={copied?'Code copied':'Copy pairing code'} onClick={()=>{void navigator.clipboard.writeText(view.code).then(()=>setCopied(true)).catch(()=>setError('Select and copy the six digits.'));}}>{copied?<Check size={21}/>:<Copy size={21}/>}</button><button className="icon-button" title="Reset code and revoke incoming connections" aria-label="Reset pairing code" disabled={working} onClick={()=>void act(()=>engine.resetCode())}><RefreshCw size={18}/></button></div>}
        <label className="online-tempo-choice"><input type="checkbox" aria-label="Auto sync" title="Check paired devices for updates automatically in the background" checked={view.autoSync} disabled={working} onChange={e=>void act(()=>engine.setAutoSync(e.target.checked))}/>Auto sync</label>
      </>}
      <label className="sync-device-name">Device name<input aria-label="Sync device name" defaultValue={view.name} onBlur={e=>{if(e.target.value.trim()!==view.name)void act(()=>engine.rename(e.target.value));}}/></label>
      {view.enabled&&<><div className="sync-pair">
        <button className="button primary" aria-expanded={adding} onClick={()=>{setAdding(v=>!v);setSession(undefined);setError('');}}><Plus size={19}/>Add device</button>
        {adding&&(!session?<div className="pairing-entry"><input aria-label="Device pairing code" inputMode="numeric" placeholder="Six-digit PC or Mac code" value={code} onChange={e=>setCode(e.target.value)}/><button className="icon-button section-confirm" aria-label="Connect device" title="Connect device" disabled={working||!code.trim()} onClick={()=>void act(async()=>{if(code.trim().startsWith('guitario1:')){await engine.pair(code);setAdding(false);setCode('');}else setSession(await engine.beginPair(code));})}><Plus size={23}/></button></div>:<div className="pairing-confirm"><p>Check these digits on {session.name}. Confirm on both devices to connect.</p><strong className="pairing-digits" aria-label="Pairing verification digits">{session.digits}</strong><button className="button primary" disabled={working} onClick={()=>void act(async()=>{await engine.finishPair(session);setSession(undefined);setAdding(false);setCode('');})}><ShieldCheck size={19}/>Digits match</button></div>)}
      </div>
      <div className="sync-peers">{view.peers.map(peer=><div className="sync-peer" key={peer.id}><Wifi size={19}/><div><strong>{peer.name}</strong><small>{peer.error || (peer.lastSync?'Checked '+new Date(peer.lastSync).toLocaleTimeString():'Waiting to sync')}</small></div><button className="icon-button" title={'Remove paired device '+peer.name} aria-label={'Remove paired device '+peer.name} disabled={working} onClick={()=>void act(()=>engine.remove(peer.id))}><Trash2 size={19}/></button></div>)}</div>
      <div className="sync-footer"><button className="button secondary" disabled={working||view.busy} title="Check paired devices for updates now" onClick={()=>void act(()=>engine.run())}><RefreshCw size={18} className={view.busy?'spin':''}/>Sync now</button><span>{(view.bytes/1024).toFixed(1)} KB this session</span></div></>}
      <div className="sync-debug-toggle"><Bug size={18}/><span>Show diagnostics</span><button role="switch" aria-label="Show sync diagnostics" title="Show or hide developer sync diagnostics" aria-checked={debug} className="magnet-switch" onClick={()=>setDebug(v=>!v)}><span>OFF</span><span>ON</span></button></div>
      {debug&&<div className="sync-diagnostics"><p role="status">{view.stage}</p><div className="sync-debug-actions"><button className="button secondary" disabled={working} title="Download a local report with song names, checkpoints and LAN addresses; no pairing secrets or tab files" onClick={()=>void act(async()=>download('Guitar-io-sync-report.json',JSON.stringify(await engine.diagnostics(),null,2),'application/json'))}><Download size={18}/>Export report</button><button className="icon-button" aria-label="Clear sync diagnostics" title="Clear the saved diagnostic log" onClick={()=>engine.clearDiagnostics()}><Trash2 size={18}/></button></div><ol className="sync-event-log">{[...view.events].reverse().map((event,i)=><li key={event.at+':'+i} className={event.error?'form-error':''}><small>{new Date(event.at).toLocaleTimeString()} · {event.stage}{event.peer?' · '+event.peer:''}</small><span>{event.message}</span></li>)}</ol>{!view.events.length&&<p>No sync events recorded yet.</p>}</div>}
      {(error||view.error)&&<p role="alert" className="form-error">{error||view.error}</p>}
    </div>}
  </Modal>;
}
