import assert from 'node:assert/strict';
import {ARMS,BASELINES,MODELS} from '../v3.mjs';
import {readiness} from './readiness.mjs';
import {effects} from './weighted-effects.mjs';
const comparators=[...ARMS.filter(k=>k!=='selected'),...BASELINES];
export function sampleSD(values){const mean=values.reduce((s,v)=>s+v,0)/values.length;return Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(values.length-1));}
export function repeatedOutcomes(runs,checks){
 assert.equal(checks.weighted_calibrated,true,'weighted uncertainty not calibrated');
 assert.equal(runs.length,3,'exactly three scheduled runs');
 const models=Object.keys(MODELS),primary=runs[0],findings=[],binding=[];
 for(const [index,run] of runs.entries()){
  const ready=readiness(run,checks);assert.notEqual(ready.status,'INVALID_OR_INCOMPLETE','readiness prerequisites incomplete');
  const measured={};
  for(const model of models){
   const expected=new Map(primary[model].map(r=>[r.id,r]));
   for(const row of run[model]){
    const prior=expected.get(row.id);assert(prior&&prior.repo===row.repo&&prior.cell===row.cell,'repeat case/cluster/cell mismatch');
    assert(BASELINES.every(k=>row[k]===prior[k]),'baseline changed across repeats');
   }
   measured[model]=effects(run[model],comparators);
   assert(measured[model].standardized&&measured[model].uncertainty_available,'composition cannot support standardized analysis');
   for(const estimator of ['unweighted','standardized'])for(const key of comparators){
    const delta=measured[model][estimator][key].delta,floor=ARMS.includes(key)?0.05:0;
    if(delta<=floor+1e-12)binding.push({repeat:index+1,model,estimator,comparator:key,delta,floor});
   }
  }
  findings.push(measured);
 }
 const reliability={};
 for(const model of models){
  const maps=runs.map(run=>new Map(run[model].map(r=>[r.id,r]))),arms={},contrasts={};
  for(const arm of ARMS){
   const counts=primary[model].map(r=>({id:r.id,successes:maps.reduce((s,m)=>s+Number(m.get(r.id)[arm]),0)}));
   const yields=runs.map(run=>run[model].reduce((s,r)=>s+Number(r[arm]),0)/60);
   arms[arm]={yields,sample_sd:sampleSD(yields),within_case_success_counts:counts,discordant_cases:counts.filter(r=>r.successes>0&&r.successes<3).length,pairwise_discordance:[[0,1],[0,2],[1,2]].map(([a,b])=>({runs:[a+1,b+1],cases:primary[model].filter(r=>maps[a].get(r.id)[arm]!==maps[b].get(r.id)[arm]).length}))};
  }
  for(const estimator of ['unweighted','standardized'])contrasts[estimator]=Object.fromEntries(comparators.map(k=>{const deltas=findings.map(f=>f[model][estimator][k].delta);return[k,{deltas,sample_sd:sampleSD(deltas)}];}));
  reliability[model]={arms,contrasts};
 }
 const stage=binding.some(r=>r.repeat===1)?'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED':binding.length?'UNSTABLE OR INSUFFICIENT DEVELOPMENT BENEFIT':'IN_DEVELOPMENT';
 return{instrument:'VALID',stage,effects:findings,reliability,binding,confirmation_authorized:false,next:binding.length?'close-current-policy':'assess-power-only',independent_cases:60,independent_clusters:new Set(primary[models[0]].map(r=>r.repo)).size,repetitions:3,run_sd_degrees_of_freedom:2,decision:'docs/planning/final/phase-3-h0-evidence-utility/gate-retirement-2026-09-07.md#what-replaces-it--part-b-the-decision-register'};
}
