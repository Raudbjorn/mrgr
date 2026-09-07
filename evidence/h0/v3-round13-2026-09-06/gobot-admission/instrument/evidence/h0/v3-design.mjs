// Prospective design simulation. Development rates are nuisance estimates, not a target effect.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {load,clustered,rng,ARMS,BASELINES,sampleOrder,checkGroups} from './v3.mjs';
import {hash} from './v3-data.mjs';
import {confirmationShape} from './v3-inference.mjs';
const comparators=[...ARMS.filter(a=>a!=='selected'),...BASELINES];
export function wilsonLower(w,n){const z=1.96,p=w/n;return(p+z*z/(2*n)-z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/(1+z*z/n);}
export function simulate(n,repositories,{effect=0.1,discordance=0.3,clusterEffect=0.05,selectedRate=0.5,repetitions=200,bootstrap=10000,seed=20260906,allocation}={}){
  const random=rng(seed);let passed=0;
  // A common selected outcome induces dependence between comparisons. Repository
  // effect shifts are shared across both models; model responses remain separate.
  for(let trial=0;trial<repetitions;trial++){
    const shifts=Array.from({length:repositories},()=>random()<0.5?-clusterEffect:clusterEffect);let pass=true;
    for(const model of ['mercury','minimax']){
      const rows=Array.from({length:n},(_,i)=>{
        const repo=allocation?.[i]??i%repositories,delta=effect+shifts[repo],q=Math.min(0.95,Math.max(discordance,Math.abs(delta)));
        const win=(q+delta)/2,loss=(q-delta)/2,p=Math.min(1-loss,Math.max(win,selectedRate));const selected=random()<p;
        const row={repo:String(repo),selected};for(const c of comparators)row[c]=c==='always-halt'?false:selected?random()>=win/p:random()<loss/(1-p);return row;
      });
      const cs=clustered(rows,comparators,bootstrap,Math.floor(random()*2**32));
      if(!Object.entries(cs).every(([k,v])=>v.lower>0&&v.delta>0&&(!ARMS.includes(k)||v.delta>=0.05-1e-12)))pass=false;
    }
    if(pass)passed++;
  }
  return {n,repositories,effect,discordance,clusterEffect,selectedRate,repetitions,interval_method:'cluster-jackknife-CV3-t/1',passed,joint_power:passed/repetitions,joint_power_lower:wilsonLower(passed,repetitions)};
}
export function balancedSelection(availableCases,n){
  const buckets=[...Map.groupBy(sampleOrder(availableCases),c=>c.cluster_id).values()];
  for(let g=Math.min(buckets.length,n);g>=50;g--){
    const count=Math.floor(n/g),extra=n%g,eligible=buckets.filter(cs=>cs.length>=count),larger=eligible.filter(cs=>cs.length>count).slice(0,extra);
    if(eligible.length<g||larger.length<extra)continue;
    const chosen=[...larger,...eligible.filter(cs=>!larger.includes(cs)).slice(0,g-extra)],selected=[],allocation=[];
    chosen.forEach((cs,j)=>{for(const c of cs.slice(0,count+Number(j<extra))){selected.push(c);allocation.push(j);}});
    assert.equal(selected.length,n);assert(confirmationShape([...Map.groupBy(selected,c=>c.cluster_id).values()].map(cs=>cs.length)));
    return{selected,allocation,repositories:g};
  }
  return null;
}
export function design(directory,availableCases){
  const {protocol,cases}=load(directory),result=JSON.parse(readFileSync(resolve(directory,'aggregate.json')));
  assert(protocol.mode==='development'&&protocol.eligible&&cases.length===60&&result.complete&&result.valid,'requires complete valid 60-case development');
  checkGroups([...cases,...availableCases]);assert(availableCases.every(c=>c.cluster_id&&c.git_validation&&c.oracle_validation?.valid),'available cases must be admitted before power selection');
  const used=new Set(cases.map(c=>c.group_id));assert(!availableCases.some(c=>used.has(c.group_id)),'development overlap in available confirmation frame');
  const repositories=new Set(availableCases.map(c=>c.cluster_id)).size;
  const base={version:'h0-v3-design/2',development_directory:resolve(directory),development_aggregate_sha256:hash(readFileSync(resolve(directory,'aggregate.json'))),available:availableCases.length,available_repositories:repositories,selected_n:null,joint_power_lower:0};
  if(repositories<50)return {...base,reason:'fewer-than-50-repository-clusters'};
  const rates=Object.values(result.metrics).map(arms=>arms.selected.yield);const selectedRate=Math.max(0.25,Math.min(0.75,rates.reduce((a,b)=>a+b,0)/rates.length));
  const pairRates=Object.values(result.rowsByModel).flatMap(rows=>comparators.map(k=>rows.filter(r=>Boolean(r.selected)!==Boolean(r[k])).length/rows.length));
  const discordance=Math.max(0.3,...pairRates),scenarios=[];
  for(const n of [400,800,1200,1600,2000]){
    if(n>availableCases.length)continue;
    const balanced=balancedSelection(availableCases,n);if(!balanced)continue;const {selected,allocation,repositories:g}=balanced;
    const s=simulate(n,g,{discordance,selectedRate,allocation});scenarios.push(s);
    if(s.joint_power_lower>=0.8){return {...base,...s,selected_n:n,selected_ids:selected.map(c=>c.id),allocation,scenarios,sensitivity:[simulate(n,g,{effect:0.05,discordance,selectedRate,allocation}),simulate(n,g,{effect:0.1,discordance,clusterEffect:0.1,selectedRate,allocation})],assumptions:'Planning scenarios, not observed gains. At least 50 clusters with counts differing by at most one; shared ±5pp repository effects; ±10pp sensitivity. Selected-rate nuisance uses selected arms only and is clamped to [.25,.75], then to feasible paired-Bernoulli bounds. Finite simulation uncertainty via Wilson bound.'};}
  }
  return {...base,scenarios,reason:'no-feasible-size-achieves-80-percent-joint-power'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const [dir,available,out]=process.argv.slice(2);const r=design(dir,JSON.parse(readFileSync(available)));writeFileSync(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(r));}catch(e){console.error(e.message);process.exitCode=1;}}
