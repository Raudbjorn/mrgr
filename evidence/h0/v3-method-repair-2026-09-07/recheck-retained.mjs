import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {evaluate,git,hash,treeHash} from '../v3-data.mjs';
import {packageCwd} from '../v3-screen-go.mjs';
const out=import.meta.dirname,inputs=JSON.parse(readFileSync(join(out,'retained-failures.json'))).slice(0,3);
const freeze={at:new Date().toISOString(),selection:'First three retained failures ranked by count of missing packages already present in vendor; feasibility demonstration, not representative recovery estimate.',inputs,source_sha256:hash(readFileSync(new URL(import.meta.url))),screen_sha256:hash(readFileSync(join(out,'../v3-screen-go.mjs'))),solver_requests:0};
writeFileSync(join(out,'retained-recheck-freeze.json'),JSON.stringify(freeze,null,2)+'\n',{flag:'wx'});
for(const input of inputs){
 const d=join(out,'retained-recheck',input.event);mkdirSync(d,{recursive:true});
 const records=JSON.parse(readFileSync(input.receipt)),old=records.find(r=>r.event===input.event&&r.path===input.path);assert(old.git_validation);
 const scaffold=resolve(input.directory,'scaffold'),oracle=resolve(input.directory,'oracle'),original=readFileSync(join(scaffold,input.path));
 const shipped=git(old.git_validation.parents.directory,'show',`${input.event}:${input.path}`);assert.equal(hash(shipped),old.git_validation.shipped_sha256);
 const lines=shipped.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[],range=old.git_validation.localized.resolutionRange,reference=lines.slice(range.startLine-1,range.endLineExclusive-1).join('');
 assert.equal(hash(reference),old.git_validation.reference_sha256);
 const start=original.indexOf('<<<<<<< ours\n'),close='>>>>>>> theirs\n',end=original.indexOf(close,start)+Buffer.byteLength(close);assert(start>=0&&end>start);
 assert(Buffer.concat([original.subarray(0,start),Buffer.from(reference),original.subarray(end)]).equals(shipped));
 const evaluator={scaffold,oracle,target:input.path,start_byte:start,end_byte:end,preimage_sha256:hash(original),scaffold_sha256:treeHash(scaffold),oracle_sha256:treeHash(oracle),build:['/bin/sh','/oracle/build.sh'],test:['/bin/sh','/oracle/test.sh'],test_completion:[{pattern:'^PASS$',count:1}]};
 const revised=join(d,'oracle');cpSync(oracle,revised,{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true});
 for(const name of ['build.sh','test.sh']){const file=join(revised,name),text=readFileSync(file,'utf8'),importPath=text.match(/^ln -s \/work \/tmp\/gopath\/src\/(.+)$/m)?.[1];assert(importPath);const from=packageCwd(input.path),to=packageCwd(input.path,importPath);assert.equal(text.split(from).length,2);writeFileSync(file,text.replace(from,to));}
 const receipt={input,reference_sha256:hash(reference),original_evaluator:evaluator,revised_oracle_sha256:treeHash(revised)};
 const save=()=>writeFileSync(join(d,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');save();
 receipt.before=evaluate({evaluator},reference);save();
 receipt.after=evaluate({evaluator:{...evaluator,oracle:revised,oracle_sha256:receipt.revised_oracle_sha256}},reference);save();
 console.log(JSON.stringify({repo:input.repo,event:input.event,before:receipt.before.category,after:receipt.after.category,build_after:receipt.after.stages[0].status,tests:receipt.after.stages[1]?.status}));
}
