// Run only after the original aggregate completes and the recorded repair is applied.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {load as loadOriginal} from '../v3-development-2026-09-06e/instrument/evidence/h0/v3.mjs';
import {load,sourceHashes} from '../v3.mjs';
import {hash,treeHash} from '../v3-data.mjs';
const root=resolve(import.meta.dirname,'../../..'),read=p=>JSON.parse(readFileSync(p));
const source=resolve(import.meta.dirname,'../v3-development-2026-09-06e');
const destination=resolve(import.meta.dirname,'../v3-development-2026-09-06e-revised');
const plan=read(join(import.meta.dirname,'development-revision-plan.json'));
assert(existsSync(join(source,'aggregate.json')),'Original complete aggregate required');
const original=loadOriginal(source),result=read(join(source,'aggregate.json'));
assert(result.complete&&!result.valid&&result.protocol_sha256===original.digest,'Expected original complete invalid aggregate');
assert.equal(hash(readFileSync(join(source,'aggregate.json'))),plan.timeout_correction.original_aggregate_sha256);
const diagnosticPath=join(import.meta.dirname,'gobuster-timeout-diagnostic/result.json');
assert.equal(hash(readFileSync(diagnosticPath)),plan.timeout_correction.diagnostic_sha256);
const diagnostic=read(diagnosticPath);
const diagnosticFreeze=read(join(import.meta.dirname,'gobuster-timeout-diagnostic/freeze.json'));
const failed=read(join(source,'evaluations',`${diagnosticFreeze.provider}-${diagnosticFreeze.id}-${diagnosticFreeze.arm}.json`));
assert.equal(failed.category,'environment-error');assert.equal(failed.candidate_sha256,read(join(import.meta.dirname,'gobuster-timeout-diagnostic/candidate.json')).candidate_sha256);
assert.equal(failed.stages[0].status,0);assert.match(failed.stages[1].error,/ETIMEDOUT/);
const contextModule=readFileSync(join(root,'.do-not-commit/h0-selector-repair/v3-data-compatible.mjs'),'utf8');
const repairedModule=readFileSync(join(root,plan.repair_module),'utf8');
assert.equal(hash(contextModule),plan.context_module_sha256);
assert.equal(contextModule.split('export function evaluate(')[0],repairedModule.split('export function evaluate(')[0],'Retrieval code must match staged contexts');
assert(diagnostic.complete&&diagnostic.reference_before_pass&&diagnostic.reference_after_pass&&diagnostic.candidate_test_timeout);
const calibrationPath=join(import.meta.dirname,'test-timeout-regression.json');
assert.equal(hash(readFileSync(calibrationPath)),plan.timeout_correction.regression_sha256);assert(read(calibrationPath).pass);
let environmentErrors=0;
for(const arms of Object.values(result.metrics))for(const metric of Object.values(arms)){
  environmentErrors+=metric.environment_error;assert(metric.transport_error/metric.scheduled<=0.05);
}
assert.equal(environmentErrors,1,'Only the diagnosed timeout may invalidate the original run');
for(const c of original.cases)for(const b of Object.values(c.baselines))assert(!b.engine_error&&b.evaluation.category!=='environment-error');
const owner=read(join(import.meta.dirname,'../v3-round15-2026-09-06/development-continuation-e-state.json'));
assert.equal(owner.stage,'finished');let originalLive=true;
try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')originalLive=false;else throw error;}
assert(!originalLive,'Original continuation must be terminal');
assert.equal(original.digest,plan.original_protocol_sha256);
assert.equal(original.protocol.cases_sha256,plan.original_cases_sha256);
assert.equal(original.protocol.mode,'development');assert(original.protocol.eligible);
assert(!original.protocol.budget_correction);assert.equal(original.cases.length,60);
assert(!existsSync(destination),'Refuse existing revised experiment directory');
const sources=sourceHashes(),changed='evidence/h0/v3-data.mjs';
assert.equal(sources[changed],plan.repair_module_sha256,'Apply exactly the tested repair before freezing');
for(const [path,digest] of Object.entries(original.protocol.source_hashes))if(path!==changed)assert.equal(sources[path],digest,'Unplanned instrument change');
const staging=join(import.meta.dirname,plan.context_staging),stagedResult=read(join(staging,'result.json'));
assert(stagedResult.complete&&stagedResult.cases===60);assert.equal(stagedResult.source_protocol_sha256,original.digest);
assert.equal(stagedResult.repair_module_sha256,plan.context_module_sha256);
const audit=read(join(import.meta.dirname,'selector-context-audit.json'));
assert(audit.complete&&audit.local_comparator_unchanged&&audit.all_sources_are_parent_revisions);
assert.equal(audit.repair_module_sha256,plan.context_module_sha256);
const byteAudit=read(join(import.meta.dirname,'selector-parent-byte-audit.json'));
assert(byteAudit.all_selected_text_matches_exact_parent_bytes&&byteAudit.failures.length===0);
assert.equal(byteAudit.repair_module_sha256,plan.context_module_sha256);
assert.deepEqual(read(join(staging,'freeze.json')).case_ids,original.cases.map(c=>c.id));
const cases=original.cases.map(c=>{
  const path=join(staging,`${c.id}.json`),raw=readFileSync(path),s=JSON.parse(raw);
  assert.equal(hash(raw),audit.rows.find(r=>r.id===c.id)?.context_receipt_sha256);
  assert.equal(s.source_protocol_sha256,original.digest);assert.equal(s.repair_module_sha256,plan.context_module_sha256);
  assert.deepEqual(s.contexts['local-context'],c.contexts['local-context']);
  assert.equal(treeHash(c.evaluator.scaffold),c.evaluator.scaffold_sha256);
  assert.equal(treeHash(c.evaluator.oracle),c.evaluator.oracle_sha256);assert(c.oracle_validation.valid);
  return {...c,contexts:s.contexts,retrieval:s.retrieval};
});
const models=structuredClone(original.protocol.models),affected=[];
for(const [name,arms] of Object.entries(result.metrics)){
  const ms=Object.values(arms);assert.equal(ms.reduce((s,m)=>s+m.scheduled,0),180);
  if(ms.reduce((s,m)=>s+m.truncated,0)/180>0.05){models[name].settings[name==='mercury'?'max_tokens':'max_completion_tokens']*=2;affected.push(name);}
}
assert(affected.includes('mercury'),'Previously observed Mercury truncation threshold must remain met');
const aggregateHash=hash(readFileSync(join(source,'aggregate.json')));
assert.deepEqual(sourceHashes(),sources);assert.equal(loadOriginal(source).digest,original.digest);
mkdirSync(destination);
for(const path of Object.keys(sources)){const target=join(destination,'instrument',path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,path),target);}
writeFileSync(join(destination,'cases.json'),JSON.stringify(cases,null,2)+'\n');
copyFileSync(join(source,'exclusions.json'),join(destination,'exclusions.json'));
const protocol={...original.protocol,created_at:new Date().toISOString(),source_hashes:sources,cases_sha256:hash(readFileSync(join(destination,'cases.json'))),models,budget_correction:{source,aggregate_sha256:aggregateHash,affected},method_correction:{source,protocol_sha256:original.digest,plan_sha256:hash(readFileSync(join(import.meta.dirname,'development-revision-plan.json'))),context_audit_sha256:hash(readFileSync(join(import.meta.dirname,'selector-context-audit.json'))),method:plan.retrieval_method,development_case_reuse:true,additional_independent_trials:0}};
writeFileSync(join(destination,'protocol.json'),JSON.stringify(protocol,null,2)+'\n');
const frozen=load(destination);assert.equal(frozen.cases.length,60);
console.log(JSON.stringify({directory:destination,protocol_sha256:frozen.digest,cases:60,affected,solver_requests:0}));
