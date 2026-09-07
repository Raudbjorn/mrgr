import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {join,resolve,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ARMS,BASELINES,checkGroups,decode,sourceHashes} from '../v3.mjs';
import {hash,treeHash,environmentHash,verifyGitCase,evaluate} from '../v3-data.mjs';
import {eraStratum} from '../v3-screen-go.mjs';
import {sparseContext} from '../v3-contrast-review-2026-09-07/sparse-context.mjs';
import {request} from '../v3-contrast-review-2026-09-07/boundary-contract.mjs';
import {repeatSchedule} from './repeat-schedule.mjs';
import {loadRepeated} from './repeat-dispatch.mjs';
import {repeatedOutcomes} from './repeated-outcomes.mjs';
import {verifyEvaluation} from './evaluation-receipt.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const method=import.meta.dirname,contrast=resolve(method,'../v3-contrast-review-2026-09-07');
const inputSources=()=>Object.fromEntries(['../v3-data.mjs','../v3-screen-go.mjs','evaluation-receipt.mjs',...['boundary-contract.mjs','sparse-context.mjs','parent-ranges.mjs'].map(p=>`../v3-contrast-review-2026-09-07/${p}`)].map(p=>[resolve(method,p),hash(readFileSync(resolve(method,p)))]));
export function prepareInputs(source,directory){
 assert(!existsSync(directory),'new preparation directory required');mkdirSync(directory,{recursive:true});
 const protocol=read(join(source,'protocol.json')),raw=readFileSync(join(source,'cases.json')),cases=JSON.parse(raw);
 assert.equal(hash(raw),protocol.cases_sha256);assert.equal(cases.length,60);checkGroups(cases);
 // Generator/estimator revisions do not invalidate immutable oracle receipts.
 // Every other inherited source, including the evaluator and engines, must match.
 for(const [p,sha] of Object.entries(protocol.source_hashes))if(!['evidence/h0/v3.mjs','evidence/h0/v3-inference.mjs'].includes(p))assert.equal(hash(readFileSync(resolve(p))),sha,`inherited evaluation source drift: ${p}`);
 const audit=read(join(contrast,'boundary-audit.json'));assert.equal(audit.source_cases_sha256,hash(raw));assert.equal(audit.matches,60);
 for(const [p,sha] of Object.entries(audit.source_hashes))assert.equal(hash(readFileSync(join(contrast,p))),sha);
 const byId=new Map(audit.rows.map(r=>[r.id,r])),environment=environmentHash(),prepared=[];
 for(const c of cases){
  assert.equal(c.language,'Go');assert.equal(c.evaluator.environment_sha256,environment);
  assert.equal(treeHash(c.evaluator.scaffold),c.evaluator.scaffold_sha256);assert.equal(treeHash(c.evaluator.oracle),c.evaluator.oracle_sha256);
  verifyGitCase(c);
  assert.equal(c.oracle_validation.reference.length,3);assert.equal(c.oracle_validation.mutations.length,c.mutations.length);assert(c.mutations.length>=2);
  for(const ev of c.oracle_validation.reference){verifyEvaluation(c,c.reference,ev);assert(ev.pass);}
  c.mutations.forEach((m,i)=>{const ev=c.oracle_validation.mutations[i];assert.equal(ev.name,m.name);verifyEvaluation(c,m.resolution,ev);assert.equal(ev.category,'test-failure');});
  for(const k of BASELINES){const b=c.baselines[k];assert(b&&!b.engine_error);if(b.resolution===null)assert.equal(b.evaluation.pass,false);else{verifyEvaluation(c,b.resolution,b.evaluation);assert.notEqual(b.evaluation.category,'environment-error');}}
  const era=eraStratum(c.git.directory,c.event,c.path),cell=`${c.reference===c.ours||c.reference===c.theirs?'side-verbatim':'blend'}/${era.era}`;
  const derived=sparseContext({language:c.language,path:c.path,base:c.base,ours:c.ours,theirs:c.theirs,git:c.git},'.do-not-commit/h0-v3-tools/go.so');
  const boundary=byId.get(c.id);assert(boundary?.eligible_for_this_boundary_contract);
  prepared.push({...c,...derived,era,cell,boundary:boundary.boundary,broader_automatic_context_matches_scaffold:boundary.broader_automatic_context_matches_scaffold});
  save(join(directory,'progress.json'),{prepared:prepared.length,cases:60,api_requests:0});
 }
 save(join(directory,'cases.json'),prepared);
 save(join(directory,'preparation.json'),{at:new Date().toISOString(),source:resolve(source),source_protocol_sha256:hash(readFileSync(join(source,'protocol.json'))),source_cases_sha256:hash(raw),cases_sha256:hash(readFileSync(join(directory,'cases.json'))),input_source_hashes:inputSources(),models:protocol.models,oracle_admission:'3 preserved reference passes and >=2 compiling rejected mutations per case, raw receipts and unchanged evaluator/scaffold/toolchain verified',boundary_audit_sha256:hash(readFileSync(join(contrast,'boundary-audit.json'))),models_requests:0,environment_sha256:environment});
 return{directory,cases:prepared.length,api_requests:0};
}
export function freezeStudy(preparation,directory,recoveryReceipt){
 assert(!existsSync(directory));const meta=read(join(preparation,'preparation.json')),raw=readFileSync(join(preparation,'cases.json'));assert.equal(hash(raw),meta.cases_sha256);
 assert.deepEqual(inputSources(),meta.input_source_hashes,'preparation implementation changed');
 const calibration=read(join(method,'weighted-effects-calibration.json'));
 for(const [p,sha] of Object.entries(calibration.source_hashes))assert.equal(hash(readFileSync(resolve(method,p))),sha,'weighted calibration source drift');
 assert(Object.values(calibration.calibration).every(s=>s.draws>=2000&&s.coverage>=0.95),'weighted calibration incomplete');
 const recovery=read(recoveryReceipt);assert.equal(recovery.complete,true,'recovery must finish before development freeze');
 assert.equal(environmentHash(),meta.environment_sha256);const cases=JSON.parse(raw);
 for(const c of cases){assert.equal(treeHash(c.evaluator.scaffold),c.evaluator.scaffold_sha256);assert.equal(treeHash(c.evaluator.oracle),c.evaluator.oracle_sha256);}
 mkdirSync(directory,{recursive:true});copyFileSync(join(preparation,'cases.json'),join(directory,'cases.json'));
 const requests=Object.fromEntries(cases.flatMap(c=>Object.entries(meta.models).flatMap(([m,p])=>ARMS.map(a=>[`${c.id}/${m}/${a}`,request(c,a,p)]))));save(join(directory,'requests.json'),requests);
 const additional=['repaired-study.mjs','repeat-dispatch.mjs','repeat-schedule.mjs','repeated-outcomes.mjs','weighted-effects.mjs','readiness.mjs','evaluation-receipt.mjs','../v3-screen-go.mjs',...['boundary-contract.mjs','sparse-context.mjs','parent-ranges.mjs'].map(n=>`../v3-contrast-review-2026-09-07/${n}`)];
 const sources={...sourceHashes(),...Object.fromEntries(additional.map(p=>[resolve(method,p),hash(readFileSync(resolve(method,p)))])),[resolve('.do-not-commit/h0-v3-tools/go.so')]:hash(readFileSync('.do-not-commit/h0-v3-tools/go.so'))};
 for(const [p,sha] of Object.entries(sources)){const path=relative(resolve(method,'../../..'),resolve(p));assert(!path.startsWith('../'));const destination=join(directory,'instrument',path);mkdirSync(dirname(destination),{recursive:true});copyFileSync(resolve(p),destination);assert.equal(hash(readFileSync(destination)),sha);}
 const protocol={version:'h0-repaired-development/1',mode:'development',at:new Date().toISOString(),models:meta.models,timeout_ms:180000,source_hashes:sources,cases_sha256:hash(raw),requests_sha256:hash(readFileSync(join(directory,'requests.json'))),environment_sha256:meta.environment_sha256,recovery_receipt:{path:resolve(recoveryReceipt),sha256:hash(readFileSync(recoveryReceipt))},preparation:meta,checks:{complete:true,integrity:true,instrument_valid:true,composition_frozen:true,weighted_calibrated:true},scope:'Go focal conflict in a fixed historical scaffold, immediate adjacent lines exposed equally; broader parent context need not match nonfocal historical integration',weights:{'side-verbatim/module':0.25,'side-verbatim/GOPATH':0.25,'blend/module':0.25,'blend/GOPATH':0.25},stop:'three scheduled runs; no answer retries; stop provider permanently on first429; no confirmation; no acquisition in response to development failure'};
 save(join(directory,'protocol.json'),protocol);const digest=hash(readFileSync(join(directory,'protocol.json')));
 save(join(directory,'schedule.json'),repeatSchedule(cases,digest,Object.fromEntries(Object.entries(requests).map(([k,v])=>[k,hash(JSON.stringify(v))]))));loadRepeated(directory);return{directory,scheduled_requests:1080,protocol_sha256:digest};
}
export function aggregateRepeated(directory){
 const {protocol,digest,cases,requests,schedule}=loadRepeated(directory),byId=new Map(cases.map(c=>[c.id,c])),pending=[],metrics={};let integrity=true;
 const runs=Array.from({length:3},()=>Object.fromEntries(Object.keys(protocol.models).map(m=>[m,cases.map(c=>({id:c.id,repo:c.cluster_id,cell:c.cell,...Object.fromEntries(BASELINES.map(k=>[k,c.baselines[k].evaluation.pass])),...Object.fromEntries(ARMS.map(a=>[a,false]))}))])));
 const evaluations=join(directory,'evaluations');mkdirSync(evaluations,{recursive:true});
 for(const s of schedule.rows){
  const metric=metrics[`${s.repeat}/${s.model}/${s.arm}`]??={scheduled:60,completed:0,passed:0,categories:{},prompt_tokens:0,completion_tokens:0};
  const p=join(directory,'responses',s.model,`${s.request_id}.json`);if(!existsSync(p)){pending.push(s.request_id);continue;}
  const r=read(p),c=byId.get(s.case_id);assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.deepEqual(r.request,requests[`${s.case_id}/${s.model}/${s.arm}`]);assert.equal(hash(JSON.stringify(r.request)),r.request_sha256);
  if(r.raw_body!==null){let body=null;try{body=JSON.parse(r.raw_body);}catch{}assert.deepEqual(r.response,body);}
  const decoded=r.error?{kind:'transport-error',parsed:null}:decode(r.response,c,s.arm);assert.equal(decoded.kind,r.kind);assert.deepEqual(decoded.parsed,r.parsed);
  metric.completed++;metric.prompt_tokens+=r.response?.usage?.prompt_tokens??0;metric.completion_tokens+=r.response?.usage?.completion_tokens??0;
  let category=decoded.kind;
  if(decoded.kind==='resolve'){
   const ep=join(evaluations,`${s.request_id}.json`),candidate=decoded.parsed.resolution;let ev;
   if(existsSync(ep)){ev=read(ep);assert.equal(ev.protocol_sha256,digest);assert.equal(ev.resolution_sha256,hash(candidate));}
   else{ev={protocol_sha256:digest,resolution_sha256:hash(candidate),...evaluate(c,candidate)};save(ep,ev);}
   verifyEvaluation(c,candidate,ev);category=ev.category;if(ev.category==='environment-error')integrity=false;
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
 let finding=complete&&integrity?repeatedOutcomes(runs,protocol.checks):{instrument:integrity?'VALID':'INVALID',stage:integrity?'IN_DEVELOPMENT':'INVALID INSTRUMENT',effects:null,reliability:null,decision:'docs/planning/final/phase-3-h0-evidence-utility/gate-retirement-2026-09-07.md#what-replaces-it--part-b-the-decision-register'};
 loadRepeated(directory);assert.equal(environmentHash(),protocol.environment_sha256,'environment drift during aggregation');
 const primaryMetrics=Object.fromEntries(Object.keys(protocol.models).map(model=>[model,Object.fromEntries(ARMS.map(arm=>[arm,metrics[`1/${model}/${arm}`]]))]));
 const comparisons=finding.effects?Object.fromEntries(Object.entries(finding.effects[0]).map(([model,e])=>[model,e.unweighted])):{};
 const result={version:'h0-behavioral-result/4',protocol_sha256:digest,mode:'development',complete,valid:complete&&integrity,eligible:false,interpretation:finding.stage,finding,comparisons,metrics:primaryMetrics,metricsByRepeat:metrics,pending,rowsByModel:runs[0],rowsByRepeat:runs};save(join(directory,'aggregate.json'),result);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [command,...args]=process.argv.slice(2);try{const f={prepare:prepareInputs,freeze:freezeStudy,aggregate:aggregateRepeated}[command];assert(f,'prepare|freeze|aggregate');const result=f(...args);console.log(JSON.stringify(command==='aggregate'?{stage:result.finding.stage,complete:result.complete,pending:result.pending.length}:result));}catch(e){console.error(e);process.exitCode=1;}}
