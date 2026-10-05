import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patchAlphaTab } from './patch-alphatab.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'node_modules/@coderline/alphatab/dist');
await access(source);
await mkdir(path.join(root, 'public/vendor/alphatab'), { recursive: true });
await cp(source, path.join(root, 'public/vendor/alphatab'), { recursive: true });
const runtime = path.join(root, 'public/vendor/alphatab/alphaTab.js');
await writeFile(runtime, patchAlphaTab(await readFile(runtime, 'utf8')));
await cp(path.join(root, 'node_modules/@coderline/alphatab/LICENSE'), path.join(root, 'public/vendor/alphatab/LICENSE'));
await cp(path.join(root, 'node_modules/@coderline/alphatab/LICENSE.header'), path.join(root, 'public/vendor/alphatab/LICENSE.header'));
await mkdir(path.join(root, 'public/licenses'), { recursive: true });
for (const packageName of ['react', 'react-dom', 'lucide-react']) {
  await cp(path.join(root, 'node_modules', packageName, 'LICENSE'), path.join(root, 'public/licenses', packageName + '-LICENSE'));
}
console.log('Notation engine, fonts and soundfont prepared for offline use.');
