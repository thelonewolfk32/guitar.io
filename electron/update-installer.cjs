const fs=require('node:fs/promises');
// Electron otherwise treats .asar files as virtual directories. Inspect and
// clean staged archives through the real filesystem while bundled scripts use fs.
let raw=fs;try{raw=require('original-fs').promises;}catch{}
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {inflateRawSync}=require('node:zlib');
const run=promisify(execFile),MAX_DOWNLOAD=512*1024*1024;
function within(root,file){return file!==root&&file.startsWith(root+path.sep);}
async function removeStage(root,file){if(!within(root,file))throw Error('Invalid update staging path.');await raw.rm(file,{recursive:true,force:true});}
// Validate the central directory before invoking the operating system extractor.
// Release ZIPs are deliberately below ZIP64 limits and contain one named folder.
async function validateArchive(file,folder,platform){
 const handle=await fs.open(file,'r');
 try{
  const size=(await handle.stat()).size,tail=Buffer.alloc(Math.min(size,65557));await handle.read(tail,0,tail.length,size-tail.length);
  let end=-1;for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}
  if(end<0)throw Error('Invalid update archive.');
  const count=tail.readUInt16LE(end+10),length=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);
  if(tail.readUInt16LE(end+4)||tail.readUInt16LE(end+6)||count!==tail.readUInt16LE(end+8)||!count||count>15000||length>8*1024*1024||offset+length>size-tail.length+end)throw Error('Unsupported update archive.');
  const directory=Buffer.alloc(length);await handle.read(directory,0,length,offset);let at=0,total=0;const names=new Set(),files=[];
  for(let n=0;n<count;n++){
   if(at+46>length||directory.readUInt32LE(at)!==0x02014b50)throw Error('Invalid update entries.');
   const flags=directory.readUInt16LE(at+8),method=directory.readUInt16LE(at+10),packed=directory.readUInt32LE(at+20),unpacked=directory.readUInt32LE(at+24),nameLength=directory.readUInt16LE(at+28),extra=directory.readUInt16LE(at+30),comment=directory.readUInt16LE(at+32),mode=directory.readUInt32LE(at+38)>>>16,local=directory.readUInt32LE(at+42);
   const name=directory.subarray(at+46,at+46+nameLength).toString('utf8'),parts=name.replace(/\/$/,'').split('/');
   if(flags&1||![0,8].includes(method)||at+46+nameLength+extra+comment>length||local>=offset||parts[0]!==folder||parts.some(p=>!p||p==='.'||p==='..'||/[\\:\x00-\x1f]/.test(p)||platform==='win32'&&(/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))))throw Error('Unsafe update archive path.');
   const key=name.toLowerCase();if(names.has(key))throw Error('Duplicate update archive entry.');names.add(key);total+=unpacked;if(total>1024*1024*1024)throw Error('Update is too large.');
   if(![0,0x4000,0x8000,0xa000].includes(mode&0xf000))throw Error('Unsupported archive entry.');
   const localHead=Buffer.alloc(30);await handle.read(localHead,0,30,local);if(localHead.readUInt32LE(0)!==0x04034b50||localHead.readUInt16LE(6)!==flags||localHead.readUInt16LE(8)!==method||localHead.readUInt16LE(26)!==nameLength||local+30+nameLength+localHead.readUInt16LE(28)+packed>offset)throw Error('Invalid local update entry.');
   const localName=Buffer.alloc(nameLength);await handle.read(localName,0,nameLength,local+30);if(localName.toString('utf8')!==name)throw Error('Mismatched update archive paths.');
   if((mode&0xf000)===0xa000){
    if(platform!=='darwin'||packed>4096||unpacked>4096)throw Error('Unsupported archive link.');
    const head=Buffer.alloc(30);await handle.read(head,0,30,local);if(head.readUInt32LE(0)!==0x04034b50)throw Error('Invalid archive link.');
    const bytes=Buffer.alloc(packed);await handle.read(bytes,0,packed,local+30+head.readUInt16LE(26)+head.readUInt16LE(28));const target=(method===8?inflateRawSync(bytes,{maxOutputLength:4096}):bytes).toString('utf8');
    const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),target));if(path.posix.isAbsolute(target)||/[\\\x00]/.test(target)||!resolved.startsWith(folder+'/Guitar.io.app/'))throw Error('Unsafe archive link.');
   }else if(!name.endsWith('/'))files.push(name.slice(folder.length+1));
   at+=46+nameLength+extra+comment;
  }
  const required=platform==='darwin'?['Guitar.io.app/Contents/MacOS/Guitar.io','Guitar.io.app/Contents/Resources/app.asar']:['Guitar.io.exe','resources/app.asar'];
  if(at!==length||!required.every(p=>files.includes(p)))throw Error('Incomplete update package.');return files;
 }finally{await handle.close();}
}
async function asarVersion(file){const handle=await raw.open(file,'r');try{const head=Buffer.alloc(16);await handle.read(head,0,16,0);const headerSize=head.readUInt32LE(4),length=head.readUInt32LE(12);if(length>8*1024*1024)throw Error('Invalid app data.');const bytes=Buffer.alloc(length);await handle.read(bytes,0,length,16);const item=JSON.parse(bytes).files?.['package.json'];if(!item||item.size>65536)throw Error('Invalid application package.');const data=Buffer.alloc(item.size);await handle.read(data,0,item.size,8+headerSize+Number(item.offset));const pkg=JSON.parse(data);if(pkg.name!=='guitar-io'||pkg.main!=='electron/main.cjs')throw Error('Unexpected application identity.');return pkg.version;}finally{await handle.close();}}
class UpdateInstaller{
 constructor({directory,platform,execPath,fetcher,packaged,notify=()=>{},beforeInstall=async()=>{},quit=()=>{}}){Object.assign(this,{directory,platform,execPath,fetcher,packaged,notify,beforeInstall,quit});this.root=path.join(directory,'app-updates');}
 async prepare(release){
  if(this.preparing)return this.preparing;
  if(this.ready?.version===release.latestVersion)return this.ready;
  this.preparing=this.download(release).finally(()=>{this.preparing=undefined;});return this.preparing;
 }
 async download(release){
  if(!this.packaged||!['win32','darwin'].includes(this.platform))throw Error('Run the installed desktop app to update.');
  if(!/^sha256:[a-f0-9]{64}$/.test(release.digest || '')||!Number.isSafeInteger(release.size)||release.size<=0||release.size>MAX_DOWNLOAD)throw Error('This update has no valid verification checksum.');
  await fs.mkdir(this.root,{recursive:true});const stage=await fs.mkdtemp(path.join(this.root,'download-')),zip=path.join(stage,'package.zip');
  try{
   this.notify({status:'downloading',progress:0,message:''});const response=await this.fetcher(release.downloadUrl,{signal:AbortSignal.timeout(10*60*1000)});if(!response.ok||!response.body)throw Error('Update download failed. Try again.');
   const output=await fs.open(zip,'wx'),hash=createHash('sha256');let received=0,last=0;
   try{for await(const chunk of response.body){received+=chunk.length;if(received>release.size||received>MAX_DOWNLOAD)throw Error('Invalid update download size.');hash.update(chunk);await output.writeFile(chunk);if(Date.now()-last>400){last=Date.now();this.notify({status:'downloading',progress:Math.floor(received/release.size*100)});}}}finally{await output.close();}
   if(received!==release.size||hash.digest('hex')!==release.digest.slice(7))throw Error('Update verification failed. Your app was not changed.');
   this.notify({status:'preparing',progress:100});const folder=release.assetName.slice(0,-4),files=await validateArchive(zip,folder,this.platform),extracted=path.join(stage,'extracted');await fs.mkdir(extracted);
   if(this.platform==='win32'){
    const extraction=path.join(stage,'extract.ps1');await fs.writeFile(extraction,"param([string]$Archive,[string]$Destination)\n$ErrorActionPreference='Stop'\nExpand-Archive -LiteralPath $Archive -DestinationPath $Destination\n");
    await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',extraction,'-Archive',zip,'-Destination',extracted],{windowsHide:true,timeout:120000});
   }else await run('/usr/bin/ditto',['-x','-k',zip,extracted],{timeout:120000});
   const source=path.join(extracted,folder),asar=path.join(source,this.platform==='darwin'?'Guitar.io.app/Contents/Resources/app.asar':'resources/app.asar');
   if(await asarVersion(asar)!==release.latestVersion)throw Error('Update version did not match its release.');
   await fs.unlink(zip);this.ready={stage,source,files,version:release.latestVersion};this.notify({status:'ready',progress:100});return this.ready;
  }catch(error){await removeStage(this.root,stage).catch(()=>{});throw error;}
 }
 async install(restart=true,{force=false}={}){
  if(this.installing)return;const ready=this.ready;if(!ready)throw Error('Check for updates first.');
  this.installing=true;
  this.notify({status:'installing',message:''});
  try{
   await this.beforeInstall({force});const target=this.platform==='darwin'?path.resolve(path.dirname(this.execPath),'../..'):path.dirname(this.execPath);
   if(target===path.parse(target).root||target===this.directory||within(target,this.directory)||(await fs.lstat(target)).isSymbolicLink())throw Error('This app location cannot be updated. Move it to a normal app folder.');
   await fs.access(target,require('node:fs').constants.W_OK);
   const plan={target,source:ready.source,files:ready.files,stage:ready.stage,version:ready.version,parentPid:process.pid,restart,executable:this.execPath,profile:this.directory,token:randomUUID()};
   const planFile=path.join(ready.stage,'install.json'),script=path.join(ready.stage,this.platform==='darwin'?'Install Guitar.io.command':'install.ps1');
   await fs.unlink(path.join(ready.stage,'handshake.json')).catch(()=>{});
   await fs.writeFile(planFile,JSON.stringify(plan));
   // Read bundled bytes through Electron's ASAR-aware fs, then write an ordinary
   // file. The OS tools must never receive an archive-backed file descriptor.
   await fs.writeFile(script,await fs.readFile(path.join(__dirname,this.platform==='darwin'?'update-mac.command':'update-windows.ps1')));
   let child;const log=await raw.open(path.join(this.directory,'update-install.log'),'w');
   // Shell-launch the installer independently so it survives Electron closing.
   // DETACHED_PROCESS alone can make Windows PowerShell exit before its script.
   try{if(this.platform==='win32'){
    const launcher=path.join(ready.stage,'launch.ps1');await fs.copyFile(path.join(__dirname,'launch-update-windows.ps1'),launcher);
    child=spawn(path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,'-Script',script,'-Plan',planFile],{cwd:ready.stage,stdio:['ignore',log.fd,log.fd],windowsHide:true});
   }
   else{
    const entitlements=await fs.readFile(path.join(__dirname,'../scripts/mac-entitlements.plist')).catch(()=>fs.readFile(path.join(__dirname,'mac-entitlements.plist')));
    await fs.writeFile(path.join(ready.stage,'entitlements.plist'),entitlements);
    // The command uses a fixed, safely quoted data file, never interpolated code.
    const quote=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
    await fs.writeFile(path.join(ready.stage,'plan.sh'),Object.entries({TARGET:target,NEW_APP:path.join(ready.source,'Guitar.io.app'),STAGE:ready.stage,PARENT_PID:process.pid,VERSION:ready.version,PROFILE:this.directory,RESTART:restart?'1':'0',TOKEN:plan.token}).map(([k,v])=>`${k}=${quote(v)}`).join('\n')+'\n');
    await fs.chmod(script,0o755);child=spawn('/bin/bash',[script],{detached:true,stdio:['ignore',log.fd,log.fd]});
   }
   }catch(error){await log.close();throw error;}
   let spawnError;child.on('error',error=>{spawnError=error;});child.on('exit',(code,signal)=>{if(code||signal)spawnError=Error('Update preparation failed. See update-install.log for details.');});child.unref();await log.close();
   // Read the helper's specific error before considering its exit code. Signing
   // failures are not macOS approval requests, and must not close the old app.
   let launched=false;for(let n=0;n<600;n++){const state=await fs.readFile(path.join(ready.stage,'handshake.json'),'utf8').then(s=>JSON.parse(s.replace(/^\uFEFF/,''))).catch(()=>undefined);if(state?.token===plan.token){if(state.status==='ready'){launched=true;break;}throw Error(state.message || 'Update preparation failed.');}if(spawnError)throw spawnError;await new Promise(r=>setTimeout(r,100));}
   if(!launched)throw Error('The update could not start. Try again.');this.notify({status:'installing'});this.quit();
  }catch(error){this.installing=false;throw error;}
 }
}
module.exports={UpdateInstaller,validateArchive,asarVersion,within,removeStage};
