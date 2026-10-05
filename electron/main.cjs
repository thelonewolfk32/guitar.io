const { app, BrowserWindow, protocol, net, session, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'guitario', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

app.setName('Guitar.io');
app.setAppUserModelId('io.guitario.desktop');
// Browser/desktop acceptance tests use a fresh, explicitly supplied profile.
// Normal launches retain the existing Guitar.io library path.
if (process.env.GUITARIO_TEST_PROFILE) app.setPath('userData', path.resolve(process.env.GUITARIO_TEST_PROFILE));
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
let mainWindow;
let learnWindow;
let lan;
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  const { importSongsterr, songsterrSync } = require('./songsterr.cjs');
  function requireApp(event) {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith('guitario://app/')) throw new Error('Only Guitar.io can request an import.');
  }
  const {UpdateService}=require('./update-service.cjs');
  let updatePreparation;
  ipcMain.on('updates:prepared',(event,token,error)=>{try{requireApp(event);if(updatePreparation?.token!==token)return;clearTimeout(updatePreparation.timer);const pending=updatePreparation;updatePreparation=undefined;error?pending.reject(new Error(error)):pending.resolve();}catch{}});
  const updates=new UpdateService({directory:app.getPath('userData'),currentVersion:app.getVersion(),fetcher:(url,options)=>net.fetch(url,options),openExternal:url=>shell.openExternal(url),onChange:state=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('updates:changed',state);},installerOptions:{execPath:process.execPath,packaged:app.isPackaged,
    beforeInstall:async()=>{if(learnWindow&&!learnWindow.isDestroyed())throw Error('Close Learn before updating.');await new Promise((resolve,reject)=>{const token=require('node:crypto').randomUUID(),timer=setTimeout(()=>{updatePreparation=undefined;reject(new Error('Save your changes and try updating again.'));},15000);updatePreparation={token,timer,resolve,reject};mainWindow.webContents.send('updates:prepare',token);});session.defaultSession.flushStorageData();},
    quit:()=>app.quit(),
    attention:async(command,message)=>{const choice=await dialog.showMessageBox(mainWindow,{type:'info',title:'Guitar.io update',message:'Mac update needs approval',detail:message+'\nIf macOS blocks the command, open System Settings → Privacy & Security → Open Anyway, then run it again.',buttons:['Run command','Later'],defaultId:0,cancelId:1});if(choice.response===0){const {execFile}=require('node:child_process');await require('node:util').promisify(execFile)('/usr/bin/open',['-a','Terminal',command]);app.quit();}}
  }});
  const updatesReady=updates.load();
  ipcMain.handle('updates:status',async event=>{requireApp(event);await updatesReady;return updates.status();});
  ipcMain.handle('updates:check',async event=>{requireApp(event);await updatesReady;return updates.check();});
  ipcMain.handle('updates:settings',async(event,value)=>{requireApp(event);await updatesReady;return updates.settings(value);});
  ipcMain.handle('updates:prepare-download',async event=>{requireApp(event);await updatesReady;return updates.prepare();});
  ipcMain.handle('updates:install',async event=>{requireApp(event);await updatesReady;return updates.install();});
  const {LanService}=require('./lan-bundle.cjs');
  const pendingLan=new Map();let lanSequence=0;
  lan=new LanService((payload,deviceId)=>new Promise((resolve,reject)=>{if(!mainWindow||mainWindow.isDestroyed())return reject(new Error('Open Guitar.io to sync.'));const id=++lanSequence,timer=setTimeout(()=>{pendingLan.delete(id);reject(new Error('Library did not respond.'));},20000);pendingLan.set(id,{resolve,reject,timer});mainWindow.webContents.send('lan:incoming',id,payload,deviceId);}));
  ipcMain.handle('lan:configure',(event,config)=>{requireApp(event);return lan.configure(config);});
  ipcMain.handle('lan:status',event=>{requireApp(event);return lan.status();});
  ipcMain.handle('lan:request',(event,endpoint,body)=>{requireApp(event);return lan.request(endpoint,body);});
  ipcMain.on('lan:reply',(event,id,value)=>{try{requireApp(event);const item=pendingLan.get(id);if(!item)return;pendingLan.delete(id);clearTimeout(item.timer);value.error?item.reject(new Error(value.error)):item.resolve(value.result);}catch{}});
  ipcMain.handle('recording:tempo',async(event,song)=>{
    requireApp(event);
    const {lookupSongTempo}=await import('./online-tempo.mjs');
    return lookupSongTempo(song,(url,options)=>net.fetch(url,{...options,headers:{...options.headers,'User-Agent':`Guitar.io/${app.getVersion()} (recording tempo lookup)`}}));
  });
  ipcMain.handle('songsterr:download', async (event,url) => { requireApp(event); return importSongsterr(url, (url,options) => net.fetch(url,options)); });
  ipcMain.handle('songsterr:sync', async (event,url) => { requireApp(event); return songsterrSync(url, (url,options) => net.fetch(url,options)); });
  ipcMain.handle('youtube:rate', async (event,videoId,rate,request) => {
    requireApp(event);
    const {youtubeFrame,rateScript}=require('./youtube-rate.cjs');
    const script=rateScript(videoId,rate,request),frame=youtubeFrame(event.sender,videoId);
    if (!frame) throw new Error('The selected YouTube player is not ready.');
    const applied=await frame.executeJavaScript(script);
    if(!Number.isFinite(applied) || applied<.25 || applied>2)throw new Error('YouTube fine speed is unavailable.');
    return applied;
  });
  const songId = id => typeof id === 'string' && id.length <= 200 ? id : '';
  ipcMain.handle('learn:open', (event,id) => {
    requireApp(event);
    if (learnWindow && !learnWindow.isDestroyed()) { learnWindow.webContents.send('learn:context',songId(id)); if (learnWindow.isMinimized()) learnWindow.restore(); learnWindow.focus(); return; }
    learnWindow = new BrowserWindow({ width:1280, height:920, minWidth:850, minHeight:650, parent:mainWindow, backgroundColor:'#161d1a', title:'Learn · Guitar.io', autoHideMenuBar:true,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true} });
    learnWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    learnWindow.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('guitario://app/')) e.preventDefault();});
    learnWindow.on('closed',()=>{learnWindow=undefined;});
    learnWindow.loadURL('guitario://app/?learn=1&song='+encodeURIComponent(songId(id)));
  });
  ipcMain.on('learn:update',(event,id)=> { try { requireApp(event); if(learnWindow && !learnWindow.isDestroyed()) learnWindow.webContents.send('learn:context',songId(id)); } catch {} });
  const root = path.resolve(__dirname, '../dist');
  protocol.handle('guitario', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    const filePath = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filePath.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(filePath).href);
  });
  // Only the main app frame can use the score's user-initiated fullscreen control.
  const appFullscreen = (contents, permission, details) => permission === 'fullscreen' && !!mainWindow && !mainWindow.isDestroyed() && contents === mainWindow.webContents && details?.isMainFrame === true && details.requestingUrl?.startsWith('guitario://app/');
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(!!appFullscreen(contents, permission, details)));
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => !!appFullscreen(contents, permission, details));
  // YouTube requires desktop WebViews to identify the embedding app using a Referer.
  // A custom local scheme has no HTTP referrer; this is our app ID, not another website.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*', 'https://musicbrainz.org/ws/2/*'] },
    (details, callback) => callback({ requestHeaders: { ...details.requestHeaders, ...(details.url.startsWith('https://musicbrainz.org/') ? { 'User-Agent': `Guitar.io/${app.getVersion()} (personal repertoire library)` } : { Referer: 'https://io.guitario.desktop/' }) } })
  );
  mainWindow = new BrowserWindow({
    width: 1512, height: 960, minWidth: 1050, minHeight: 720,
    backgroundColor: '#161a1d', title: 'Guitar.io', autoHideMenuBar: true,
    webPreferences: { preload:path.join(__dirname,'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('guitario://app/')) event.preventDefault();
  });
  mainWindow.loadURL('guitario://app/');
  mainWindow.on('closed',()=>{ if(learnWindow && !learnWindow.isDestroyed()) learnWindow.close(); });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit',()=>{void lan?.stop();});
