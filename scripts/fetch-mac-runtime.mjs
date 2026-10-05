import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url)),config=JSON.parse(await fs.readFile(path.join(project,'package.json'),'utf8'));
const version=config.devDependencies.electron,folder=path.join(project,'release/mac-runtime'),name=`electron-v${version}-darwin-arm64.zip`;
await fs.mkdir(folder,{recursive:true});
const base=`https://github.com/electron/electron/releases/download/v${version}/`;
const checks=await fetch(base+'SHASUMS256.txt');if(!checks.ok)throw Error('Cannot fetch official Electron checksums.');const text=await checks.text();
const expected=text.split('\n').find(line=>line.trim().split(/\s+/).at(-1).replace(/^\*/,'')===name)?.split(/\s+/)[0];if(!/^[a-f0-9]{64}$/.test(expected || ''))throw Error('Missing runtime checksum.');
let bytes=await fs.readFile(path.join(folder,name)).catch(()=>undefined);
if(!bytes||createHash('sha256').update(bytes).digest('hex')!==expected){const response=await fetch(base+name);if(!response.ok)throw Error('Cannot fetch official Mac runtime.');bytes=Buffer.from(await response.arrayBuffer());}
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Runtime checksum mismatch.');
await fs.writeFile(path.join(folder,name),bytes);await fs.writeFile(path.join(folder,'SHASUMS256.txt'),text,'utf8');console.log('Verified official Electron '+version+' macOS arm64 runtime.');
