const {verify,createPublicKey}=require('node:crypto');
function secureUrl(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('Update hosting requires HTTPS.');return url;}
function httpsConfig(config){const url=secureUrl(config.manifestUrl),key=createPublicKey(config.publicKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Configure an Ed25519 update public key.');const origins=config.allowedDownloadOrigins || [url.origin];if(!Array.isArray(origins)||!origins.length||origins.some(origin=>secureUrl(origin).origin!==origin))throw Error('Invalid update download origins.');return {url,key,origins};}
function signedReleaseInfo(envelope,current,platform,arch,config,now=Date.now()){
 const {key,origins}=httpsConfig(config);if(!envelope||typeof envelope.payload!=='string'||typeof envelope.signature!=='string'||envelope.payload.length>256*1024||!/^[A-Za-z0-9_-]+$/.test(envelope.payload)||!/^[A-Za-z0-9_-]+$/.test(envelope.signature))throw Error('Invalid signed update manifest.');
 const payload=Buffer.from(envelope.payload,'base64url'),signature=Buffer.from(envelope.signature,'base64url');if(signature.length!==64||!verify(null,payload,key,signature))throw Error('Update manifest signature verification failed.');
 const data=JSON.parse(payload.toString('utf8')),version=data.version,expires=Date.parse(data.expiresAt),issued=Date.parse(data.issuedAt);
 if(data.schema!==1||!/^\d+\.\d+\.\d+$/.test(version)||!Number.isFinite(expires)||expires<=now||expires>now+86400000||!Number.isFinite(issued)||issued>now+300000||expires<=issued)throw Error('The signed update manifest expired or is invalid. Check again.');
 const suffix=platform==='win32'&&arch==='x64'?'Windows-x64':platform==='darwin'&&arch==='arm64'?'macOS-arm64':undefined,name=suffix?`Guitar-io-${version}-${suffix}.zip`:'';
 if(!Array.isArray(data.assets)||data.assets.length>10)throw Error('Invalid update asset list.');const asset=data.assets.find(a=>a.name===name);
 if(asset){const url=secureUrl(asset.downloadUrl);if(!origins.includes(url.origin)||decodeURIComponent(url.pathname.split('/').at(-1))!==name||!/^sha256:[a-f0-9]{64}$/.test(asset.digest)||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>512*1024*1024)throw Error('Invalid signed update download.');}
 const a=version.split('.').map(Number),b=current.split('.').map(Number);if([...a,...b].some(n=>!Number.isSafeInteger(n)))throw Error('Invalid update version.');const newer=a.some((n,i)=>n>b[i]&&a.slice(0,i).every((v,j)=>v===b[j]));
 const releaseUrl=data.releaseUrl?secureUrl(data.releaseUrl).href:config.manifestUrl;
 return {status:newer?(asset?'available':'missing-build'):'current',latestVersion:version,releaseUrl,downloadUrl:asset?.downloadUrl || '',assetName:asset?.name || '',size:asset?.size,digest:asset?.digest,message:newer&&!asset?'An update for this computer is not available yet.':''};
}
module.exports={httpsConfig,signedReleaseInfo};
