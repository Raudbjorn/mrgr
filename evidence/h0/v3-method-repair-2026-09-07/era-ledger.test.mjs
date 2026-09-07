import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {eraStratum,screen} from '../v3-screen-go.mjs';
const d=mkdtempSync(join(tmpdir(),'mrgr-era-ledger-'));
try{
 const repo=join(d,'repo');mkdirSync(repo);
 const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:'pipe'}).trim();
 git('init');writeFileSync(join(repo,'README'),'fixture');
 const commit=()=>{git('add','.');git('-c','user.name=H0','-c','user.email=h0@example.invalid','commit','-m','fixture');return git('rev-parse','HEAD');};
 const legacy=commit();mkdirSync(join(repo,'sub'));writeFileSync(join(repo,'sub/go.mod'),'module example.invalid/sub\n');const nested=commit();
 writeFileSync(join(repo,'go.mod'),'module example.invalid/root\n');const module=commit();
 assert.equal(eraStratum(repo,legacy,'README').era,'GOPATH');assert.equal(eraStratum(repo,nested,'sub/a.go').nested_module_exceptions.length,1);
 assert.equal(eraStratum(repo,nested,'elsewhere/a.go').nested_module_exceptions.length,0);
 const info=eraStratum(repo,module,'sub/a.go');assert.equal(info.era,'module');assert.equal(info.root_go_mod.oid,git('rev-parse',`${module}:go.mod`));assert.equal(info.tree,git('rev-parse',`${module}^{tree}`));
 const triples=join(d,'triples.jsonl');writeFileSync(triples,[legacy,nested,module].map(merge_sha=>JSON.stringify({merge_sha,path:'README',ordinal:0,base:'',ours:'',theirs:'',resolution:'fixture'})).join('\n'));
 const config=join(d,'config.json');writeFileSync(config,JSON.stringify({repo:'example/fixture',repository:repo,triples,output:join(d,'screen'),limit:3}));
 const result=await screen(config);assert.equal(result.screened,0);
 const frame=JSON.parse(readFileSync(join(d,'screen/frame.json')));assert.equal(frame.rows.length,3);assert(frame.rows.every(r=>r.reason==='outside-production-go-screen'&&r.era.availability==='available'&&r.era.recorded_at));
 assert.equal(frame.rows.find(r=>r.event===legacy).era.era,'GOPATH');assert.equal(frame.rows.find(r=>r.event===module).era.era,'module');assert.equal(frame.complete,true);
 console.log('Era ledger controls passed: historical tree/blob provenance, root/nested distinction, era retained for all pre-oracle exclusions. No builds, acquisition or model calls.');
}finally{rmSync(d,{recursive:true,force:true});}
