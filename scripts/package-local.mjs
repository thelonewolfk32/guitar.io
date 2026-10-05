/** Reuse the supplied Electron 44.4.5 Windows runtime; do not alter the old app. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const project = fileURLToPath(new URL('../', import.meta.url));
const workspace = process.env.GUITARIO_OUTPUT_DIR?path.resolve(process.env.GUITARIO_OUTPUT_DIR):path.resolve(project, '../..');
const baseline = path.resolve(project,'../../Guitar-io-1.2.4-Windows-x64');
const runtime = await fs.access(baseline).then(()=>baseline).catch(()=>path.join(project,'node_modules/electron/dist'));
const config = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
const output = path.join(workspace, `Guitar-io-${config.version}-Windows-x64`);
await fs.mkdir(path.join(project, 'release'), { recursive: true });
const stage = await fs.mkdtemp(path.join(project, 'release/app-'));
const require = createRequire(import.meta.url);
// Resolve the ASAR implementation installed with electron-builder under pnpm.
let asar;
try{asar=require('@electron/asar');}catch{
  const packages = await fs.readdir(path.join(project, 'node_modules/.pnpm'));
  const asarPackage = packages.find(name => name.startsWith('@electron+asar@'));
  if (!asarPackage) throw new Error('Install project dependencies first.');
  asar = require(path.join(project, 'node_modules/.pnpm', asarPackage, 'node_modules/@electron/asar/lib/asar.js'));
}
await fs.mkdir(stage, { recursive: true });
await fs.mkdir(path.join(output, 'resources'), { recursive: true });
for (const name of ['dist', 'electron']) await fs.cp(path.join(project, name), path.join(stage, name), { recursive: true });
await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: config.name, version: config.version, main: config.main, type: config.type, private: true }, null, 2));
await fs.copyFile(path.join(project, 'THIRD_PARTY_NOTICES.md'), path.join(stage, 'THIRD_PARTY_NOTICES.md'));
await asar.createPackage(stage, path.join(output, 'resources/app.asar'));
for (const name of await fs.readdir(runtime)) {
  if (/\.(exe|dll|bin|dat|pak|json)$/.test(name) && !name.startsWith('.')) await fs.copyFile(path.join(runtime, name), path.join(output, name==='electron.exe'?'Guitar.io.exe':name));
}
await fs.cp(path.join(runtime, 'locales'), path.join(output, 'locales'), { recursive: true });
for (const name of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) {const source=await fs.access(path.join(runtime,name)).then(()=>name).catch(()=>name==='LICENSE.electron.txt'?'LICENSE':name);await fs.copyFile(path.join(runtime,source),path.join(output,name));}
for (const name of ['README.md','START_HERE.txt','MACOS_BUILD.md','THIRD_PARTY_NOTICES.md',`CHANGELOG-v${config.version}.md`,`VALIDATION-v${config.version}.md`,'GITHUB_RELEASES.md','PERFORMANCE.md','PERFORMANCE.json','SYNC.md']) await fs.copyFile(path.join(project,name),path.join(output,name));
if(!stage.startsWith(path.join(project,'release','app-')))throw new Error('Unexpected staging path.');
await fs.rm(stage,{recursive:true,force:true});
console.log(output);
