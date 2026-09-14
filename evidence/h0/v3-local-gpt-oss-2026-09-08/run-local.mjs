import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {read,save,schedule,load as loadPrevious} from '../v3-mercury-final-2026-09-07/attempt.mjs';
import {hash,environmentHash,treeHash,evaluate} from '../v3-data.mjs';
import {decode as hunkDecode} from '../v3.mjs';
import {decode as candidateDecode} from '../v3-candidate-repair-2026-09-07/candidate-arms.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';
import {effects} from '../v3-method-repair-2026-09-07/weighted-effects.mjs';
import {clusterJackknife,clusterCritical} from '../v3-inference.mjs';
import {sampleSD} from '../v3-method-repair-2026-09-07/repeated-outcomes.mjs';
const here=import.meta.dirname,prior=resolve(here,'../v3-mercury-final-2026-09-07/run');
const model='gpt-oss-20b-Q4_K_M.gguf',base='http://127.0.0.1:8089';
const arms=['hunk-only','candidates-structural'];
export const serverIdentity=p=>({model:p.model_alias,path:p.model_path,settings:p.default_generation_settings,slots:p.total_slots,template:p.chat_template,build:p.build_info});
export const localRequest=r=>({...r,model});
const decode=(r,c,arm)=>(arm==='hunk-only'?hunkDecode:candidateDecode)(r,c,arm);
export function load(d){
 const p=read(join(d,'protocol.json')),digest=hash(fs.readFileSync(join(d,'protocol.json')));
 assert.equal(p.version,'h0-local-gpt-oss-comparison/1');
 for(const [file,h]of Object.entries(p.preserved))assert.equal(hash(fs.readFileSync(file)),h,`frozen input drift: ${file}`);
 const cases=read(join(d,'cases.json')),requests=read(join(d,'requests.json')),rows=read(join(d,'schedule.json'));
 assert.equal(hash(fs.readFileSync(join(d,'cases.json'))),p.cases_sha256);assert.equal(hash(fs.readFileSync(join(d,'requests.json'))),p.requests_sha256);
 assert.deepEqual(rows,schedule(cases,digest,requests,12));return{p,digest,cases,requests,rows};
}
export async function prepare(d){
 assert(!fs.existsSync(d),'new run directory required');
 const {p:old}=loadPrevious(prior),env=environmentHash();assert.equal(env,old.environment_sha256,'oracle environment changed');
 const ready=read(join(here,'server-ready.json')),props=await(await fetch(base+'/props')).json();assert.deepEqual(serverIdentity(props),serverIdentity(ready.props));
 assert.equal(props.default_generation_settings.n_ctx,131072);assert.equal(props.total_slots,1);
 const weights=execFileSync('sha256sum',[props.model_path],{encoding:'utf8'}).split(' ')[0];assert.equal(weights,ready.weights_sha256);
 const cases=read(join(prior,'cases.json')),archived=read(join(prior,'requests.json')),requests=Object.fromEntries(Object.entries(archived).map(([k,r])=>[k,localRequest(r)]));
 const files=['run-local.mjs','PROTOCOL.md','server-ready.json','server-context.conf','prompt-capacity.json'].map(n=>join(here,n));
 files.push(join(prior,'aggregate.json'),join(prior,'cases.json'),join(prior,'requests.json'),join(prior,'protocol.json'),resolve(here,'../v3-candidate-repair-2026-09-07/run/aggregate-amended.json'));
 const preserved={...old.source_hashes,...old.preserved,...Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(file))]))};
 for(const [file,h]of Object.entries(preserved))assert.equal(hash(fs.readFileSync(file)),h);
 fs.mkdirSync(d);save(join(d,'cases.json'),cases);save(join(d,'requests.json'),requests);
 const p={version:'h0-local-gpt-oss-comparison/1',at:new Date().toISOString(),model,endpoint:base+'/v1/chat/completions',repetitions:12,arms,timeout_ms:900000,concurrency:1,environment_sha256:env,server:serverIdentity(props),weights_sha256:weights,weights:old.weights,preserved,cases_sha256:hash(fs.readFileSync(join(d,'cases.json'))),requests_sha256:hash(fs.readFileSync(join(d,'requests.json'))),confirmation_authorized:false};
 save(join(d,'protocol.json'),p);const digest=hash(fs.readFileSync(join(d,'protocol.json')));save(join(d,'schedule.json'),schedule(cases,digest,requests,12));
 const refs={};let reference=0,mutants=0;
 for(const c of cases){
  assert.equal(treeHash(c.evaluator.scaffold),c.evaluator.scaffold_sha256);assert.equal(treeHash(c.evaluator.oracle),c.evaluator.oracle_sha256);
  const file=join(prior,'preflight',c.id+'.json'),v=read(file);assert(v.valid);assert.equal(v.protocol_sha256,hash(fs.readFileSync(join(prior,'protocol.json'))));assert.equal(v.reference.length,3);assert(v.mutations.length>=2);
  for(const ev of v.reference){verifyEvaluation(c,c.reference,ev);assert(ev.pass);reference++;}
  for(const [i,ev]of v.mutations.entries()){verifyEvaluation(c,c.mutations[i].resolution,ev);assert.equal(ev.category,'test-failure');mutants++;}
  refs[file]=hash(fs.readFileSync(file));
 }
 save(join(d,'preflight.json'),{protocol_sha256:digest,reused:true,reference_passes:reference,compiling_rejected_mutations:mutants,receipts:refs});load(d);
}
export function summarize(runs){
 const n=runs.length,perRun=runs.map(rs=>effects(rs,['hunk-only'])),deltas=perRun.map(x=>x.unweighted['hunk-only'].delta),mean=deltas.reduce((s,x)=>s+x,0)/n,sd=sampleSD(deltas),w=clusterCritical(n)*sd/Math.sqrt(n);
 return{repetitions:n,cases:runs[0].length,lineages:new Set(runs[0].map(r=>r.repo)).size,mean_gain:mean,standardized_mean_gain:perRun.reduce((s,e)=>s+e.standardized['hunk-only'].delta,0)/n,run_sd:sd,run_interval:sd?{lower:mean-w,upper:mean+w}:{lower:-1,upper:1},cluster:clusterJackknife(runs.flat(),['hunk-only'])['hunk-only'],perRun,arms:Object.fromEntries(['hunk-only','selected'].map(arm=>{const counts=runs.map(rs=>rs.filter(r=>r[arm]).length);return[arm,{counts,mean_rate:counts.reduce((s,x)=>s+x,0)/(n*runs[0].length),yield_sd:sampleSD(counts)/runs[0].length}];}))};
}
function evaluation(d,s,r,c,digest){
 if(r.kind!=='resolve')return null;
 const file=join(d,'evaluations',s.request_id+'.json');let ev;
 if(fs.existsSync(file))ev=read(file);else{ev={protocol_sha256:digest,resolution_sha256:hash(r.parsed.resolution),...evaluate(c,r.parsed.resolution)};save(file,ev);}
 assert.equal(ev.protocol_sha256,digest);assert.equal(ev.resolution_sha256,hash(r.parsed.resolution));verifyEvaluation(c,r.parsed.resolution,ev);assert.notEqual(ev.category,'environment-error');return ev;
}
export function aggregate(d){
 const {p,digest,cases,requests,rows}=load(d),byId=new Map(cases.map(c=>[c.id,c])),runs=Array.from({length:12},()=>cases.map(c=>({id:c.id,repo:c.cluster_id,cell:c.cell,selected:false,'hunk-only':false}))),metrics={};
 for(const s of rows){
  const r=read(join(d,'responses',s.request_id+'.json'));assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.deepEqual(r.request,requests[`${s.case_id}/${s.arm}`]);assert.equal(r.request_sha256,hash(JSON.stringify(r.request)));
  assert.equal(r.http_status,200);assert.equal(r.error,null);assert.deepEqual(JSON.parse(r.raw_body),r.response);assert.deepEqual({kind:r.kind,parsed:r.parsed},decode(r.response,byId.get(s.case_id),s.arm));
  const ev=evaluation(d,s,r,byId.get(s.case_id),digest),category=ev?.category??r.kind,m=metrics[`${s.repeat}/${s.arm}`]??={scheduled:60,completed:0,passed:0,categories:{},input_tokens:0,output_tokens:0,elapsed_ms:0};
  m.completed++;m.passed+=Number(ev?.pass??false);m.categories[category]=(m.categories[category]??0)+1;m.input_tokens+=r.response.usage?.prompt_tokens??0;m.output_tokens+=r.response.usage?.completion_tokens??0;m.elapsed_ms+=Date.parse(r.finished_at)-Date.parse(r.started_at);
  runs[s.repeat-1].find(c=>c.id===s.case_id)[s.arm==='hunk-only'?'hunk-only':'selected']=ev?.pass??false;
 }
 const old=read(resolve(here,'../v3-candidate-repair-2026-09-07/run/aggregate-amended.json'));
 const historical=Object.fromEntries(['mercury','minimax'].map(model=>[model+'-earlier-3',old.rowsByRepeat.map(rs=>rs[model].map(r=>({id:r.id,repo:r.repo,cell:r.cell,selected:r['candidates-structural'],'hunk-only':r['hunk-only']})))]));
 const all={'gpt-oss-local-12':runs,'mercury-final-12':read(join(prior,'aggregate.json')).rowsByRepeat,...historical};
 const comparison=Object.fromEntries(Object.entries(all).map(([k,rs])=>[k,summarize(rs)]));
 const perCase=cases.map(c=>({id:c.id,repo:c.repo,path:c.path,cell:c.cell,models:Object.fromEntries(Object.entries(all).map(([k,rs])=>[k,Object.fromEntries(['selected','hunk-only'].map(arm=>[arm,{passes:rs.reduce((s,run)=>s+Number(run.find(r=>r.id===c.id)[arm]),0),repeats:rs.length}]))]))}));
 const result={version:'h0-local-gpt-oss-result/1',protocol_sha256:digest,complete:true,valid:true,gate_clearing:false,metrics,rowsByRepeat:runs,comparison};save(join(d,'aggregate.json'),result);save(join(d,'per-case-comparison.json'),perCase);return result;
}
export async function run(d){
 if(!fs.existsSync(join(d,'protocol.json')))await prepare(d);
 const state=(stage,extra={})=>save(join(d,'state.json'),{pid:process.pid,stage,at:new Date().toISOString(),...extra});
 const lock=join(d,'.lock');fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
 try{
  const {p,digest,cases,requests,rows}=load(d),byId=new Map(cases.map(c=>[c.id,c])),preflight=read(join(d,'preflight.json'));assert.equal(preflight.protocol_sha256,digest);
  for(const [file,h]of Object.entries(preflight.receipts))assert.equal(hash(fs.readFileSync(file)),h);
  for(const [i,s]of rows.entries()){
   state('running',{completed:i,total:1440,repeat:s.repeat,arm:s.arm});
   load(d);assert.equal(environmentHash(),p.environment_sha256);assert.deepEqual(serverIdentity(await(await fetch(base+'/props')).json()),p.server);
   const file=join(d,'responses',s.request_id+'.json'),started=file+'.started';let r;
   if(fs.existsSync(file))r=read(file);else{
    if(fs.existsSync(started)){const x=read(started);assert.equal(x.protocol_sha256,digest);assert.deepEqual(x.scheduled,s);save(file,{protocol_sha256:digest,scheduled:s,request:requests[`${s.case_id}/${s.arm}`],request_sha256:s.request_sha256,started_at:x.at,finished_at:new Date().toISOString(),http_status:null,raw_body:null,response:null,error:'interrupted-attempt-unknown-response',kind:'transport-error',parsed:null});throw Error('interrupted request retained as unknown transport outcome; not resent');}
    const request=requests[`${s.case_id}/${s.arm}`],at=new Date().toISOString();save(started,{protocol_sha256:digest,scheduled:s,at});
    let http_status=null,raw_body=null,response=null,error=null;
    try{const res=await fetch(p.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(p.timeout_ms)});http_status=res.status;raw_body=await res.text();try{response=JSON.parse(raw_body);}catch{error='non-json-response';}if(http_status!==200)error??=`http-${http_status}`;}catch(e){error=e.name==='TimeoutError'?'timeout':'transport-error';}
    r={protocol_sha256:digest,scheduled:s,request,request_sha256:hash(JSON.stringify(request)),started_at:at,finished_at:new Date().toISOString(),http_status,raw_body,response,error,...(error?{kind:'transport-error',parsed:null}:decode(response,byId.get(s.case_id),s.arm))};save(file,r);fs.rmSync(started);
   }
   assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.equal(r.error,null,'server/transport failure: preserve incomplete run');
   evaluation(d,s,r,byId.get(s.case_id),digest);
  }
  const a=aggregate(d);assert.equal(environmentHash(),p.environment_sha256);assert.equal(execFileSync('sha256sum',[p.server.path],{encoding:'utf8'}).split(' ')[0],p.weights_sha256);state('finished',{completed:1440,total:1440,valid:a.valid});
 }catch(e){state('error',{error:e.message,complete:false});throw e;}finally{fs.rmSync(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await run(join(here,'run'));
