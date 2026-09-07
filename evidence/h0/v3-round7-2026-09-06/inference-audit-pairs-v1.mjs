// Simulation audit only. This creates no experimental observations or solver calls.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {clustered,rng,sourceHashes} from './v3.mjs';
import {hash} from './v3-data.mjs';
import {wilsonLower} from './v3-design.mjs';

export function audit({sizes,heterogeneity,effect=0,discordance=0.4,repetitions=1000,bootstrap=2000,seed=2026090701}){
  assert(sizes.length>=2&&sizes.every(n=>Number.isSafeInteger(n)&&n>0));
  assert(Math.abs(effect)+heterogeneity<=discordance&&discordance<=1&&heterogeneity>=0);
  assert(Number.isSafeInteger(repetitions)&&repetitions>0&&Number.isSafeInteger(bootstrap)&&bootstrap>=100);
  const random=rng(seed);let covered=0,positive=0,negative=0,meanDelta=0;
  for(let trial=0;trial<repetitions;trial++){
    const rows=sizes.flatMap((n,repo)=>{
      const delta=effect+(random()<0.5?-heterogeneity:heterogeneity),win=(discordance+delta)/2,loss=(discordance-delta)/2;
      return Array.from({length:n},()=>{const u=random();if(u<win)return{repo,selected:true,comparison:false};if(u<win+loss)return{repo,selected:false,comparison:true};const same=random()<0.5;return{repo,selected:same,comparison:same};});
    });
    const result=clustered(rows,['comparison'],bootstrap,Math.floor(random()*2**32)).comparison;
    if(result.lower<=effect&&result.upper>=effect)covered++;
    if(result.lower>effect)positive++;if(result.upper<effect)negative++;meanDelta+=result.delta;
  }
  const interval=w=>[wilsonLower(w,repetitions),1-wilsonLower(repetitions-w,repetitions)];
  return {sizes,heterogeneity,effect,discordance,repetitions,bootstrap,seed,coverage:covered/repetitions,coverage_mc95:interval(covered),lower_exceeds_truth:positive/repetitions,upper_below_truth:negative/repetitions,mean_delta:meanDelta/repetitions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const configs=[
    {sizes:Array(12).fill(34),heterogeneity:0},
    {sizes:Array(12).fill(34),heterogeneity:0.25},
    {sizes:[60,60,60,60,...Array(8).fill(20)],heterogeneity:0.25},
    {sizes:Array(50).fill(8),heterogeneity:0.25},
  ];
  const output={purpose:'Prospective coverage audit of current pairs-cluster percentile interval; no empirical utility evidence',estimand:'Population mean paired difference under independent identically distributed repository shifts and fixed repository sizes',source_hashes:sourceHashes(),script_sha256:hash(readFileSync(import.meta.filename)),created_at:new Date().toISOString(),configs};
  writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  const results=configs.map((c,i)=>audit({...c,seed:2026090701+i}));
  writeFileSync(process.argv[2],JSON.stringify({...output,results},null,2)+'\n');console.log(results);
}
