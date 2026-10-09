import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,copyFile,lstat} from 'node:fs/promises';
import path from 'node:path';
const destination=process.argv[2];
if(!destination || !path.isAbsolute(destination))throw new Error('Supply an absolute path to a new export directory.');
await mkdir(destination,{recursive:false});
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const files=[...new Set([...tracked,'.github/workflows/build.yml','scripts/export-github.mjs'])];
const forbidden=p=>/(^|\/)readme(?:\.[^/]*)?$/i.test(p)||/(^|\/)\.env(?:\.|$)/.test(p)||p.startsWith('.git/')||p.startsWith('.sites-runtime/')||p.startsWith('node_modules/')||p.startsWith('dist/')||p.startsWith('supabase/.temp/')||p.endsWith('.tsbuildinfo');
let count=0;
for(const file of files){
 if(forbidden(file))continue;
 if(!(await lstat(file)).isFile())throw new Error('Export only regular files: '+file);
 const target=path.join(destination,file);await mkdir(path.dirname(target),{recursive:true});
 if(file==='.openai/hosting.json'){
  await writeFile(target,JSON.stringify({d1:null,r2:null},null,2)+'\n');
 }else await copyFile(file,target);
 count++;
}
console.log(JSON.stringify({destination,files:count,readmes:false,environmentFiles:false,gitHistory:false}));
