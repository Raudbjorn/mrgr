import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {load,read,save} from './attempt.mjs';
import {hash,environmentHash} from '../v3-data.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';

const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const sd=xs=>Math.sqrt(xs.reduce((s,x)=>s+(x-mean(xs))**2,0)/(xs.length-1));
const near=(a,b)=>assert(Math.abs(a-b)<1e-11,`${a} != ${b}`);
// Independent deletion calculation on fractional case-mean outcomes, not pooled boolean rows.
function cv3(rows,critical){
 const repos=[...new Set(rows.map(r=>r.repo))],g=repos.length,delta=mean(rows.map(r=>r.delta));
 const deleted=repos.map(repo=>mean(rows.filter(r=>r.repo!==repo).map(r=>r.delta)));
 const variance=(g-1)/g*deleted.reduce((s,x)=>s+(x-delta)**2,0);
 const fallback=Math.sqrt(2*Math.log(40)*repos.reduce((s,repo)=>s+(rows.filter(r=>r.repo===repo).length/rows.length)**2,0));
 const width=variance>0?critical*Math.sqrt(variance):fallback;
 return{delta,variance,lower:Math.max(-1,delta-width),upper:Math.min(1,delta+width),clusters:g};
}
if(process.argv.includes('--self-test')){
 const rows=[{repo:'a',delta:1},{repo:'a',delta:0},{repo:'b',delta:0},{repo:'b',delta:0}];
 const x=cv3(rows,2);near(x.delta,.25);near(x.variance,.0625);near(x.lower,-.25);near(x.upper,.75);
 near(sd([0,1,2]),1);assert.equal(cv3(rows.map(r=>({...r,delta:0})),2).lower,-1);
 console.log('PASS: independent case-mean CV3 deletion, sample SD, zero-variance fallback');
 process.exit(0);
}
const here=import.meta.dirname,d=join(here,'run'),{p,digest,cases,rows}=load(d);
assert.equal(read(join(d,'state.json')).stage,'finished');assert.equal(environmentHash(),p.environment_sha256);
const receipt=read(join(here,'receipt-audit.json'));assert.equal(receipt.status,'PASS');assert.equal(receipt.protocol_sha256,digest);
assert.equal(hash(fs.readFileSync(join(here,'audit-receipts.mjs'))),receipt.audit_source_sha256);
for(const [file,h]of Object.entries(receipt.artifacts))assert.equal(hash(fs.readFileSync(file)),h);
const a=read(join(d,'aggregate.json'));assert.equal(a.protocol_sha256,digest);assert.equal(a.complete,true);assert.equal(a.gate_clearing,false);
const runs=Array.from({length:12},()=>cases.map(c=>({id:c.id,repo:c.cluster_id,cell:c.cell,selected:false,'hunk-only':false})));
const metrics={},evaluationHashes={},byId=new Map(cases.map(c=>[c.id,c]));let valid=true;
for(const s of rows){
 const r=read(join(d,'responses',s.request_id+'.json')),m=metrics[`${s.repeat}/${s.arm}`]??={scheduled:60,completed:0,passed:0,categories:{},input_tokens:0,output_tokens:0};
 m.completed++;m.input_tokens+=r.response?.usage?.prompt_tokens??0;m.output_tokens+=r.response?.usage?.completion_tokens??0;let category=r.kind;
 if(r.kind==='resolve'){
  const file=join(d,'evaluations',s.request_id+'.json'),ev=read(file);evaluationHashes[file]=hash(fs.readFileSync(file));
  assert.equal(ev.protocol_sha256,digest);assert.equal(ev.resolution_sha256,hash(r.parsed.resolution));verifyEvaluation(byId.get(s.case_id),r.parsed.resolution,ev);
  category=ev.category;if(category==='environment-error')valid=false;
  runs[s.repeat-1].find(c=>c.id===s.case_id)[s.arm==='hunk-only'?'hunk-only':'selected']=ev.pass;
  if(ev.pass)m.passed++;
 }
 m.categories[category]=(m.categories[category]??0)+1;
}
assert.equal(fs.readdirSync(join(d,'evaluations')).length,Object.keys(evaluationHashes).length);
for(const m of Object.values(metrics)){
 if((m.categories['transport-error']??0)+(m.categories['provider-error']??0)>3)valid=false;
 m.estimated_usd=(m.input_tokens*p.model.prices.input+m.output_tokens*p.model.prices.output)/1e6;
}
assert.deepEqual(a.metrics,metrics);assert.deepEqual(a.rowsByRepeat,runs);assert.equal(a.valid,valid);
const audit={version:'h0-mercury-final-result-audit/1',at:new Date().toISOString(),status:'PASS',protocol_sha256:digest,valid,evaluation_receipts:Object.keys(evaluationHashes).length,evaluation_hashes:evaluationHashes,aggregate_sha256:hash(fs.readFileSync(join(d,'aggregate.json'))),receipt_audit_sha256:hash(fs.readFileSync(join(here,'receipt-audit.json')))};
if(valid){
 const f=a.finding,cells=Object.keys(p.weights),caseMeans=cases.map(c=>({id:c.id,repo:c.cluster_id,cell:c.cell,delta:mean(runs.map(rs=>{const r=rs.find(r=>r.id===c.id);return Number(r.selected)-Number(r['hunk-only']);}))}));
 assert.equal(cells.length,4);for(const w of Object.values(p.weights))assert.equal(w,.25);
 const deltas=runs.map(rs=>mean(rs.map(r=>Number(r.selected)-Number(r['hunk-only']))));
 const cluster=cv3(caseMeans,2.042273),overall=mean(deltas),spread=sd(deltas),width=2.200986*spread/Math.sqrt(12);
 for(const key of ['delta','variance','lower','upper','clusters'])near(f.cluster[key],cluster[key]);
 assert.equal(f.cluster.df,30);near(f.cluster.critical,2.042273);near(f.mean,overall);
 near(f.run_interval.sample_sd,spread);assert.equal(f.run_interval.df,11);
 near(f.run_interval.lower,spread===0?-1:overall-width);near(f.run_interval.upper,spread===0?1:overall+width);
 const cellMeans=Object.fromEntries(cells.map(cell=>[cell,mean(caseMeans.filter(r=>r.cell===cell).map(r=>r.delta))]));
 const standardized=mean(Object.values(cellMeans));near(f.standardized_mean,standardized);
 const repos=[...new Set(caseMeans.map(r=>r.repo))],masses=repos.map(repo=>cells.reduce((s,cell)=>s+.25*caseMeans.filter(r=>r.cell===cell&&r.repo===repo).length/caseMeans.filter(r=>r.cell===cell).length,0));
 const h=Math.sqrt(2*Math.log(40)*masses.reduce((s,x)=>s+x*x,0));
 for(const [i,rs]of runs.entries()){
  const e=f.perRun[i];near(e.unweighted['hunk-only'].delta,deltas[i]);
  const weighted=cells.reduce((s,cell)=>s+.25*mean(rs.filter(r=>r.cell===cell).map(r=>Number(r.selected)-Number(r['hunk-only']))),0);
  near(e.standardized['hunk-only'].delta,weighted);near(e.standardized['hunk-only'].half_width,h);
  near(e.standardized['hunk-only'].lower,Math.max(-1,weighted-h));near(e.standardized['hunk-only'].upper,Math.min(1,weighted+h));
  near(e.blend['hunk-only'].delta,mean(rs.filter(r=>r.cell.startsWith('blend/')).map(r=>Number(r.selected)-Number(r['hunk-only']))));
  for(const cell of cells)near(e.strata[cell]['hunk-only'].delta,mean(rs.filter(r=>r.cell===cell).map(r=>Number(r.selected)-Number(r['hunk-only']))));
 }
 for(const arm of ['selected','hunk-only']){
  const yields=runs.map(rs=>rs.filter(r=>r[arm]).length/60);assert.deepEqual(f.reliability[arm].yields,yields);near(f.reliability[arm].sample_sd,sd(yields));
  assert.deepEqual(f.reliability[arm].counts,cases.map(c=>({id:c.id,successes:runs.reduce((s,rs)=>s+Number(rs.find(r=>r.id===c.id)[arm]),0)})));
 }
 const positive=overall>.05+1e-12&&standardized>.05+1e-12&&cluster.lower>0&&f.run_interval.lower>0;
 assert.equal(f.stage,positive?'EXPLORATORY MEAN BENEFIT':'NO DEMONSTRATED MEAN BENEFIT (FINAL COHORT ATTEMPT)');
 assert.equal(f.independent_cases,60);assert.equal(f.independent_lineages,34);assert.equal(f.repetitions,12);assert.equal(f.confirmation_authorized,false);assert.equal(f.last_attempt_on_cohort,true);
 Object.assign(audit,{finding:f.stage,mean:overall,standardized_mean:standardized,cluster,run_interval:f.run_interval,cell_means:cellMeans,blend_mean:mean(caseMeans.filter(r=>r.cell.startsWith('blend/')).map(r=>r.delta)),standardized_mean_interval:{lower:Math.max(-1,standardized-h),upper:Math.min(1,standardized+h),half_width:h,method:'fixed-four-cell-independent-lineage-Hoeffding95/1',repeat_variance_reduction_applied:false},per_run_floor_failures:f.perRun.map((e,i)=>({repeat:i+1,unweighted:e.unweighted['hunk-only'].delta<=.05+1e-12,standardized:e.standardized['hunk-only'].delta<=.05+1e-12})).filter(x=>x.unweighted||x.standardized)});
}else assert.equal(a.finding.stage,'INVALID INSTRUMENT');
load(d);assert.equal(environmentHash(),p.environment_sha256);
audit.audit_source_sha256=hash(fs.readFileSync(join(here,'audit-result.mjs')));
save(join(here,'result-audit.json'),audit);
console.log(JSON.stringify({status:audit.status,valid,evaluation_receipts:audit.evaluation_receipts,finding:a.finding.stage},null,2));
