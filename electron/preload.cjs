const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('guitarUpdates',{
  status:()=>ipcRenderer.invoke('updates:status'),check:()=>ipcRenderer.invoke('updates:check'),settings:value=>ipcRenderer.invoke('updates:settings',value),open:target=>ipcRenderer.invoke('updates:open',target)
});
contextBridge.exposeInMainWorld('guitarIO', {
  lookupSongTempo: song => ipcRenderer.invoke('recording:tempo',song),
  downloadSongsterr: url => ipcRenderer.invoke('songsterr:download', url),
  songsterrSync: url => ipcRenderer.invoke('songsterr:sync', url),
  youtubeRate: (videoId,rate,request) => ipcRenderer.invoke('youtube:rate',videoId,rate,request),
  openLearn: id => ipcRenderer.invoke('learn:open', id),
  updateLearn: id => ipcRenderer.send('learn:update', id),
  onLearnContext: callback => { const listener = (_event, id) => callback(id); ipcRenderer.on('learn:context', listener); return () => ipcRenderer.removeListener('learn:context', listener); },
});
contextBridge.exposeInMainWorld('guitarLan',{
  configure: config => ipcRenderer.invoke('lan:configure',config),
  status: () => ipcRenderer.invoke('lan:status'),
  request: (endpoint,body) => ipcRenderer.invoke('lan:request',endpoint,body),
  onRequest: callback => {const listener=async(_event,id,payload,deviceId)=>{try{ipcRenderer.send('lan:reply',id,{result:await callback(payload,deviceId)});}catch(e){ipcRenderer.send('lan:reply',id,{error:String(e)});}};ipcRenderer.on('lan:incoming',listener);return()=>ipcRenderer.removeListener('lan:incoming',listener);},
});
