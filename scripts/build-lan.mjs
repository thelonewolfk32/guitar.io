import {build} from 'esbuild';
await build({entryPoints:['electron/lan-service.mjs'],outfile:'electron/lan-bundle.cjs',platform:'node',format:'cjs',target:'node22',bundle:true});
