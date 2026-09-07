// Development stop rule. A passing result permits power assessment only.
import assert from 'node:assert/strict';
import {ARMS,BASELINES,MODELS,verdict} from '../v3.mjs';
export function readiness(rowsByModel,{complete=false,integrity=false,instrument_valid=false,composition_frozen=false}={}){
 const checks={complete,integrity,instrument_valid,composition_frozen};
 if(!Object.values(checks).every(v=>v===true))return{status:'INVALID_OR_INCOMPLETE',confirmation_authorized:false,checks};
 const models=Object.keys(MODELS);assert.deepEqual(Object.keys(rowsByModel).sort(),models.sort(),'required model matrix');
 const first=rowsByModel[models[0]];assert.equal(first.length,60,'requires 60-case development');
 assert.equal(new Set(first.map(r=>r.id)).size,first.length,'duplicate cases');
 const ids=new Map(first.map(r=>{assert(r.id&&r.repo);return[r.id,r];}));
 for(const model of models){const rows=rowsByModel[model];assert.equal(rows.length,first.length);assert.equal(new Set(rows.map(r=>r.id)).size,first.length);
  for(const r of rows){const base=ids.get(r.id);assert(base&&base.repo===r.repo,'model case/cluster mismatch');assert([...ARMS,...BASELINES].every(k=>typeof r[k]==='boolean'),'missing scheduled outcome');assert(BASELINES.every(k=>r[k]===base[k]),'deterministic baseline differs across models');}
 }
 const result=verdict(rowsByModel,{complete:true,eligible:false,integrity:true,instrumentValid:true});
 const binding=Object.entries(result.comparisons).flatMap(([model,cs])=>Object.entries(cs).filter(([key,v])=>v.delta<=(ARMS.includes(key)?0.05:0)+1e-12).map(([comparator,v])=>({model,comparator,delta:v.delta,lower:v.lower,upper:v.upper,floor:ARMS.includes(comparator)?0.05:0})));
 return{status:binding.length?'STOP_NO_DEMONSTRATED_BENEFIT':'ASSESS_POWER_ONLY',confirmation_authorized:false,binding,comparisons:result.comparisons,checks};
}
