import assert from 'node:assert/strict';
import {ARMS,BASELINES} from '../v3.mjs';
import {CELLS} from './weighted-effects.mjs';
import {repeatedOutcomes,sampleSD} from './repeated-outcomes.mjs';
const rows=Array.from({length:60},(_,i)=>({id:String(i),repo:`repo-${i%30}`,cell:CELLS[i%4],...Object.fromEntries([...ARMS,...BASELINES].map(k=>[k,k==='selected']))}));
const primary={mercury:rows,minimax:structuredClone(rows)},runs=Array.from({length:3},()=>structuredClone(primary));
// Synthetic checks explicitly stand in for the still-unfinished instrument proof.
const checks={complete:true,integrity:true,instrument_valid:true,composition_frozen:true,weighted_calibrated:true};
let result=repeatedOutcomes(runs,checks);assert.equal(result.next,'assess-power-only');assert.equal(result.confirmation_authorized,false);assert.equal(result.independent_cases,60);assert.equal(result.independent_clusters,30);assert.equal(result.reliability.mercury.arms.selected.sample_sd,0);
assert.throws(()=>repeatedOutcomes(runs,{...checks,weighted_calibrated:false}),/not calibrated/);
const failing=structuredClone(runs);for(const r of failing[1].mercury)r.selected=false;
result=repeatedOutcomes(failing,checks);assert.equal(result.stage,'UNSTABLE OR INSUFFICIENT DEVELOPMENT BENEFIT');assert.equal(result.reliability.mercury.arms.selected.discordant_cases,60);assert(Math.abs(result.reliability.mercury.arms.selected.sample_sd-Math.sqrt(1/3))<1e-12);assert(result.reliability.mercury.arms.selected.within_case_success_counts.every(r=>r.successes===2));
[failing[0],failing[1]]=[failing[1],failing[0]];assert.equal(repeatedOutcomes(failing,checks).stage,'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED');
assert.throws(()=>repeatedOutcomes(runs.slice(0,2),checks),/three/);
const changed=structuredClone(runs);changed[2].minimax[0].cell=CELLS[1];assert.throws(()=>repeatedOutcomes(changed,checks),/mismatch/);
changed[2]=structuredClone(runs[2]);changed[2].minimax[0]['keep-ours']=true;assert.throws(()=>repeatedOutcomes(changed,checks),/baseline/);
assert.equal(sampleSD([0,0,0]),0);console.log('Repeated-outcome controls passed; synthetic only, no provider requests.');
