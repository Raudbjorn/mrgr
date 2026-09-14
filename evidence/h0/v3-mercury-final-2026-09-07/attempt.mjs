import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash,environmentHash,treeHash,evaluate,validateOracle} from '../v3-data.mjs';
import {sourceHashes,checkGroups,decode as hunkDecode} from '../v3.mjs';
import {decode as candidateDecode} from '../v3-candidate-repair-2026-09-07/candidate-arms.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';
import {effects} from '../v3-method-repair-2026-09-07/weighted-effects.mjs';
import {clusterJackknife,clusterCritical} from '../v3-inference.mjs';
import {sampleSD} from '../v3-method-repair-2026-09-07/repeated-outcomes.mjs';
const here=import.meta.dirname,old=resolve(here,'../v3-repaired-development-2026-09-07'),candidate=resolve(here,'../v3-candidate-repair-2026-09-07/run');
export const arms=['hunk-only','candidates-structural'];
export const read=p=>JSON.parse(fs.readFileSync(p));
export const save=(p,x)=>{fs.mkdirSync(dirname(p),{recursive:true});fs.writeFileSync(p+'.tmp',JSON.stringify(x,null,2)+'\n',{mode:0o600});fs.renameSync(p+'.tmp',p);};
const decode=(r,c,arm)=>arm==='hunk-only'?hunkDecode(r,c,arm):candidateDecode(r,c,arm);
export function schedule(cases,digest,requests,repeats){
 assert.equal(cases.length,60);checkGroups(cases);assert.equal(repeats,12);
 return Array.from({length:repeats},(_,r)=>[...cases].sort((a,b)=>hash(`${digest}:${r}:${a.id}`).localeCompare(hash(`${digest}:${r}:${b.id}`))).flatMap((c,i)=>arms.map((_,j)=>{const arm=arms[(r+i+j)%2],key=`${c.id}/${arm}`;return{repeat:r+1,case_id:c.id,arm,request_sha256:hash(JSON.stringify(requests[key])),request_id:hash(`${digest}:${r+1}:${key}`)};}))).flat();
}
export function prepare(d){
 assert(!fs.existsSync(d),'new attempt directory required');fs.mkdirSync(d,{recursive:true});
 const base=read(join(old,'protocol.json')),sourceCases=read(join(old,'cases.json')),env=environmentHash();assert.equal(hash(fs.readFileSync(join(old,'cases.json'))),base.cases_sha256);checkGroups(sourceCases);
 const inherited={...base.source_hashes,...read(join(candidate,'protocol.json')).source_hashes};for(const [p,h]of Object.entries(inherited))assert.equal(hash(fs.readFileSync(p)),h,`inherited source drift: ${p}`);
 const local=['attempt.mjs','PROTOCOL.md','sizing.json'].map(p=>join(here,p));const sources={...inherited,...sourceHashes(),...Object.fromEntries(local.map(p=>[p,hash(fs.readFileSync(p))]))};
 const priorFiles=[join(old,'aggregate.json'),join(candidate,'aggregate-amended.json'),join(old,'requests.json'),join(candidate,'requests.json'),join(candidate,'protocol.json'),join(old,'protocol.json')];
 const preserved=Object.fromEntries(priorFiles.map(p=>[p,hash(fs.readFileSync(p))]));
 const cases=sourceCases.map(c=>({...c,evaluator:{...c.evaluator,environment_sha256:env}}));
 const a=read(join(old,'requests.json')),b=read(join(candidate,'requests.json')),requests={};
 for(const c of cases)for(const arm of arms){const req=(arm==='hunk-only'?a:b)[`${c.id}/mercury/${arm}`];assert(req);assert.equal(req.model,'mercury-2');assert.equal(req.temperature,.75);assert.equal(req.max_tokens,16384);requests[`${c.id}/${arm}`]=req;}
 save(join(d,'cases.json'),cases);save(join(d,'requests.json'),requests);
 const protocol={version:'h0-mercury-final-variance/1',at:new Date().toISOString(),mode:'exploratory-final-fixed-cohort',repetitions:read(join(here,'sizing.json')).selected_repetitions,arms,model:base.models.mercury,timeout_ms:180000,environment_sha256:env,source_hashes:sources,preserved,cases_sha256:hash(fs.readFileSync(join(d,'cases.json'))),requests_sha256:hash(fs.readFileSync(join(d,'requests.json'))),weights:base.weights,confirmation_authorized:false,last_attempt_on_cohort:true};
 save(join(d,'protocol.json'),protocol);const digest=hash(fs.readFileSync(join(d,'protocol.json')));save(join(d,'schedule.json'),schedule(cases,digest,requests,protocol.repetitions));load(d);
 return protocol;
}
export function load(d){
 const p=read(join(d,'protocol.json')),digest=hash(fs.readFileSync(join(d,'protocol.json')));assert.equal(p.version,'h0-mercury-final-variance/1');
 for(const [file,h]of Object.entries({...p.source_hashes,...p.preserved}))assert.equal(hash(fs.readFileSync(file)),h,`frozen source/input drift: ${file}`);
 for(const n of ['cases','requests'])assert.equal(hash(fs.readFileSync(join(d,n+'.json'))),p[n+'_sha256']);
 const cases=read(join(d,'cases.json')),requests=read(join(d,'requests.json')),rows=read(join(d,'schedule.json'));assert.deepEqual(rows,schedule(cases,digest,requests,p.repetitions));return{p,digest,cases,requests,rows};
}
export function preflight(d){
 const {p,digest,cases}=load(d);assert.equal(environmentHash(),p.environment_sha256);let count=0;
 for(const c of cases){const file=join(d,'preflight',c.id+'.json');let v;
 if(fs.existsSync(file)){v=read(file);assert.equal(v.protocol_sha256,digest);}else{v={protocol_sha256:digest,...validateOracle(c)};save(file,v);}
 assert.equal(v.reference.length,3);assert(v.mutations.length>=2);for(const ev of v.reference){verifyEvaluation(c,c.reference,ev);assert(ev.pass,'reference no longer passes');}for(const [i,ev]of v.mutations.entries()){verifyEvaluation(c,c.mutations[i].resolution,ev);assert.equal(ev.category,'test-failure');}assert(v.valid);count++;
 save(join(d,'preflight-state.json'),{cases:count,total:60,at:new Date().toISOString()});}
 load(d);assert.equal(environmentHash(),p.environment_sha256);save(join(d,'preflight-complete.json'),{protocol_sha256:digest,cases:count,valid:true,at:new Date().toISOString()});
}
export async function dispatch(d,{fetcher=fetch,key}={}){
 const {p,digest,cases,requests,rows}=load(d);assert.equal(read(join(d,'preflight-complete.json')).protocol_sha256,digest);assert.equal(environmentHash(),p.environment_sha256);
 const out=join(d,'responses');fs.mkdirSync(out,{recursive:true});const lock=join(out,'.lock');fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
 try{if(fs.existsSync(join(d,'rate-limit-stop.json')))return false;
 key??=process.env[p.model.env]??execFileSync(p.model.helper,[],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();assert(key,'credential missing');const byId=new Map(cases.map(c=>[c.id,c]));
 for(const s of rows){const file=join(out,s.request_id+'.json'),started=file+'.started',request=requests[`${s.case_id}/${s.arm}`];
 if(fs.existsSync(file)){const r=read(file);assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);if(r.http_status===429){save(join(d,'rate-limit-stop.json'),s);return false;}continue;}
 load(d);assert.equal(environmentHash(),p.environment_sha256);let error=null,response=null,raw_body=null,http_status=null;const at=new Date().toISOString();
 if(fs.existsSync(started)){const x=read(started);assert.equal(x.protocol_sha256,digest);assert.equal(x.request_sha256,s.request_sha256);error='interrupted-attempt-unknown-response';}
 else{save(started,{protocol_sha256:digest,request_sha256:s.request_sha256,at});try{const r=await fetcher(p.model.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(request),signal:AbortSignal.timeout(p.timeout_ms)});http_status=r.status;raw_body=await r.text();try{response=JSON.parse(raw_body);}catch{error='non-json-response';}if(http_status!==200)error??=`http-${http_status}`;}catch(e){error=e.name==='TimeoutError'?'timeout':'transport-error';}}
 const decoded=error?{kind:'transport-error',parsed:null}:decode(response,byId.get(s.case_id),s.arm);
 save(file,{protocol_sha256:digest,scheduled:s,request,request_sha256:s.request_sha256,started_at:read(started).at,finished_at:new Date().toISOString(),http_status,raw_body,response,error,...decoded});fs.rmSync(started);
 save(join(d,'dispatch-state.json'),{finished_request:s,at:new Date().toISOString()});if(http_status===429){save(join(d,'rate-limit-stop.json'),s);return false;}
 }return true;}finally{fs.rmSync(lock);}
}
export function summarize(runs){
 assert.equal(runs.length,12);for(const rows of runs){assert.equal(rows.length,60);assert.equal(new Set(rows.map(r=>r.id)).size,60);}
 const perRun=runs.map(rs=>effects(rs,['hunk-only'])),deltas=perRun.map(e=>e.unweighted['hunk-only'].delta),mean=deltas.reduce((s,x)=>s+x,0)/12,sd=sampleSD(deltas),width=clusterCritical(12)*sd/Math.sqrt(12);
 const cluster=clusterJackknife(runs.flat(),['hunk-only'])['hunk-only'];assert(Math.abs(cluster.delta-mean)<1e-12);
 const standardized_mean=perRun.reduce((s,e)=>s+e.standardized['hunk-only'].delta,0)/12;
 const run_interval={lower:mean-width,upper:mean+width,df:11,sample_sd:sd,method:'Student-t-over-12-fresh-paired-run-deltas'};
 // Zero empirical spread cannot prove zero sampling uncertainty.
 if(sd===0){run_interval.lower=-1;run_interval.upper=1;run_interval.fallback='zero-sample-variance-uninformative';}
 const reliability=Object.fromEntries(['selected','hunk-only'].map(arm=>{const yields=runs.map(rs=>rs.filter(r=>r[arm]).length/60);return[arm,{yields,sample_sd:sampleSD(yields),counts:runs[0].map(r=>({id:r.id,successes:runs.reduce((s,rs)=>s+Number(rs.find(x=>x.id===r.id)[arm]),0)}))}];}));
 const positive=mean>.05+1e-12&&standardized_mean>.05+1e-12&&cluster.lower>0&&run_interval.lower>0;
 return{stage:positive?'EXPLORATORY MEAN BENEFIT':'NO DEMONSTRATED MEAN BENEFIT (FINAL COHORT ATTEMPT)',independent_cases:60,independent_lineages:cluster.clusters,repetitions:12,mean,standardized_mean,run_interval,cluster,perRun,reliability,confirmation_authorized:false,last_attempt_on_cohort:true};
}
export function aggregate(d){
 const {p,digest,cases,requests,rows}=load(d);assert.equal(environmentHash(),p.environment_sha256);const byId=new Map(cases.map(c=>[c.id,c]));const runs=Array.from({length:12},()=>cases.map(c=>({id:c.id,repo:c.cluster_id,cell:c.cell,selected:false,'hunk-only':false}))),metrics={};
 let valid=true;for(const s of rows){const r=read(join(d,'responses',s.request_id+'.json')),c=byId.get(s.case_id);assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.deepEqual(r.request,requests[`${s.case_id}/${s.arm}`]);assert.equal(hash(JSON.stringify(r.request)),s.request_sha256);if(r.raw_body!==null){let raw=null;try{raw=JSON.parse(r.raw_body);}catch{}assert.deepEqual(raw,r.response);}
 const decoded=r.error?{kind:'transport-error',parsed:null}:decode(r.response,c,s.arm);assert.equal(decoded.kind,r.kind);assert.deepEqual(decoded.parsed,r.parsed);
 const m=metrics[`${s.repeat}/${s.arm}`]??={scheduled:60,completed:0,passed:0,categories:{},input_tokens:0,output_tokens:0};m.completed++;m.input_tokens+=r.response?.usage?.prompt_tokens??0;m.output_tokens+=r.response?.usage?.completion_tokens??0;let category=r.kind;
 if(r.kind==='resolve'){const file=join(d,'evaluations',s.request_id+'.json');let ev;if(fs.existsSync(file)){ev=read(file);assert.equal(ev.protocol_sha256,digest);assert.equal(ev.resolution_sha256,hash(r.parsed.resolution));}else{ev={protocol_sha256:digest,resolution_sha256:hash(r.parsed.resolution),...evaluate(c,r.parsed.resolution)};save(file,ev);}verifyEvaluation(c,r.parsed.resolution,ev);category=ev.category;if(category==='environment-error')valid=false;const row=runs[s.repeat-1].find(x=>x.id===c.id);row[s.arm==='hunk-only'?'hunk-only':'selected']=ev.pass;if(ev.pass)m.passed++;}
 m.categories[category]=(m.categories[category]??0)+1;}
 for(const m of Object.values(metrics)){if(((m.categories['transport-error']??0)+(m.categories['provider-error']??0))/60>.05)valid=false;m.estimated_usd=(m.input_tokens*p.model.prices.input+m.output_tokens*p.model.prices.output)/1e6;}
 const finding=valid?summarize(runs):{stage:'INVALID INSTRUMENT',confirmation_authorized:false};load(d);assert.equal(environmentHash(),p.environment_sha256);const result={version:'h0-mercury-final-result/1',protocol_sha256:digest,complete:true,valid,gate_clearing:false,finding,metrics,rowsByRepeat:runs};save(join(d,'aggregate.json'),result);return result;
}
async function main(d){
 const state=(stage,extra={})=>save(join(d,'state.json'),{pid:process.pid,stage,at:new Date().toISOString(),...extra});
 try{if(!fs.existsSync(join(d,'protocol.json')))prepare(d);state('preflight');preflight(d);state('dispatching');if(!await dispatch(d)){state('finished',{finding_stage:'INCOMPLETE — RATE LIMIT STOP'});return;}state('evaluating');const a=aggregate(d);state('finished',{finding_stage:a.finding.stage,valid:a.valid});}
 catch(e){state('error',{finding_stage:'INVALID INSTRUMENT',error:e.message});process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main(resolve(process.argv[2]??join(here,'run')));
