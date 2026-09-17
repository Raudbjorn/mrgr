import {verifiedOracle} from '../../evidence/h0/mutant-disposition.mjs';
// Reuse the scientific oracle and deterministic engines without reopening H0.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {hash,git,environmentHash,verifyGitCase,validateOracle} from '../../evidence/h0/v3-data.mjs';
import {baselines,checkGroups} from '../../evidence/h0/v3.mjs';
import {boundaryContract} from '../../evidence/h0/v3-contrast-review-2026-09-07/boundary-contract.mjs';
import {candidates} from '../../evidence/h0/v3-candidate-repair-2026-09-07/candidate-arms.mjs';
const [manifest,metadata,output]=process.argv.slice(2);
mkdirSync(output,{recursive:true});
const save=(name,x)=>{writeFileSync(join(output,name)+'.tmp',JSON.stringify(x,null,2)+'\n');renameSync(join(output,name)+'.tmp',join(output,name));};
const meta=JSON.parse(readFileSync(metadata));
const rows=[];
for(const c of JSON.parse(readFileSync(manifest))){
 const row={repo:c.repo,event:c.event,status:'started'};rows.push(row);
 try{
  c.id=hash(JSON.stringify([c.repo,c.event,c.path,c.base,c.ours,c.theirs]));
  c.cluster_id=(meta.source??meta).full_name.toLowerCase();
  c.evaluator.environment_sha256=environmentHash();c.git_validation=verifyGitCase(c);
  c.oracle_validation=validateOracle(c);c.oracle_validation.valid=verifiedOracle(c.oracle_validation);save('progress.json',rows);assert(c.oracle_validation.valid,'oracle control failure');
  const d=mkdtempSync(join(tmpdir(),'lora-boundary-'));
  try{
   for(const side of ['base','ours','theirs'])writeFileSync(join(d,side),side==='base'&&!git(c.git.directory,'ls-tree','-z',c.git.base,'--',c.path).length?Buffer.alloc(0):git(c.git.directory,'show',`${c.git[side]}:${c.path}`));
   const r=spawnSync('git',['merge-file','--diff3','--diff-algorithm=myers','-L','ours','-L','base','-L','theirs','-p',...['ours','base','theirs'].map(s=>join(d,s))],{timeout:30000,maxBuffer:16*1024*1024});
   assert(!r.error&&r.status>0&&r.status<=127);
   c.boundary=boundaryContract(r.stdout,c.git_validation.localized.automaticRanges,{base:c.base,ours:c.ours,theirs:c.theirs});
   const raw=readFileSync(join(c.evaluator.scaffold,c.path));
   const prefix=raw.subarray(0,c.evaluator.start_byte),suffix=raw.subarray(c.evaluator.end_byte);
   for(const [p,s] of [['prefix','suffix'],['automatic_prefix','automatic_suffix']]){
    const a=Buffer.from(c.boundary[p]),b=Buffer.from(c.boundary[s]);
    assert(!a.length||prefix.subarray(-a.length).equals(a),'boundary prefix mismatch');assert(suffix.subarray(0,b.length).equals(b),'boundary suffix mismatch');
   }
  }finally{rmSync(d,{recursive:true,force:true});}
  c.baselines=await baselines(c);
  row.candidates=candidates(c,'candidates-structural').map(candidate=>{
   const baseline=Object.values(c.baselines).find(b=>b.resolution===candidate.text);
   assert(baseline&&!baseline.engine_error&&baseline.evaluation.category!=='environment-error');
   return {id:'cand-'+hash(candidate.text),text:candidate.text,evaluation:baseline.evaluation};
  });
  const screen=JSON.parse(readFileSync(join(c.evaluator.scaffold,'../receipt.json')));
  assert.equal(screen.era.version,'historical-root-and-target-build-era/3','admission requires explicit root/target era schema');
  assert(['module','GOPATH'].includes(screen.era.target_era));
  c.cell=(c.reference===c.ours||c.reference===c.theirs?'side-verbatim':'blend')+'/'+screen.era.target_era;
  checkGroups([...rows.filter(r=>r.status==='admitted').map(r=>r.case),c]);
  row.case=c;row.status='admitted';
 }catch(e){row.status='incomplete-or-ineligible';row.reason=e.message;}
 save('admission.json',rows);
}
