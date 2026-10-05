/** Publish only explicitly selected release files. Credentials stay in memory. */
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const args=process.argv.slice(2),repo=args[1];
if(!['inspect','make-public','publish','verify'].includes(args[0])||!/^thelonewolfk32\/[a-zA-Z0-9_.-]+$/.test(repo || ''))throw Error('Usage: node scripts/github-release.mjs inspect|make-public|publish|verify thelonewolfk32/repository [version]');
const credential=spawnSync('git',['-c','credential.interactive=never','credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
const token=credential.stdout?.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);if(credential.status!==0||!token)throw Error('Sign into GitHub with Git Credential Manager first, or upload the files through GitHub Releases.');
async function api(route,options={}){const response=await fetch(`https://api.github.com${route}`,{...options,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Guitar.io-publisher',...(options.headers || {})}});const body=await response.json();if(!response.ok)throw Error(`GitHub ${response.status}: ${body.message || 'Request failed'}`);return body;}
if(args[0]==='inspect'){const r=await api('/repos/'+repo);console.log(JSON.stringify({name:r.full_name,private:r.private,defaultBranch:r.default_branch,permissions:r.permissions}));}
if(args[0]==='make-public'){const r=await api('/repos/'+repo,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({private:false})});console.log(JSON.stringify({repository:r.html_url,private:r.private}));}
if(args[0]==='publish'){
 const version=args[2];if(!/^\d+\.\d+\.\d+$/.test(version || ''))throw Error('Supply a release version.');
 const workspace=path.resolve('../..'),files=[`Guitar-io-${version}-Windows-x64.zip`,`Guitar-io-${version}-macOS-arm64.zip`,`Guitar-io-${version}-Source.zip`,`Guitar-io-${version}-SHA256SUMS.txt`];
 for(const file of files)await fs.access(path.join(workspace,file));
 const body=await fs.readFile(`CHANGELOG-v${version}.md`,'utf8');
 const release=await api('/repos/'+repo+'/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:'v'+version,target_commitish:args[3] || 'main',name:'Guitar.io '+version,body,draft:true,prerelease:false})});
 console.log('Draft release created: '+release.html_url);
 for(const file of files){const url=new URL(release.upload_url.replace(/\{.*\}$/,''));url.searchParams.set('name',file);const size=(await fs.stat(path.join(workspace,file))).size;const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'User-Agent':'Guitar.io-publisher','Content-Type':file.endsWith('.zip')?'application/zip':'text/plain','Content-Length':String(size)},body:createReadStream(path.join(workspace,file)),duplex:'half'});const asset=await response.json();if(!response.ok)throw Error(`Upload failed (${response.status}): ${asset.message}. Release remains a draft.`);console.log(JSON.stringify({asset:asset.name,size:asset.size}));}
 const published=await api('/repos/'+repo+'/releases/'+release.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false,make_latest:'true'})});console.log('Published: '+published.html_url);
}
if(args[0]==='verify'){const r=await api('/repos/'+repo+'/releases/latest');console.log(JSON.stringify({release:r.html_url,version:r.tag_name,draft:r.draft,assets:r.assets.map(a=>({name:a.name,size:a.size,digest:a.digest}))}));}
