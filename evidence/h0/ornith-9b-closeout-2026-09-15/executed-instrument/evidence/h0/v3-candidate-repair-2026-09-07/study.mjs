// Separately declared exploratory study: candidate verification and repair.
// Reads the closed repaired study as a frozen input. Never recomputes its outcomes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync,renameSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BASELINES,MODELS,ARMS as CONTEXT_ARMS,sourceHashes,checkGroups} from '../v3.mjs';
import {hash,treeHash,environmentHash,evaluate} from '../v3-data.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';
import {effects} from '../v3-method-repair-2026-09-07/weighted-effects.mjs';
import {sampleSD} from '../v3-method-repair-2026-09-07/repeated-outcomes.mjs';
import {CANDIDATE_ARMS,candidates,citableIds,request,decode,toolSubset} from './candidate-arms.mjs';

export const VERSION='h0-candidate-repair-exploratory/1';
const here=import.meta.dirname;
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,x)=>{writeFileSync(`${p}.tmp`,JSON.stringify(x,null,2)+'\n',{mode:0o600});renameSync(`${p}.tmp`,p);};
// The closed study's own selected arm keeps a distinct key: the frozen estimator
// reads `selected` as the treatment, and the two must never collide.
export const CONTEXT_KEYS={'hunk-only':'hunk-only','local-context':'local-context',selected:'context-selected'};
export const ARM_FLOOR=0.05,BASELINE_FLOOR=0;
const armLike=new Set([...Object.values(CONTEXT_KEYS),...CANDIDATE_ARMS]);
export const floorFor=k=>armLike.has(k)?ARM_FLOOR:BASELINE_FLOOR;

export function schedule(cases,protocolHash,requestHashes){
 assert(/^[a-f0-9]{64}$/.test(protocolHash),'requires frozen protocol digest');assert.equal(cases.length,60);checkGroups(cases);
 const cells=Object.keys(MODELS).flatMap(model=>CANDIDATE_ARMS.map(arm=>({model,arm}))),rows=[];
 assert.equal(Object.keys(requestHashes).length,cases.length*cells.length,'one frozen request per case/model/arm');
 for(let repeat=1;repeat<=3;repeat++){
  const ordered=[...cases].sort((a,b)=>hash(`${protocolHash}:${repeat}:${a.id}`).localeCompare(hash(`${protocolHash}:${repeat}:${b.id}`)));
  for(const [i,c] of ordered.entries())for(let j=0;j<cells.length;j++){
   const {model,arm}=cells[(i+repeat-1+j)%cells.length],key=`${c.id}/${model}/${arm}`,request_sha256=requestHashes[key];
   assert(/^[a-f0-9]{64}$/.test(request_sha256),'missing request body digest');
   rows.push({request_id:hash(`${protocolHash}:${repeat}:${key}`),case_id:c.id,cluster_id:c.cluster_id,model,arm,repeat,request_sha256});
  }
 }
 return{version:'h0-candidate-repair-schedule/1',protocol_sha256:protocolHash,independent_cases:cases.length,independent_clusters:new Set(cases.map(c=>c.cluster_id)).size,scheduled_requests:rows.length,primary_repeat:1,repetitions:3,rows};
}

export function freezeStudy(source,directory){
 assert(!existsSync(directory),'new study directory required');
 const prior=read(join(source,'protocol.json')),raw=readFileSync(join(source,'cases.json')),cases=JSON.parse(raw);
 assert.equal(prior.version,'h0-repaired-development/1');assert.equal(hash(raw),prior.cases_sha256);assert.equal(cases.length,60);checkGroups(cases);
 const closed=read(join(source,'aggregate.json'));
 assert.equal(closed.complete,true);assert.equal(closed.valid,true);
 assert.equal(closed.protocol_sha256,hash(readFileSync(join(source,'protocol.json'))),'closed aggregate does not bind its protocol');
 // Inherited evaluation sources must not have drifted, or the outcomes are not comparable.
 for(const [p,sha] of Object.entries(prior.source_hashes))assert.equal(hash(readFileSync(resolve(p))),sha,`inherited source drift: ${p}`);
 const environment=environmentHash();assert.equal(environment,prior.environment_sha256,'toolchain drift since the closed study');
 for(const c of cases){
  assert.equal(c.language,'Go');
  assert.equal(treeHash(c.evaluator.scaffold),c.evaluator.scaffold_sha256);
  assert.equal(treeHash(c.evaluator.oracle),c.evaluator.oracle_sha256);
  for(const arm of CANDIDATE_ARMS)assert(candidates(c,arm).length>=1);
 }
 mkdirSync(directory,{recursive:true});copyFileSync(join(source,'cases.json'),join(directory,'cases.json'));
 const requests=Object.fromEntries(cases.flatMap(c=>Object.entries(prior.models).flatMap(([m,p])=>CANDIDATE_ARMS.map(a=>[`${c.id}/${m}/${a}`,request(c,a,p)]))));
 save(join(directory,'requests.json'),requests);
 const local=['study.mjs','candidate-arms.mjs','PROTOCOL.md'].map(n=>resolve(here,n));
 const inherited=['../v3-method-repair-2026-09-07/weighted-effects.mjs','../v3-method-repair-2026-09-07/repeated-outcomes.mjs','../v3-method-repair-2026-09-07/evaluation-receipt.mjs','../v3-contrast-review-2026-09-07/boundary-contract.mjs'].map(n=>resolve(here,n));
 const sources={...sourceHashes(),...Object.fromEntries([...local,...inherited].map(p=>[p,hash(readFileSync(p))]))};
 for(const [p,sha] of Object.entries(sources)){
  const path=relative(resolve(here,'../../..'),resolve(p));assert(!path.startsWith('../'));
  const destination=join(directory,'instrument',path);mkdirSync(dirname(destination),{recursive:true});
  copyFileSync(resolve(p),destination);assert.equal(hash(readFileSync(destination)),sha);
 }
 const subset=toolSubset(cases);
 const protocol={version:VERSION,mode:'exploratory-development',at:new Date().toISOString(),models:prior.models,timeout_ms:prior.timeout_ms,
  arms:CANDIDATE_ARMS,context_arm_keys:CONTEXT_KEYS,source_hashes:sources,cases_sha256:hash(raw),
  requests_sha256:hash(readFileSync(join(directory,'requests.json'))),environment_sha256:environment,
  protocol_document_sha256:hash(readFileSync(resolve(here,'PROTOCOL.md'))),
  prior_study:{path:resolve(source),protocol_sha256:closed.protocol_sha256,aggregate_sha256:hash(readFileSync(join(source,'aggregate.json'))),interpretation:closed.interpretation},
  tool_subset:{contributing:subset.differs.length,identical_prompt:subset.identical.length,mergiraf_resolves:subset.mergiraf_resolves,ids:subset.differs},
  weights:prior.weights,scope:prior.scope,
  standing:'separately declared exploratory study on an already-observed cohort; cannot clear a gate; does not rescore, reweight or re-run the closed study',
  stop:'three scheduled runs; no answer retries; stop provider permanently on first 429; no confirmation; no acquisition in response to failure'};
 save(join(directory,'protocol.json'),protocol);
 const digest=hash(readFileSync(join(directory,'protocol.json')));
 save(join(directory,'schedule.json'),schedule(cases,digest,Object.fromEntries(Object.entries(requests).map(([k,v])=>[k,hash(JSON.stringify(v))]))));
 load(directory);return{directory,scheduled_requests:720,protocol_sha256:digest};
}

export function load(directory){
 const bytes=readFileSync(join(directory,'protocol.json')),protocol=JSON.parse(bytes),digest=hash(bytes);
 assert.equal(protocol.version,VERSION);assert.equal(protocol.mode,'exploratory-development');
 const cases=read(join(directory,'cases.json')),requests=read(join(directory,'requests.json')),sched=read(join(directory,'schedule.json'));
 assert.equal(hash(readFileSync(join(directory,'cases.json'))),protocol.cases_sha256);
 assert.equal(hash(readFileSync(join(directory,'requests.json'))),protocol.requests_sha256);
 assert(Object.keys(protocol.source_hashes).length>0,'missing frozen source hashes');
 for(const [p,sha] of Object.entries(protocol.source_hashes))assert.equal(hash(readFileSync(resolve(p))),sha,`source drift: ${p}`);
 assert.deepEqual(sched,schedule(cases,digest,Object.fromEntries(Object.entries(requests).map(([k,v])=>[k,hash(JSON.stringify(v))]))),'schedule differs from frozen order');
 assert.deepEqual(Object.keys(protocol.models).sort(),Object.keys(MODELS).sort());
 for(const [name,p] of Object.entries(protocol.models)){
  assert.equal(p.model,MODELS[name].model);assert.equal(p.endpoint,MODELS[name].endpoint);assert.equal(p.helper,MODELS[name].helper);assert.equal(p.env,MODELS[name].env);
  for(const row of sched.rows.filter(r=>r.model===name)){const req=requests[`${row.case_id}/${name}/${row.arm}`];assert.equal(req.model,p.model);for(const [k,v] of Object.entries(p.settings))assert.deepEqual(req[k],v,'request settings differ from frozen provider');}
 }
 return{protocol,digest,cases,requests,schedule:sched};
}

export async function dispatch(directory,name,{fetcher=fetch,key}={}){
 const {protocol,digest,cases,requests,schedule:sched}=load(directory);assert(Object.hasOwn(MODELS,name));
 const provider=protocol.models[name],out=join(directory,'responses',name);mkdirSync(out,{recursive:true});
 const lock=join(out,'.dispatcher-lock');writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});
 try{
  const stop=join(out,'rate-limit-stop.json');if(existsSync(stop))return{model:name,stopped:'429',pending:true};
  if(!key){try{key=process.env[provider.env]??execFileSync(provider.helper,[],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{throw new Error(`${name}: credential helper failed`);}}
  assert(key,'credential unavailable');
  const byId=new Map(cases.map(c=>[c.id,c]));
  for(const row of sched.rows.filter(r=>r.model===name)){
   const req=requests[`${row.case_id}/${name}/${row.arm}`],p=join(out,`${row.request_id}.json`),attempt=`${p}.started`;
   if(existsSync(p)){const r=read(p);assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,row);assert.deepEqual(r.request,req);if(r.http_status===429){save(stop,{request_id:row.request_id,protocol_sha256:digest});return{model:name,stopped:'429',pending:true};}continue;}
   const at=new Date().toISOString(),start=Date.now();let response=null,raw_body=null,http_status=null,error=null;
   if(existsSync(attempt)){const p0=read(attempt);assert.equal(p0.protocol_sha256,digest);assert.equal(p0.request_sha256,row.request_sha256);error='interrupted-attempt-unknown-response';}
   else{
    writeFileSync(attempt,JSON.stringify({protocol_sha256:digest,request_sha256:row.request_sha256,at}),{flag:'wx',mode:0o600});
    try{const r=await fetcher(provider.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(req),signal:AbortSignal.timeout(protocol.timeout_ms)});http_status=r.status;raw_body=await r.text();try{response=JSON.parse(raw_body);}catch{error='non-json-response';}}
    catch(e){error=e.name==='TimeoutError'?'timeout':'transport-error';}
    if(http_status!==200)error??=`http-${http_status}`;
   }
   const decoded=error?{kind:'transport-error',parsed:null}:decode(response,byId.get(row.case_id),row.arm);
   save(p,{protocol_sha256:digest,scheduled:row,request:req,request_sha256:row.request_sha256,started_at:existsSync(attempt)?read(attempt).at:at,finished_at:new Date().toISOString(),duration_ms:Date.now()-start,http_status,raw_body,response,error,...decoded});
   rmSync(attempt);
   if(http_status===429){save(stop,{request_id:row.request_id,protocol_sha256:digest});return{model:name,stopped:'429',pending:true};}
   process.stdout.write(`${name} r${row.repeat} ${row.case_id.slice(0,8)} ${row.arm} ${decoded.kind}\n`);
  }
  return{model:name,stopped:'matrix-complete'};
 }finally{rmSync(lock);}
}

// Reuses the frozen estimator by mapping the treatment onto the key it reads.
export function effectsFor(rows,treatment,comparators){
 assert(!comparators.includes(treatment),'treatment cannot compare against itself');
 assert(rows.every(r=>typeof r[treatment]==='boolean'),'missing treatment outcome');
 return effects(rows.map(r=>({...r,selected:r[treatment]})),comparators);
}
export function bindingFor(measured,comparators,{estimators=['unweighted','standardized']}={}){
 const out=[];
 for(const estimator of estimators){
  if(!measured[estimator])continue;
  for(const k of comparators){const delta=measured[estimator][k].delta,floor=floorFor(k);if(delta<=floor+1e-12)out.push({estimator,comparator:k,delta,floor});}
 }
 return out;
}

export function aggregate(directory){
 const {protocol,digest,cases,requests,schedule:sched}=load(directory);
 const source=protocol.prior_study.path,closed=read(join(source,'aggregate.json'));
 assert.equal(hash(readFileSync(join(source,'aggregate.json'))),protocol.prior_study.aggregate_sha256,'closed study changed since freeze');
 assert.equal(closed.protocol_sha256,protocol.prior_study.protocol_sha256);
 const byId=new Map(cases.map(c=>[c.id,c])),pending=[],metrics={};let integrity=true;
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
   if(existsSync(ep)){ev=read(ep);assert.equal(ev.protocol_sha256,digest);assert.equal(ev.resolution_sha256,hash(candidate));}
   else{ev={protocol_sha256:digest,resolution_sha256:hash(candidate),...evaluate(c,candidate)};save(ep,ev);}
   verifyEvaluation(c,candidate,ev);category=ev.category;if(ev.category==='environment-error')integrity=false;
   runs[s.repeat-1][s.model].find(row=>row.id===c.id)[s.arm]=ev.pass;if(ev.pass)metric.passed++;
   metric.verbatim_candidate=(metric.verbatim_candidate??0)+(candidates(c,s.arm).some(x=>x.text===candidate)?1:0);
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
 assert.equal(environmentHash(),protocol.environment_sha256,'environment drift during aggregation');
 const result={version:'h0-candidate-repair-result/1',protocol_sha256:digest,mode:'exploratory-development',complete,valid:complete&&integrity,
  eligible:false,gate_clearing:false,interpretation:finding.stage,finding,
  metrics:Object.fromEntries(Object.keys(protocol.models).map(m=>[m,Object.fromEntries(CANDIDATE_ARMS.map(a=>[a,metrics[`1/${m}/${a}`]]))])),
  metricsByRepeat:metrics,pending,rowsByRepeat:runs,
  standing:protocol.standing};
 save(join(directory,'aggregate.json'),result);return result;
}

export function readouts(runs,protocol,cases){
 const models=Object.keys(protocol.models),contextComparators=[...Object.values(CONTEXT_KEYS),...BASELINES];
 const subset=new Set(protocol.tool_subset.ids),identical=cases.filter(c=>!subset.has(c.id)).map(c=>c.id);
 const R=k=>({});const out={R1:{},R2:{},R3:{},R4:{},R5:{}},binding=[];
 for(const [i,run] of runs.entries())for(const model of models){
  const rows=run[model];
  for(const [key,treatment,comparators] of [['R1','candidates-tool-free',contextComparators],['R3','candidates-structural',[...contextComparators,'candidates-tool-free']]]){
   const measured=effectsFor(rows,treatment,comparators);
   const bound=bindingFor(measured,comparators,{estimators:measured.standardized?['unweighted','standardized']:['unweighted']});
   (out[key][model]??=[])[i]={effects:measured,binding:bound};
   for(const b of bound)binding.push({readout:key,repeat:i+1,model,...b});
  }
  // R2: the tool contrast lives only where the structural merge contributes a candidate.
  // Too few lineages per cell there for the standardized estimator; unweighted only.
  const contributing=rows.filter(r=>subset.has(r.id)),same=rows.filter(r=>!subset.has(r.id));
  const measured=effectsFor(contributing,'candidates-structural',['candidates-tool-free']);
  (out.R2[model]??=[])[i]={n:contributing.length,lineages:new Set(contributing.map(r=>r.repo)).size,
   estimator:'unweighted-only',reason:'at most two lineages support three of four cells on this subset',
   unweighted:measured.unweighted['candidates-tool-free'],
   noise_floor:{n:same.length,note:'byte-identical prompts across arms; any difference is same-prompt sampling variation',
    discordant:same.filter(r=>r['candidates-structural']!==r['candidates-tool-free']).length,
    structural_only:same.filter(r=>r['candidates-structural']&&!r['candidates-tool-free']).length,
    tool_free_only:same.filter(r=>!r['candidates-structural']&&r['candidates-tool-free']).length}};
 }
 for(const model of models){
  const maps=runs.map(run=>new Map(run[model].map(r=>[r.id,r]))),arms={};
  for(const arm of [...CANDIDATE_ARMS,...Object.values(CONTEXT_KEYS)]){
   const counts=runs[0][model].map(r=>({id:r.id,successes:maps.reduce((s,m)=>s+Number(m.get(r.id)[arm]),0)}));
   const yields=runs.map(run=>run[model].reduce((s,r)=>s+Number(r[arm]),0)/60);
   arms[arm]={yields,counts:yields.map(y=>y*60),sample_sd:sampleSD(yields),discordant_cases:counts.filter(r=>r.successes>0&&r.successes<3).length,
    pairwise_discordance:[[0,1],[0,2],[1,2]].map(([a,b])=>({runs:[a+1,b+1],cases:runs[0][model].filter(r=>maps[a].get(r.id)[arm]!==maps[b].get(r.id)[arm]).length}))};
  }
  out.R4[model]={arms};
 }
 const stage=binding.some(b=>b.readout==='R3'&&b.repeat===1)?'NO DEMONSTRATED BENEFIT (EXPLORATORY)'
   :binding.some(b=>b.readout==='R3')?'UNSTABLE EXPLORATORY BENEFIT'
   :'EXPLORATORY BENEFIT — CONFIRMATION DESIGN PERMITTED';
 return{instrument:'VALID',stage,gate_clearing:false,binding,readouts:out,identical_prompt_cases:identical.length,
  independent_cases:60,independent_clusters:new Set(runs[0][models[0]].map(r=>r.repo)).size,repetitions:3,
  interpretation_note:'development evidence on an already-observed cohort; a non-binding result permits proposing a fresh confirmation cohort and nothing stronger',
  protocol:'evidence/h0/v3-candidate-repair-2026-09-07/PROTOCOL.md'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [command,...args]=process.argv.slice(2);
 try{
  if(command==='dispatch'){const r=await dispatch(args[0],args[1]);console.log(JSON.stringify(r));}
  else{const f={freeze:freezeStudy,aggregate:aggregate,load:load}[command];assert(f,'freeze|dispatch|aggregate|load');
   const r=f(...args);console.log(JSON.stringify(command==='aggregate'?{stage:r.finding.stage,complete:r.complete,pending:r.pending.length}:command==='load'?{ok:true,protocol:r.protocol.version,rows:r.schedule.rows.length}:r));}
 }catch(e){console.error(e);process.exitCode=1;}
}
