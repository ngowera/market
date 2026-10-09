import { build } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await build({configFile:'pages/vite.config.mjs'});
const html=await readFile('out-pages/index.html','utf8');
const catalogue=await readFile('lib/catalog.ts','utf8');
const slugs=[...catalogue.matchAll(/slug: "([^"]+)"/g)].map(m=>m[1]);
for(const route of [
 'browse','admin','account','help','help/bidding','help/terms',
 'help/privacy-and-complaints',...slugs.map(s=>'listing/'+s)
]){
 await mkdir('out-pages/'+route,{recursive:true});await writeFile('out-pages/'+route+'/index.html',html);
}
await writeFile('out-pages/404.html',html);
await writeFile('out-pages/.nojekyll','');
