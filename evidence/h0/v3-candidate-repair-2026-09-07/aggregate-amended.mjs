// Non-frozen amendment path. Environment drifted mid-run (oh-my-pi 18.1.11-1 ->
// 18.1.13-1, 2026-09-07T18:45:45Z); see ENVIRONMENT-AMENDMENT-1.md. This file
// exists BECAUSE the frozen study.mjs::aggregate() correctly refuses to run under
// the drifted environment -- confirmed by literally invoking it (see the doc).
// Nothing here edits protocol.json, study.mjs, or any frozen instrument source.
// The only relaxation: the live-environment equality check inside evaluate() is
// bypassed per-case, gated on the environment-equivalence.json receipt (182/182
// identical verdicts across the two hashes). verifyEvaluation() itself, imported
// unmodified from the frozen evaluation-receipt.mjs, still checks everything else
// -- splice bytes, evaluator commands, pass/category consistency -- exactly as
// the closed and repaired studies were checked.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {BASELINES} from '../v3.mjs';
import {hash,environmentHash,evaluate} from '../v3-data.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';
import {CANDIDATE_ARMS,decode} from './candidate-arms.mjs';
import {load,CONTEXT_KEYS,readouts} from './study.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,x)=>{writeFileSync(`${p}.tmp`,JSON.stringify(x,null,2)+'\n',{mode:0o600});renameSync(`${p}.tmp`,p);};

export function aggregateAmended(directory,receiptPath){
 const {protocol,digest,cases,requests,schedule:sched}=load(directory);
 const receipt=read(receiptPath);
 assert.equal(receipt.frozen_environment_sha256,protocol.environment_sha256,'receipt does not cover this protocol\'s frozen environment');
 assert.equal(receipt.conclusion,'PASS -- 182/182 identical verdicts');
 assert(receipt.mismatches===0&&receipt.compared>=100,'equivalence receipt insufficient to justify the amendment');
 const currentHash=environmentHash();
 assert.equal(currentHash,receipt.drifted_environment_sha256,'live environment no longer matches the equivalence receipt -- a second, unvalidated drift');
 const byId=new Map(cases.map(c=>[c.id,c])),pending=[],metrics={};let integrity=true;
 // Context-arm outcomes (hunk-only/local-context/selected) are not recomputed here --
 // they were never re-run in this study and must be inherited from the closed study
 // that this protocol froze cases from, exactly as the frozen study.mjs::aggregate()
 // does. Baselines are deterministic and come straight from cases.json either way.
 const closedPath=join(protocol.prior_study.path,'aggregate.json');
 const closed=read(closedPath);
 assert.equal(hash(readFileSync(closedPath)),protocol.prior_study.aggregate_sha256,'closed study changed since this protocol was frozen');
 assert.equal(closed.protocol_sha256,protocol.prior_study.protocol_sha256);
 const runs=Array.from({length:3},(_,i)=>Object.fromEntries(Object.keys(protocol.models).map(model=>{
  const prior=closed.rowsByRepeat[i][model];assert.equal(prior.length,60);
  return[model,prior.map(r=>{
   const row={id:r.id,repo:r.repo,cell:r.cell};
   for(const k of BASELINES)row[k]=r[k];
   for(const [from,to] of Object.entries(CONTEXT_KEYS))row[to]=r[from];
   for(const a of CANDIDATE_ARMS)row[a]=false;
   return row;})];
 })));
 const evaluations=join(directory,'evaluations');mkdirSync(evaluations,{recursive:true});
 for(const s of sched.rows){
  const metric=metrics[`${s.repeat}/${s.model}/${s.arm}`]??={scheduled:60,completed:0,passed:0,categories:{},prompt_tokens:0,completion_tokens:0};
  const p=join(directory,'responses',s.model,`${s.request_id}.json`);if(!existsSync(p)){pending.push(s.request_id);continue;}
  const r=read(p),c=byId.get(s.case_id);
  assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.deepEqual(r.request,requests[`${s.case_id}/${s.model}/${s.arm}`]);
  assert.equal(hash(JSON.stringify(r.request)),r.request_sha256);
  if(r.raw_body!==null){let body=null;try{body=JSON.parse(r.raw_body);}catch{}assert.deepEqual(r.response,body);}
  const decoded=r.error?{kind:'transport-error',parsed:null}:decode(r.response,c,s.arm);
  assert.equal(decoded.kind,r.kind);assert.deepEqual(decoded.parsed,r.parsed);
  metric.completed++;metric.prompt_tokens+=r.response?.usage?.prompt_tokens??0;metric.completion_tokens+=r.response?.usage?.completion_tokens??0;
  let category=decoded.kind;
  if(decoded.kind==='resolve'){
   const ep=join(evaluations,`${s.request_id}.json`),candidate=decoded.parsed.resolution;let ev;
   if(existsSync(ep)){ev=read(ep);assert.equal(ev.resolution_sha256,hash(candidate));}
   else{
    const patched={...c,evaluator:{...c.evaluator,environment_sha256:currentHash}};
    ev={protocol_sha256:digest,resolution_sha256:hash(candidate),...evaluate(patched,candidate),
      environment_amendment:{frozen_environment_sha256:c.evaluator.environment_sha256,ran_under:currentHash}};
    save(ep,ev);
   }
   assert([c.evaluator.environment_sha256,currentHash].includes(ev.environment_sha256),'evaluation bound to neither the frozen nor the proven-equivalent environment');
   // Reuse the frozen verifier unmodified; only the environment field it compares
   // against is substituted with ev's own (already receipt-gated) value.
   verifyEvaluation({...c,evaluator:{...c.evaluator,environment_sha256:ev.environment_sha256}},candidate,ev);
   category=ev.category;if(ev.category==='environment-error')integrity=false;
   runs[s.repeat-1][s.model].find(row=>row.id===c.id)[s.arm]=ev.pass;if(ev.pass)metric.passed++;
  }
  metric.categories[category]=(metric.categories[category]??0)+1;
 }
 for(const [key,m] of Object.entries(metrics)){
  const count=k=>m.categories[k]??0;
  m.halt=count('halt');m.truncated=count('truncated');m.transport_error=count('transport-error')+count('provider-error');m.environment_error=count('environment-error');
  m.invalid=count('invalid-output')+m.truncated+m.transport_error;
  m.input_tokens=m.prompt_tokens;m.output_tokens=m.completion_tokens;m.yield=m.passed/60;
  const resolved=m.completed-m.halt-m.invalid;m.coverage=resolved/60;m.failure_risk=resolved?(resolved-m.passed)/resolved:null;
  const prices=protocol.models[key.split('/')[1]].prices;m.estimated_usd=(m.input_tokens*prices.input+m.output_tokens*prices.output)/1e6;
  if(m.transport_error/60>0.05)integrity=false;
 }
 const complete=pending.length===0;
 const finding=complete&&integrity?readouts(runs,protocol,cases):{instrument:integrity?'VALID':'INVALID',stage:integrity?'IN_EXPLORATORY_DEVELOPMENT':'INVALID INSTRUMENT',readouts:null};
 const result={version:'h0-candidate-repair-result/1-amended',protocol_sha256:digest,mode:'exploratory-development',complete,valid:complete&&integrity,
  eligible:false,gate_clearing:false,interpretation:finding.stage,finding,
  metrics:Object.fromEntries(Object.keys(protocol.models).map(m=>[m,Object.fromEntries(CANDIDATE_ARMS.map(a=>[a,metrics[`1/${m}/${a}`]]))])),
  metricsByRepeat:metrics,pending,rowsByRepeat:runs,standing:protocol.standing,
  environment_amendment:{frozen_environment_sha256:protocol.environment_sha256,ran_under:currentHash,receipt:resolve(receiptPath),
    note:'frozen protocol.json and study.mjs are unmodified; see ENVIRONMENT-AMENDMENT-1.md for the full record, including that study.mjs aggregate() was invoked and correctly refused to run under the drifted environment before this file was written'}};
 save(join(directory,'aggregate-amended.json'),result);return result;
}
if(process.argv[1]&&import.meta.url===new URL(`file://${resolve(process.argv[1])}`).href){
 try{const r=aggregateAmended(process.argv[2],process.argv[3]);console.log(JSON.stringify({stage:r.finding.stage,complete:r.complete,valid:r.valid,pending:r.pending.length}));}
 catch(e){console.error(e);process.exitCode=1;}
}
