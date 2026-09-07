import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {ARMS,BASELINES,verdict,clustered} from '../v3.mjs';import {hash} from '../v3-data.mjs';import {readiness} from './readiness.mjs';
const raw=readFileSync('evidence/h0/v3-development-2026-09-06e/cases.json'),cases=JSON.parse(raw),comparators=[...ARMS.filter(k=>k!=='selected'),...BASELINES];
// Reuse the actual IDs/cluster allocation, not the observed outcomes. Synthetic
// outcomes never enter evidence matrices or earn behavioral correctness credit.
const rows=cases.map((c,i)=>({id:c.id,repo:c.cluster_id,selected:i<36,...Object.fromEntries(comparators.map(k=>[k,['git_text','gnu_diff3','always-halt'].includes(k)?false:i<18]))}));
const positive={mercury:structuredClone(rows),minimax:structuredClone(rows)},flags={complete:true,eligible:true,integrity:true,instrumentValid:true};
const planted=verdict(positive,flags);for(const model of Object.keys(positive))for(const key of comparators)assert(Math.abs(planted.comparisons[model][key].delta-(['git_text','gnu_diff3','always-halt'].includes(key)?0.6:0.3))<1e-12);
assert.equal(planted.finding.stage,'BOUNDED POSITIVE UTILITY','known positive must reach the synthetic verdict');
const duplicate=structuredClone(positive);for(const rs of Object.values(duplicate))for(const r of rs)r['hunk-only']=r.selected;
const nullResult=verdict(duplicate,flags);assert.equal(nullResult.finding.stage,'POSITIVE UTILITY NOT ESTABLISHED');for(const model of Object.keys(duplicate)){const v=nullResult.comparisons[model]['hunk-only'];assert.equal(v.delta,0);assert(v.lower<=0&&v.upper>=0);}
const wrong=structuredClone(positive);for(const r of wrong.mercury)r.selected=false;assert.equal(verdict(wrong,flags).finding.stage,'POSITIVE UTILITY NOT ESTABLISHED');
assert.equal(verdict(positive,{...flags,integrity:false}).finding.stage,'INVALID INSTRUMENT');assert.equal(verdict(positive,{...flags,eligible:false}).finding.stage,'IN_DEVELOPMENT');
const checks={complete:true,integrity:true,instrument_valid:true,composition_frozen:true};
assert.equal(readiness(positive,checks).status,'ASSESS_POWER_ONLY');assert.equal(readiness(positive,checks).confirmation_authorized,false);
assert.equal(readiness(duplicate,checks).status,'STOP_NO_DEMONSTRATED_BENEFIT');assert.equal(readiness(wrong,checks).status,'STOP_NO_DEMONSTRATED_BENEFIT');
assert.equal(readiness(positive,{...checks,instrument_valid:false}).status,'INVALID_OR_INCOMPLETE');
const floor=structuredClone(positive);for(const rs of Object.values(floor))rs.forEach((r,i)=>r['hunk-only']=i<33);assert.equal(readiness(floor,checks).status,'STOP_NO_DEMONSTRATED_BENEFIT');
const malformed=structuredClone(positive);delete malformed.mercury[0]['local-context'];assert.throws(()=>readiness(malformed,checks),/missing scheduled/);
const duplicateId=structuredClone(positive);duplicateId.minimax[1].id=duplicateId.minimax[0].id;assert.throws(()=>readiness(duplicateId,checks));
// Cluster bookkeeping invariance under row permutation.
const forward=clustered(rows,comparators),reverse=clustered([...rows].reverse(),comparators);
for(const key of comparators)for(const field of ['delta','lower','upper','variance'])assert(Math.abs(forward[key][field]-reverse[key][field])<1e-12,'permutation changes estimate beyond floating-point rounding');
const result={at:new Date().toISOString(),pass:true,source_hashes:Object.fromEntries(['contrast-controls.test.mjs','readiness.mjs','../v3.mjs','../v3-inference.mjs'].map(f=>[f,hash(readFileSync(new URL(f,import.meta.url)))])),cases_sha256:hash(raw),cases:60,clusters:new Set(rows.map(r=>r.repo)).size,planted:{nontrivial_delta:0.3,zero_baseline_delta:0.6,synthetic_verdict:planted.finding.stage},duplicate:{delta:0,synthetic_verdict:nullResult.finding.stage},wrong_sign_rejected:true,exact_floor_stops:true,missing_outcomes_rejected:true,synthetic_only:true,solver_requests:0,utility_credit:false,limits:'Outcome controls validate estimator/denominator/verdict wiring; they do not establish prompt validity, semantic quality, or repeated-sampling false-positive rates.'};
writeFileSync(new URL('contrast-controls.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
