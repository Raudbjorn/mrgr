// Simulation audit only. This creates no experimental observations or solver calls.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {rng,sourceHashes} from './v3.mjs';
import {clustered as historicalPairs} from './v3-round7-2026-09-06/batch-admission/instrument/evidence/h0/v3.mjs';
import {hash} from './v3-data.mjs';
import {wilsonLower} from './v3-design.mjs';
import {clusterJackknife,wildClusterP} from './v3-inference.mjs';

export function audit({sizes,heterogeneity,effect=0,discordance=0.4,repetitions=1000,bootstrap=2000,seed=2026090701,method='pairs',positive_cluster_probability=0.5}){
  assert(['pairs','jackknife','wild'].includes(method));
  assert(sizes.length>=2&&sizes.every(n=>Number.isSafeInteger(n)&&n>0));
  assert(positive_cluster_probability>0&&positive_cluster_probability<1);
  const negativeShift=-heterogeneity*positive_cluster_probability/(1-positive_cluster_probability);
  assert(Math.max(Math.abs(effect+heterogeneity),Math.abs(effect+negativeShift))<=discordance&&discordance<=1&&heterogeneity>=0);
  assert(Number.isSafeInteger(repetitions)&&repetitions>0&&Number.isSafeInteger(bootstrap)&&bootstrap>=100);
  const random=rng(seed);let covered=0,positive=0,negative=0,meanDelta=0;
  for(let trial=0;trial<repetitions;trial++){
    const rows=sizes.flatMap((n,repo)=>{
      const delta=effect+(random()<1-positive_cluster_probability?negativeShift:heterogeneity),win=(discordance+delta)/2,loss=(discordance-delta)/2;
      return Array.from({length:n},()=>{const u=random();if(u<win)return{repo,selected:true,comparison:false};if(u<win+loss)return{repo,selected:false,comparison:true};const same=random()<0.5;return{repo,selected:same,comparison:same};});
    });
    const bootstrapSeed=Math.floor(random()*2**32);
    if(method==='wild'){
      const result=wildClusterP(rows,'comparison',effect,{draws:bootstrap,random:rng(bootstrapSeed)}),delta=rows.reduce((s,r)=>s+Number(r.selected)-Number(r.comparison),0)/rows.length;
      if(result.p>=0.05)covered++;else if(delta>effect)positive++;else negative++;meanDelta+=delta;
    }else{
      const result=(method==='pairs'?historicalPairs:clusterJackknife)(rows,['comparison'],bootstrap,bootstrapSeed).comparison;
      if(result.lower<=effect&&result.upper>=effect)covered++;
      if(result.lower>effect)positive++;if(result.upper<effect)negative++;meanDelta+=result.delta;
    }
  }
  const interval=w=>[wilsonLower(w,repetitions),1-wilsonLower(repetitions-w,repetitions)];
  return {method,sizes,heterogeneity,positive_cluster_probability,effect,discordance,repetitions,bootstrap,seed,coverage:covered/repetitions,coverage_meaning:method==='wild'?'test acceptance at truth; confidence-set coverage by inversion, no interval endpoints constructed':'interval contains truth',coverage_mc95:interval(covered),lower_exceeds_truth:positive/repetitions,upper_below_truth:negative/repetitions,mean_delta:meanDelta/repetitions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const configs=[
    {sizes:Array(12).fill(34),heterogeneity:0},
    {sizes:Array(12).fill(34),heterogeneity:0.25},
    {sizes:[60,60,60,60,...Array(8).fill(20)],heterogeneity:0.25},
    {sizes:Array(50).fill(8),heterogeneity:0.25},
  ];
  const method=process.argv[3]??'pairs';
  const output={purpose:'Prospective interval coverage audit; no empirical utility evidence',method,estimand:'Population mean paired difference under independent identically distributed repository shifts and fixed repository sizes',source_hashes:sourceHashes(),candidate_sha256:hash(readFileSync(new URL('./v3-inference.mjs',import.meta.url))),script_sha256:hash(readFileSync(import.meta.filename)),created_at:new Date().toISOString(),configs};
  writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  const results=configs.map((c,i)=>audit({...c,seed:2026090701+i,method}));
  writeFileSync(process.argv[2],JSON.stringify({...output,results},null,2)+'\n');console.log(results);
}
