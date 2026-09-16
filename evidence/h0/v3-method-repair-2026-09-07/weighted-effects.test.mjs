import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {hash} from '../v3-data.mjs';
import {rng} from '../v3.mjs';
import {CELLS,effects} from './weighted-effects.mjs';
const cases=JSON.parse(readFileSync(new URL('../v3-development-2026-09-06e/cases.json',import.meta.url)));
const frame=cases.map(c=>({id:c.id,repo:c.cluster_id,cell:`${c.reference===c.ours||c.reference===c.theirs?'side-verbatim':'blend'}/${existsSync(`${c.evaluator.scaffold}/go.mod`)?'module':'GOPATH'}`}));
assert.deepEqual(CELLS.map(c=>frame.filter(r=>r.cell===c).length),[15,15,17,13]);
const planted=frame.map(r=>({...r,selected:r.cell===CELLS[0],control:false}));
const p=effects(planted,['control']);assert.equal(p.standardized.control.delta,0.25);
const duplicate=effects(planted.map(r=>({...r,control:r.selected})),['control']);
assert.equal(duplicate.standardized.control.delta,0);assert(duplicate.standardized.control.lower<0&&duplicate.standardized.control.upper>0);
assert.equal(effects(planted.filter(r=>r.cell!==CELLS[0]),['control']).standardized,null);
const unsupported=effects(planted.map(r=>({...r,repo:r.cell===CELLS[0]?'singleton':r.repo})),['control']);
assert.equal(unsupported.uncertainty_available,false);assert.equal(unsupported.standardized.control.variance,null);
const reversed=effects([...planted].reverse(),['control']);assert(Math.abs(reversed.standardized.control.half_width-p.standardized.control.half_width)<1e-12);
const masses=p.standardized.control.lineage_masses;assert(Math.abs(masses.reduce((a,b)=>a+b,0)-1)<1e-12);
assert(Math.abs(2*Math.exp(-(p.standardized.control.half_width**2)/(2*masses.reduce((s,w)=>s+w*w,0)))-0.05)<1e-12,'bound inversion');
assert.throws(()=>effects([...planted,planted[0]],['control']),/unique/);
assert.throws(()=>effects(planted.map(r=>({...r,cell:null})),['control']),/composition/);
// Calibration uses actual cluster/cell membership but no observed solver outcomes.
// Cluster shocks induce correlated differences; heterogeneous null cancels only
// under the frozen weights, so this exercises more than a homogeneous +10pp.
const random=rng(20260907),draws=2000,scenarios={null:[0,0,0,0],heterogeneous_null:[0.3,-0.3,0.2,-0.2],positive:[0.3,0.3,0.3,0.3]},results={};
for(const [name,deltas] of Object.entries(scenarios)){
 let covered=0,positive=0;const truth=deltas.reduce((s,v)=>s+v/4,0);
 for(let i=0;i<draws;i++){
  const shocks=new Map([...new Set(frame.map(r=>r.repo))].map(k=>[k,random()<0.5?-0.1:0.1]));
  const rows=frame.map(r=>({...r,selected:random()<0.35+deltas[CELLS.indexOf(r.cell)]+shocks.get(r.repo),control:random()<0.35-shocks.get(r.repo)}));
  const e=effects(rows,['control']).standardized.control;
  if(e.lower<=truth&&e.upper>=truth)covered++;
  if(e.lower>0)positive++;
 }
 results[name]={draws,true_standardized_delta:truth,coverage:covered/draws,positive_lower_bound_rate:positive/draws};
 assert(covered/draws>=0.95,`${name}: bounded interval coverage below nominal`);
 if(truth===0)assert(positive/draws<=0.05,`${name}: one-sided false positive exceeds tolerance`);
}
const result={at:new Date().toISOString(),synthetic_only:true,solver_requests:0,cases:60,clusters:new Set(frame.map(r=>r.repo)).size,counts:p.counts,weights:p.weights,checks:{planted_delta:0.25,duplicate_zero:true,missing_cell_blocks:true,single_lineage_blocks_uncertainty:true,permutation_invariant:true},calibration:results,source_hashes:Object.fromEntries(['weighted-effects.mjs','weighted-effects.test.mjs','../v3-inference.mjs'].map(f=>[f,hash(readFileSync(new URL(f,import.meta.url)))])),limits:'Scenario calibration, not proof of universal coverage or confirmation power; actual cluster/cell layout, simulated outcomes only. Recalibration is required for a different confirmation frame.'};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
