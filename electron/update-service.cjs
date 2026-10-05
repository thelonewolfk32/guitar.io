const fs=require('node:fs/promises');
const path=require('node:path');
function repositorySlug(value){
  if(typeof value!=='string')throw new Error('Enter a GitHub repository link.');
  let slug=value.trim();if(slug.startsWith('https://')){const url=new URL(slug);if(url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTPS github.com repository link.');slug=url.pathname.replace(/^\/|\/$/g,'');}
  slug=slug.replace(/\.git$/,'');if(!/^[a-zA-Z0-9-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/.test(slug)||slug.split('/')[1]==='..')throw new Error('Use a GitHub owner/repository link.');return slug;
}
function versionParts(value){const match=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value));if(!match)return;const parts=match.slice(1).map(Number);return parts.every(Number.isSafeInteger)?parts:undefined;}
function newer(latest,current){const a=versionParts(latest),b=versionParts(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
function releaseInfo(data,current,platform,arch,repository){
  if(!data||data.draft||data.prerelease||!versionParts(data.tag_name))throw new Error('The latest release must use a stable tag such as v1.4.3.');
  const version=data.tag_name.replace(/^v/,''),releaseUrl=`https://github.com/${repository}/releases/tag/${data.tag_name}`;
  const suffix=platform==='win32'&&arch==='x64'?'Windows-x64':platform==='darwin'&&arch==='arm64'?'macOS-arm64':undefined;
  const name=suffix?`Guitar-io-${version}-${suffix}.zip`:'';
  const asset=(data.assets || []).find(a=>a.name===name);
  let downloadUrl='';if(asset){const url=new URL(asset.browser_download_url);if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash||url.pathname!==`/${repository}/releases/download/${data.tag_name}/${name}`)throw new Error('The release download does not belong to the configured repository.');downloadUrl=url.href;}
  return {status:newer(version,current)?(downloadUrl?'available':'missing-build'):'current',latestVersion:version,releaseUrl,downloadUrl,assetName:asset?.name || '',size:asset?.size,digest:asset?.digest,message:newer(version,current)&&!downloadUrl?'An update for this computer is not available yet.':''};
}
class UpdateService{
  constructor({directory,currentVersion,platform=process.platform,arch=process.arch,fetcher=fetch,openExternal,installerOptions,onChange=()=>{}}){this.file=path.join(directory,'updates.json');this.currentVersion=currentVersion;this.platform=platform;this.arch=arch;this.fetcher=fetcher;this.openExternal=openExternal;this.onChange=onChange;this.config={...require('./update-config.json'),autoUpdate:true};this.result={status:'unchecked',message:''};if(installerOptions){const {UpdateInstaller}=require('./update-installer.cjs');this.installer=new UpdateInstaller({directory,platform,fetcher,...installerOptions,notify:change=>this.changed(change)});}}
  changed(change){this.result={...this.result,...change};this.onChange(this.status());}
  async load(){try{const saved=JSON.parse(await fs.readFile(this.file,'utf8'));this.config.autoUpdate=saved.autoUpdate ?? saved.checkOnLaunch!==false;this.config.checkOnLaunch=this.config.autoUpdate;if(saved.cache?.repository===this.config.repository&&saved.cache.data&&saved.cache.data.assets?.some(a=>/^sha256:[a-f0-9]{64}$/.test(a.digest || ''))){this.result=releaseInfo(saved.cache.data,this.currentVersion,this.platform,this.arch,this.config.repository);this.cache=saved.cache;}}catch{}
    const outcome=await fs.readFile(path.join(path.dirname(this.file),'update-result.json'),'utf8').then(s=>JSON.parse(s.replace(/^\uFEFF/,''))).catch(()=>undefined);
    if(outcome?.status==='failed')this.result={status:'error',message:outcome.message || 'Update could not finish. Try again.'};
    this.failedInstall=outcome?.status==='failed';
    return this.status();}
  status(){return {...this.config,...this.result,currentVersion:this.currentVersion,platform:this.platform,arch:this.arch,autoInstallPaused:!!this.failedInstall};}
  async activate(){
    const file=path.join(path.dirname(this.file),'update-result.json'),outcome=await fs.readFile(file,'utf8').then(s=>JSON.parse(s.replace(/^\uFEFF/,''))).catch(()=>undefined);
    if(outcome?.status!=='installed'||outcome.version!==this.currentVersion||outcome.activated)return;
    outcome.activated=true;outcome.pid=process.pid;this.failedInstall=false;
    const temp=file+'.activation.tmp';await fs.writeFile(temp,JSON.stringify(outcome));await fs.rename(temp,file);
    if(this.platform==='darwin'&&/^[a-f0-9-]{36}$/.test(outcome.rollbackToken || '')&&this.installer){const parent=path.dirname(path.resolve(path.dirname(this.installer.execPath),'../..')),backup=path.join(parent,`.Guitar.io-rollback-${outcome.rollbackToken}.app`);if(!(await fs.lstat(backup).catch(()=>undefined))?.isSymbolicLink())await require('./update-installer.cjs').removeStage(parent,backup).catch(()=>{});}
  }
  async persist(){this.writing=(this.writing || Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await fs.writeFile(temp,JSON.stringify({...this.config,cache:this.cache}),'utf8');await fs.rename(temp,this.file);});await this.writing;}
  async settings(value){if(typeof value?.autoUpdate!=='boolean'&&typeof value?.checkOnLaunch!=='boolean')throw Error('Invalid update preference.');this.config.autoUpdate=value.autoUpdate ?? value.checkOnLaunch;this.config.checkOnLaunch=this.config.autoUpdate;await this.persist();this.onChange(this.status());return this.status();}
  async check(){
    if(['downloading','preparing','ready','installing'].includes(this.result.status))return this.status();
    if(this.pending)return this.pending;
    this.pending=(async()=>{const repository=this.config.repository;
      try{
        const response=await this.fetcher(`https://api.github.com/repos/${repository}/releases/latest`,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':`Guitar.io/${this.currentVersion}`,...(this.cache?.etag?{'If-None-Match':this.cache.etag}:{})},signal:AbortSignal.timeout(10000)});
        if(response.status===404){this.result={status:'no-release',message:'No update is available yet.'};return this.status();}
        if(!response.ok&&response.status!==304)throw new Error(response.status===403||response.status===429?'Update checks are temporarily limited. Try again later.':'Could not check for updates. Try again.');
        let data;if(response.status===304){if(!this.cache?.data)throw new Error('Check for updates again.');data=this.cache.data;}else{const text=await response.text();if(text.length>1024*1024)throw new Error('Invalid update response.');const raw=JSON.parse(text);data={tag_name:raw.tag_name,draft:raw.draft,prerelease:raw.prerelease,assets:(raw.assets || []).map(a=>({name:a.name,browser_download_url:a.browser_download_url,size:a.size,digest:a.digest}))};}
        const result=releaseInfo(data,this.currentVersion,this.platform,this.arch,repository);
        if(repository!==this.config.repository)return this.status();
        this.result={...result,lastChecked:new Date().toISOString()};this.cache={repository,etag:response.headers.get('etag') || '',data};await this.persist();this.onChange(this.status());
      }catch(error){this.result={status:'error',message:error instanceof Error?error.message:'Update check unavailable. Your library remains available.'};}
      return this.status();
    })().finally(()=>{this.pending=undefined;});return this.pending;
  }
  async prepare(){if(!this.installer)throw Error('Update installation is unavailable.');if(!['available','ready'].includes(this.result.status))throw Error('Check for updates first.');try{await this.installer.prepare(this.result);return this.status();}catch(error){this.changed({status:'error',message:error.message});return this.status();}}
  async install(options={}){try{if(!this.installer)throw Error('Update installation is unavailable.');this.changed({message:''});await this.installer.install(true,options);return this.status();}catch(error){this.changed({status:this.installer?.ready?'ready':'error',message:error.message});throw error;}}
  async open(target){const url=target==='download'&&this.result.status==='available'?this.result.downloadUrl:target==='release'&&this.result.releaseUrl?this.result.releaseUrl:`https://github.com/${this.config.repository}/releases`;await this.openExternal(url);}
}
module.exports={UpdateService,repositorySlug,versionParts,newer,releaseInfo};
