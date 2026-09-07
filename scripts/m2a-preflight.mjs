#!/usr/bin/env node
// Reproduce the deterministic port on pinned private fork legs. No model calls.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const [sourceArg,outputArg]=process.argv.slice(2);
assert(sourceArg&&outputArg,'Usage: node scripts/m2a-preflight.mjs <source-repository> <new-output-directory>');
const source=resolve(sourceArg),output=resolve(outputArg),repo=join(output,'repo');
assert(!existsSync(output),'Refuse to overwrite an existing preflight');mkdirSync(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_AUTHOR_DATE:'2026-09-06T00:00:00Z',GIT_COMMITTER_DATE:'2026-09-06T00:00:00Z'};
execFileSync('git',['clone','--quiet','--no-checkout','--no-hardlinks',source,repo],{env,timeout:120000});
const git=(...args)=>execFileSync('git',args,{cwd:repo,env,encoding:'utf8',maxBuffer:32*1024*1024,timeout:300000}).trim();
const quote=s=>`'${s.replaceAll("'","'\\''")}'`;
const driver=join(root,'packages/mechanisms/bin/mrgr-merge-driver.mjs');
const legs={fork4:{base:'4a7299091d226d34baa593ba83c0af0d661bdbef',ours:'b2d25948e9668982afcda5a9e4a515ff3fe08d97',theirs:'c687b532782dd6464e779f6f028361d0c427fb76'},fork6:{base:'83c6e7d4d4642629257aa1b0ef8eacc77fcaf954',ours:'b2d25948e9668982afcda5a9e4a515ff3fe08d97',theirs:'9c25e84e4790283be52bba5df8a33e9ca15f1356'}};
for(const [name,refs] of Object.entries(legs))for(const [side,id] of Object.entries(refs)){git('cat-file','-e',`${id}^{commit}`);git('update-ref',`refs/mrgr-inputs/${name}-${side}`,id);}
git('checkout','--quiet','--detach',legs.fork4.ours);
git('config','user.name','mrgr preflight');git('config','user.email','preflight@example.invalid');
git('config','core.autocrlf','false');git('config','core.quotePath','false');git('config','core.attributesfile','/dev/null');git('config','merge.conflictStyle','diff3');
const sources=['scripts/m2a-preflight.mjs','packages/mechanisms/src/adapter.ts','packages/mechanisms/src/cli.ts','packages/mechanisms/bin/mrgr-merge-driver.mjs','packages/mechanisms/dist/adapter.js','packages/mechanisms/dist/cli.js'];
const protocol={version:'mrgr-m2a-preflight/1',created_at:new Date().toISOString(),source_repository:source,source_head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),legs,runs:5,node:process.version,git:git('--version'),mergiraf:execFileSync(process.env.MERGIRAF_BIN??'mergiraf',['--version'],{encoding:'utf8'}).trim(),diff3:execFileSync('diff3',['--version'],{encoding:'utf8'}).split('\n')[0],source_hashes:Object.fromEntries(sources.map(p=>[p,sha(readFileSync(join(root,p)))])),claim:'deterministic mechanism port and residue characterization, not behavioral correctness, mechanism superiority, or the old model experiment'};
assert.equal(protocol.mergiraf,'mergiraf 0.19.0');
writeFileSync(join(output,'protocol.json'),JSON.stringify(protocol,null,2)+'\n');
const cells=[];
for(const [name,refs] of Object.entries(legs)){
 const binaries=new Set();
 for(const tip of [refs.ours,refs.theirs]){
  const numstat=git('diff','--no-renames','--numstat','-z',refs.base,tip);
  for(const entry of numstat.split('\0'))if(entry.startsWith('-\t-\t'))binaries.add(entry.slice(4));
 }
 const attrs=mechanism=>`* merge=${mechanism} conflict-marker-size=7\n`+[...binaries].sort().map(p=>`${JSON.stringify('/'+p)} -text -diff merge=binary\n`).join('');
 const execute=(label)=>{
  const dir=join(output,label);mkdirSync(dir);const logs=join(dir,'invocations');mkdirSync(logs);
  const args=['merge-tree','--write-tree','--name-only','-z',`--merge-base=${refs.base}`,refs.ours,refs.theirs];
  const result=spawnSync('git',args,{cwd:repo,env:{...env,MRGR_MECHANISM_LOG_DIR:logs},encoding:'utf8',timeout:300000,maxBuffer:32*1024*1024});
  writeFileSync(join(dir,'stdout'),result.stdout??'');writeFileSync(join(dir,'stderr'),result.stderr??'');
  assert(!result.error,result.error?.message);assert([0,1].includes(result.status),`${label}: fatal outer Git ${result.status}`);
  const parts=result.stdout.split('\0'),tree=parts.shift(),separator=parts.indexOf('');assert.match(tree,/^[a-f0-9]{40}$/);assert(separator>=0);
  const residue=parts.slice(0,separator).sort();assert.equal(result.status===0,residue.length===0);
  const invocations=readdirSync(logs).map(p=>JSON.parse(readFileSync(join(logs,p))));
  for(const r of invocations){assert.equal(r.state,'completed');assert([0,1].includes(r.driverStatus));assert.equal(r.error,null);assert.equal(r.signal,null);}
  const commit=execFileSync('git',['commit-tree',tree,'-p',refs.ours,'-p',refs.theirs,'-m',`M2a ${label}; unresolved residue retained`],{cwd:repo,env,encoding:'utf8'}).trim();
  git('update-ref',`refs/mrgr-results/${label}`,commit);
  const record={label,args,outerGitStatus:result.status,tree,commit,residue,invocations,binaryFallback:[...binaries].filter(p=>residue.includes(p)).sort().map(path=>({path,attribute:'merge=binary',invokedTextMechanism:false,unresolved:true})),stdout_sha256:sha(result.stdout),stderr_sha256:sha(result.stderr)};
  writeFileSync(join(dir,'result.json'),JSON.stringify(record,null,2)+'\n');return record;
 };
 writeFileSync(join(repo,'.git/info/attributes'),attrs('text'));
 const baseline=execute(`${name}-native`);
 for(const mechanism of ['git_text','gnu_diff3','mergiraf']){
  writeFileSync(join(repo,'.git/info/attributes'),attrs(mechanism));
  git('config',`merge.${mechanism}.driver`,`${quote(process.execPath)} ${quote(driver)} ${mechanism} %O %A %B %L %P`);
  git('config',`merge.${mechanism}.recursive`,'binary');
  const runs=[];
  for(let i=0;i<5;i++){
   const run=execute(`${name}-${mechanism}-${i}`);assert(run.invocations.length>0);
   const changed=git('diff','--name-only','-z',baseline.tree,run.tree).split('\0').filter(Boolean);
   assert(changed.every(p=>baseline.residue.includes(p)||run.residue.includes(p)),'Unexpected change outside either conflict residue');
   if(mechanism==='git_text')assert.deepEqual(run.residue,baseline.residue);
   if(runs.length){assert.equal(run.tree,runs[0].tree,'Tree nondeterminism');assert.deepEqual(run.residue,runs[0].residue);}
   runs.push(run);console.log(`${run.label}: tree=${run.tree} residue=${run.residue.length} invocations=${run.invocations.length}`);
  }
  cells.push({leg:name,mechanism,tree:runs[0].tree,residue:runs[0].residue,invocations_per_run:runs[0].invocations.length,deterministic_runs:5,outerGitStatuses:runs.map(r=>r.outerGitStatus),binaryFallback:runs[0].binaryFallback,nativeTree:baseline.tree,nativeResidue:baseline.residue});
 }
}
const summary={...protocol,valid:true,phase4_real_preflight_complete:true,cells,retention:'Input commits and every returned tree are rooted under refs/mrgr-inputs and refs/mrgr-results in the isolated repo. Raw stdout/stderr and invocation records are alongside each result. Private source code remains in this local evidence directory.'};
writeFileSync(join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log('Preflight complete');
