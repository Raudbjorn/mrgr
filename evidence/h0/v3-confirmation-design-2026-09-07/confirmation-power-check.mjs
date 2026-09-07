// Power sweep for the proposed confirmation-shaped study (design only; see
// docs/.../confirmation-study-design-2026-09-07/README.md). Uses the ACTUAL
// estimator (clusterJackknife, confirmationShape) and REAL observed dispersion
// for BOTH models -- not a generic power formula, not an invented parametric
// model, and not calibrated to one model alone.
//
// Correction of an earlier draft of this script: an initial version treated
// MiniMax as having "no effect and no useful dispersion" for this specific
// comparison. That was wrong -- pooled across the closed exploratory study's
// three repeats, MiniMax's candidates-structural-minus-hunk-only net is
// +6.7pp (Mercury: +9.4pp), i.e. directionally similar and in the same
// ballpark, just noisier and never clearing +5pp robustly across repeats.
// Both models are calibrated from their own real data below.
//
// Method: fixed-total-discordance shift, resampled by lineage, per model
// (see comments at shiftedNet/synthesize). Reports THREE things per sweep
// point: Mercury's own power, MiniMax's own power, and their JOINT power
// (both lower bounds clear zero) under the inherited both-models-required
// conjunction -- since that joint number, not either model's own number, is
// what the current contract's design actually requires.
//
// Known limitations, stated once here rather than hidden:
// - Pooling three repeats of the same 60 cases per model gives 180 values
//   per model, not 180 independent draws -- three noisy looks at the same
//   population, used only to enrich the per-lineage resampling pool. This
//   likely UNDERSTATES true between-lineage variance a real fresh cohort
//   would show.
// - A lineage with zero observed discordance (D_j=0, for that model) cannot
//   express any effect in this model regardless of the candidate effect
//   size being tested.
// - The two models' synthetic draws here are independent given the lineage
//   structure -- a simplifying assumption. In reality both models answer
//   the same merge cases, so their outcomes may be positively correlated
//   (both do well on "easy" cases), which would raise joint power above
//   what independence implies. Named, not corrected for.
// Every power figure below is an optimistic upper bound, not a guarantee.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {clusterJackknife,confirmationShape} from '../v3-inference.mjs';

const CLOSED=resolve(import.meta.dirname,'../v3-candidate-repair-2026-09-07/run/aggregate-amended.json');
const closed=JSON.parse(readFileSync(CLOSED,'utf8'));
assert.equal(closed.valid,true,'refusing to calibrate a power sweep against an invalid source study');

function buildPool(model){
  const rows=closed.rowsByRepeat.flatMap(rep=>rep[model]);
  const byLineage=new Map();
  for(const r of rows){
    const net=Number(r['candidates-structural'])-Number(r['hunk-only']);
    if(!byLineage.has(r.repo))byLineage.set(r.repo,[]);
    byLineage.get(r.repo).push(net);
  }
  const lineages=[...byLineage.keys()];
  assert(lineages.length>=2,`${model}: need at least two lineages to resample from`);
  const observedMean=rows.reduce((s,r)=>s+Number(r['candidates-structural'])-Number(r['hunk-only']),0)/rows.length;
  return {byLineage,lineages,observedMean};
}
const pools={mercury:buildPool('mercury'),minimax:buildPool('minimax')};

function localRates(pool){
  const n=pool.length,plus=pool.filter(x=>x===1).length,minus=pool.filter(x=>x===-1).length;
  return {plus:plus/n,minus:minus/n,total_discordance:(plus+minus)/n};
}
const rng=seed=>{let ctr=0;return()=>{const h=createHash('sha256').update(`${seed}:${ctr++}`).digest();return h.readUInt32BE(0)/2**32;};};
const pick=(arr,draw)=>arr[Math.floor(draw()*arr.length)];

function shiftedNet(rates,targetEffect,draw){
  const D=rates.total_discordance,clamped=Math.max(-D,Math.min(D,targetEffect));
  const pPlus=(D+clamped)/2,pMinus=(D-clamped)/2,u=draw();
  if(u<pPlus)return 1;
  if(u<pPlus+pMinus)return -1;
  return 0;
}
function synthesize(pool,n,L,targetEffect,draw){
  const sizes=Array.from({length:L},(_,i)=>Math.floor(n/L)+(i<n%L?1:0));
  assert(confirmationShape(sizes),`sizes for n=${n} L=${L} fail confirmationShape`);
  const rowsOut=[];
  for(let j=0;j<L;j++){
    const rates=localRates(pool.byLineage.get(pick(pool.lineages,draw)));
    for(let k=0;k<sizes[j];k++){
      const net=shiftedNet(rates,targetEffect,draw);
      rowsOut.push({id:`syn-${j}-${k}`,repo:`syn-lineage-${j}`,selected:net>=0,'hunk-only':net<=0});
    }
  }
  return rowsOut;
}

const SIZES=[400,600,800,1000,1500,2000];
const LINEAGE_COUNTS=[50,75,100];
const EFFECTS=[0.05,0.08,0.10,0.13,0.15];
const DRAWS=300;
const results=[];
for(const n of SIZES)for(const L of LINEAGE_COUNTS){
  if(L>n)continue;
  for(const effect of EFFECTS){
    let mercuryClears=0,minimaxClears=0,jointClears=0;
    for(let b=0;b<DRAWS;b++){
      const mDraw=rng(`mercury-n${n}-L${L}-e${effect}-b${b}`),xDraw=rng(`minimax-n${n}-L${L}-e${effect}-b${b}`);
      const mLower=clusterJackknife(synthesize(pools.mercury,n,L,effect,mDraw),['hunk-only'])['hunk-only'].lower;
      const xLower=clusterJackknife(synthesize(pools.minimax,n,L,effect,xDraw),['hunk-only'])['hunk-only'].lower;
      if(mLower>0)mercuryClears++;
      if(xLower>0)minimaxClears++;
      if(mLower>0&&xLower>0)jointClears++;
    }
    results.push({n,lineages:L,candidate_effect:effect,draws:DRAWS,
      mercury_power:mercuryClears/DRAWS,minimax_power:minimaxClears/DRAWS,
      joint_both_models_power:jointClears/DRAWS,
      either_model_power:(mercuryClears+minimaxClears-jointClears)/DRAWS});
  }
}

const report={
  method:'fixed-total-discordance shift, resampled by lineage, calibrated separately per model from the closed exploratory study; clusterJackknife is the real, unmodified estimator',
  source_study:CLOSED,source_valid:closed.valid,
  observed_pooled_mean_net:{mercury:pools.mercury.observedMean,minimax:pools.minimax.observedMean},
  pooled_across_repeats:3,
  limitations:'three repeats of the same 60 cases per model are not independent draws (likely understates true between-lineage variance); a zero-discordance lineage cannot express any effect regardless of the candidate size tested; the two models\' synthetic draws are treated as independent, which may understate joint power if their real outcomes are positively correlated case-by-case. Every power figure below is an optimistic upper bound, not a guarantee.',
  reads_as:'joint_both_models_power is what the inherited both-models-required conjunction needs; either_model_power is what a changed, weaker "helps at least one model" hypothesis would need -- see decisions-required.md',
  sweep:results,
};
writeFileSync(resolve(import.meta.dirname,'confirmation-power-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({observed:report.observed_pooled_mean_net,rows_swept:results.length},null,2));
