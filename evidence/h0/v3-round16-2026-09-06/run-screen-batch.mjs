// Sequential acquisition screen, after the development evaluator is terminal.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,statfsSync,openSync,closeSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {join} from 'node:path';
import {hash} from '../v3-data.mjs';
const base=import.meta.dirname,read=p=>JSON.parse(readFileSync(p));
const manifestPath=join(base,'screen-configs.json'),manifest=read(manifestPath),script='evidence/h0/v3-screen-go.mjs';
const statePath=join(base,'screen-batch-state.json'),freezePath=join(base,'screen-batch-freeze.json');
assert(!existsSync(freezePath),'Refuse restarting a batch; inspect individual terminal receipts first');
assert.equal(hash(readFileSync(script)),manifest.screen_script_sha256);
const configs=manifest.configs.map(row=>{
  const c=read(row.config);assert.equal(c.repo,row.repo);assert.equal(c.output,row.output);
  assert.equal(hash(readFileSync(c.triples)),row.triples_sha256);assert(!existsSync(c.output));
  return {...row,config_sha256:hash(readFileSync(row.config))};
});
writeFileSync(freezePath,JSON.stringify({at:new Date().toISOString(),configs,manifest_sha256:hash(readFileSync(manifestPath)),script_sha256:manifest.screen_script_sha256,rule:'Original frozen order and limit 12; sequential; wait for revised development process to finish; require 8 GiB free on workspace and tmp before each repository; no solver requests or automatic confirmation admission'},null,2)+'\n');
const completed=[];const save=x=>writeFileSync(statePath,JSON.stringify({at:new Date().toISOString(),pid:process.pid,completed,...x},null,2)+'\n');
try {
  for(;;){
    const owner=read(join(base,'revised-development-state.json'));let live=true;
    try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')live=false;else throw e;}
    if(!live){assert.equal(owner.stage,'finished','Development did not finish normally');break;}
    save({stage:'waiting-for-development',development_pid:owner.pid});await setTimeout(15000);
  }
  for(const row of configs){
    for(const path of ['.','/tmp']){const s=statfsSync(path);assert(s.bavail*s.bsize>=8*1024**3,`Insufficient free space on ${path}; preserve existing evidence`);}
    assert.equal(hash(readFileSync(script)),manifest.screen_script_sha256);
    assert.equal(hash(readFileSync(row.config)),row.config_sha256);assert.equal(hash(readFileSync(read(row.config).triples)),row.triples_sha256);
    const prefix=join(base,row.repo.replaceAll('/','--')+'-screen');save({stage:'screening',repo:row.repo});
    const stdout=openSync(prefix+'.stdout','wx'),stderr=openSync(prefix+'.stderr','wx');let result;
    try{result=spawnSync(process.execPath,[script,row.config],{stdio:['ignore',stdout,stderr],env:{...process.env,TMPDIR:'/tmp'}});}finally{closeSync(stdout);closeSync(stderr);}
    const terminal={repo:row.repo,status:result.status,signal:result.signal,error:result.error?.message??null,output:row.output};
    writeFileSync(prefix+'-exit.json',JSON.stringify(terminal,null,2)+'\n');completed.push(terminal);
    assert(!result.error&&result.status===0,'Screen process failed; inspect preserved receipts');
  }
  save({stage:'finished',confirmation_admissions:0});
}catch(error){save({stage:'stopped',error:error.message});process.exitCode=1;}
