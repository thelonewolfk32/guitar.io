import {Capacitor,registerPlugin} from '@capacitor/core';
export function installNativeAccount(){
  if(Capacitor.getPlatform()!=='ios')return;
  const plugin=registerPlugin<{loadSession:()=>Promise<{value:string|null}>;saveSession:(options:{value:string})=>Promise<void>;clearSession:()=>Promise<void>}>('GuitarAccount');
  window.guitarAccount={loadSession:async()=>(await plugin.loadSession()).value || undefined,saveSession:value=>plugin.saveSession({value}),clearSession:()=>plugin.clearSession()};
}
