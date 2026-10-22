import fs from 'node:fs/promises';import path from 'node:path';import {generateKeyPairSync,createHash,createPrivateKey} from 'node:crypto';
const [command,directory=path.resolve('release/signing'),releaseUrl]=process.argv.slice(2);
if(command==='keys'){
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'update-private.pem'),privateKey.export({format:'pem',type:'pkcs8'}),{flag:'wx',mode:0o600});await fs.writeFile(path.join(directory,'update-public.pem'),publicKey.export({format:'pem',type:'spki'}),{flag:'wx'});await fs.writeFile(path.join(directory,'server-signing-secret.txt'),privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),{flag:'wx',mode:0o600});console.log('Signing files created in '+path.resolve(directory)+'. Keep private files outside source and archives.');
}else if(command==='descriptor'){
 const version=JSON.parse(await fs.readFile('package.json','utf8')).version;if(!releaseUrl||new URL(releaseUrl).protocol!=='https:')throw Error('Supply an HTTPS release-notes URL after the archive directory.');const assets=[];
 for(const suffix of ['Windows-x64','macOS-arm64']){const name=`Guitar-io-${version}-${suffix}.zip`,bytes=await fs.readFile(path.join(directory,name));assets.push({name,path:`${version}/${name}`,size:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex')});}
 const output=path.join(directory,'update-descriptor.json');await fs.writeFile(output,JSON.stringify({version,releaseUrl,assets},null,2),{flag:'wx'});console.log('Update descriptor: '+path.resolve(output));
}else if(command==='check-key'){
 const key=createPrivateKey(await fs.readFile(directory));if(key.asymmetricKeyType!=='ed25519')throw Error('Use an Ed25519 key.');console.log('Ed25519 private key is valid.');
}else throw Error('Use keys [output-directory], descriptor [archive-directory] [HTTPS-release-notes-URL], or check-key [private-key-file].');
