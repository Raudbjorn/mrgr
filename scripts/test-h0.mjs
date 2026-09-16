// Discover maintained H0 tests recursively, without executing frozen instruments.
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root='evidence/h0';
const maintained=['v3-method-repair-2026-09-07','v3-contrast-review-2026-09-07','v3-candidate-repair-2026-09-07'];
const privateTests=new Set(['repaired-study.test.mjs','recovery-screen.test.mjs']);
const files=readdirSync(root).filter(p=>p.endsWith('.test.mjs')).map(p=>join(root,p));
for(const directory of maintained)for(const path of readdirSync(join(root,directory),{recursive:true})){
  if(!path.endsWith('.test.mjs'))continue;
  if(privateTests.has(path)){console.log(`Excluded private historical-fixture integration: ${directory}/${path}`);continue;}
  files.push(join(root,directory,path));
}
const result=spawnSync(process.execPath,['--test',...files.sort()],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
