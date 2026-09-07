import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {git,hash} from '../v3-data.mjs';
import {boundaryContract} from './boundary-contract.mjs';
const source=process.argv[2]??'evidence/h0/v3-development-2026-09-06e',cases=JSON.parse(readFileSync(`${source}/cases.json`)),rows=[];
for(const c of cases){const d=mkdtempSync(join(tmpdir(),'mrgr-boundary-audit-'));try{
  for(const side of ['ours','base','theirs'])writeFileSync(join(d,side),side==='base'&&git(c.git.directory,'ls-tree','-z',c.git.base,'--',c.path).length===0?Buffer.alloc(0):git(c.git.directory,'show',`${c.git[side]}:${c.path}`));
  const r=spawnSync('git',['merge-file','--diff3','--diff-algorithm=myers','-L','ours','-L','base','-L','theirs','-p',join(d,'ours'),join(d,'base'),join(d,'theirs')],{timeout:30000,maxBuffer:16*1024*1024});assert(!r.error&&r.status>0&&r.status<=127);
  // Oracle-side localization chooses the admitted hunk, but only parent-derived
  // automatic bytes and validated parent spans enter the boundary constructor.
  const b=boundaryContract(r.stdout,c.git_validation.localized.automaticRanges,{ours:c.ours,base:c.base,theirs:c.theirs});
  const actual=readFileSync(join(c.evaluator.scaffold,c.evaluator.target));
  const prefix=actual.subarray(0,c.evaluator.start_byte),suffix=actual.subarray(c.evaluator.end_byte);
  const prefixMatches=b.prefix.length===0||prefix.subarray(-Buffer.byteLength(b.prefix)).equals(Buffer.from(b.prefix));
  const suffixMatches=suffix.subarray(0,Buffer.byteLength(b.suffix)).equals(Buffer.from(b.suffix));
  const broadPrefix=b.automatic_prefix.length===0||prefix.subarray(-Buffer.byteLength(b.automatic_prefix)).equals(Buffer.from(b.automatic_prefix));
  const broadSuffix=suffix.subarray(0,Buffer.byteLength(b.automatic_suffix)).equals(Buffer.from(b.automatic_suffix));
  rows.push({id:c.id,repo:c.repo,path:c.path,boundary:b,prefix_matches_evaluator:prefixMatches,suffix_matches_evaluator:suffixMatches,broader_automatic_context_matches_scaffold:broadPrefix&&broadSuffix,eligible_for_this_boundary_contract:prefixMatches&&suffixMatches});
}catch(e){rows.push({id:c.id,error:e.message,eligible_for_this_boundary_contract:false});}finally{rmSync(d,{recursive:true,force:true});}}
const result={at:new Date().toISOString(),source_protocol_sha256:hash(readFileSync(`${source}/protocol.json`)),source_cases_sha256:hash(readFileSync(`${source}/cases.json`)),source_hashes:Object.fromEntries(['boundary-contract.mjs','audit-boundaries.mjs'].map(p=>[p,hash(readFileSync(join(import.meta.dirname,p)))])),cases:rows.length,constructed:rows.filter(r=>r.boundary).length,matches:rows.filter(r=>r.eligible_for_this_boundary_contract).length,rows,solver_requests:0,rule:'Audit only; no exclusions, prompt changes or evidence rewrites in either frozen run.'};
writeFileSync(join(import.meta.dirname,'boundary-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined}));
