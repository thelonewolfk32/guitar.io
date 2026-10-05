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
  return {status:newer(version,current)?(downloadUrl?'available':'missing-build'):'current',latestVersion:version,releaseUrl,downloadUrl,assetName:asset?.name || '',message:newer(version,current)&&!downloadUrl?'This release does not include a build for this computer.':''};
}
class UpdateService{
  constructor({directory,currentVersion,platform=process.platform,arch=process.arch,fetcher=fetch,openExternal}){this.file=path.join(directory,'updates.json');this.currentVersion=currentVersion;this.platform=platform;this.arch=arch;this.fetcher=fetcher;this.openExternal=openExternal;this.config={...require('./update-config.json')};this.result={status:'unchecked',message:''};}
  async load(){try{const saved=JSON.parse(await fs.readFile(this.file,'utf8'));this.config={repository:repositorySlug(saved.repository),checkOnLaunch:saved.checkOnLaunch!==false};if(saved.cache?.repository===this.config.repository&&saved.cache.data){releaseInfo(saved.cache.data,this.currentVersion,this.platform,this.arch,this.config.repository);this.cache=saved.cache;}}catch{}return this.status();}
  status(){return {...this.config,...this.result,currentVersion:this.currentVersion,platform:this.platform,arch:this.arch};}
  async persist(){await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await fs.writeFile(temp,JSON.stringify({...this.config,cache:this.cache}),'utf8');await fs.rename(temp,this.file);}
  async settings(value){const repository=repositorySlug(value.repository),changed=repository!==this.config.repository;this.config={repository,checkOnLaunch:value.checkOnLaunch!==false};if(changed){this.cache=undefined;this.result={status:'unchecked',message:''};}await this.persist();return this.status();}
  async check(){
    if(this.pending)return this.pending;
    this.pending=(async()=>{const repository=this.config.repository;
      try{
        const response=await this.fetcher(`https://api.github.com/repos/${repository}/releases/latest`,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':`Guitar.io/${this.currentVersion}`,...(this.cache?.etag?{'If-None-Match':this.cache.etag}:{})},signal:AbortSignal.timeout(10000)});
        if(response.status===404){this.result={status:'no-release',message:'No public release found. Publish a stable release with the Windows and Mac ZIP files. Private repositories need a separate public download repository.'};return this.status();}
        if(!response.ok&&response.status!==304)throw new Error(response.status===403||response.status===429?'GitHub update checks are temporarily limited. Try again later.':`GitHub update check failed (${response.status}).`);
        let data;if(response.status===304){if(!this.cache?.data)throw new Error('GitHub returned an empty update response. Try again.');data=this.cache.data;}else{const text=await response.text();if(text.length>1024*1024)throw new Error('GitHub release metadata is too large.');const raw=JSON.parse(text);data={tag_name:raw.tag_name,draft:raw.draft,prerelease:raw.prerelease,assets:(raw.assets || []).map(a=>({name:a.name,browser_download_url:a.browser_download_url}))};}
        const result=releaseInfo(data,this.currentVersion,this.platform,this.arch,repository);
        if(repository!==this.config.repository)return this.status();
        this.result={...result,lastChecked:new Date().toISOString()};this.cache={repository,etag:response.headers.get('etag') || '',data};await this.persist();
      }catch(error){this.result={status:'error',message:error instanceof Error?error.message:'Update check unavailable. Your library remains available.'};}
      return this.status();
    })().finally(()=>{this.pending=undefined;});return this.pending;
  }
  async open(target){const url=target==='download'&&this.result.status==='available'?this.result.downloadUrl:target==='release'&&this.result.releaseUrl?this.result.releaseUrl:`https://github.com/${this.config.repository}/releases`;await this.openExternal(url);}
}
module.exports={UpdateService,repositorySlug,versionParts,newer,releaseInfo};
