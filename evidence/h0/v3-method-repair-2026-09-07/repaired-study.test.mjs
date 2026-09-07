import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {freezeStudy,aggregateRepeated} from './repaired-study.mjs';
import {loadRepeated} from './repeat-dispatch.mjs';
import {verifyEvaluation} from './evaluation-receipt.mjs';
const d=mkdtempSync(join(tmpdir(),'mrgr-study-integration-'));
try{
 const recovery=join(d,'synthetic-recovery.json');writeFileSync(recovery,JSON.stringify({complete:true,synthetic_only:true}));
 const out=join(d,'study');freezeStudy('evidence/h0/v3-repaired-preparation-2026-09-07c',out,recovery);
 const {schedule,digest,requests,cases}=loadRepeated(out);
 assert.equal(schedule.rows.length,1080);for(const model of ['mercury','minimax'])mkdirSync(join(out,'responses',model),{recursive:true});
 const response={choices:[{finish_reason:'stop',message:{content:'{"decision":"halt","resolution":"","citations":[]}'}}]};
 for(const s of schedule.rows){const request=requests[`${s.case_id}/${s.model}/${s.arm}`];writeFileSync(join(out,'responses',s.model,`${s.request_id}.json`),JSON.stringify({protocol_sha256:digest,scheduled:s,request,request_sha256:s.request_sha256,response,raw_body:JSON.stringify(response),http_status:200,error:null,kind:'halt',parsed:{decision:'halt',resolution:'',citations:[]}}));}
 const result=aggregateRepeated(out);assert.equal(result.complete,true);assert.equal(result.valid,true);assert.equal(result.finding.stage,'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED');assert(!Object.hasOwn(result,'MEASURABLE'));assert.equal(result.finding.independent_cases,60);assert.equal(result.metrics.mercury.selected.halt,60);assert.equal(result.metrics.mercury.selected.coverage,0);assert.equal(result.rowsByModel.mercury.length,60);assert.equal(Object.keys(result.comparisons.mercury).length,10);assert.equal(result.finding.reliability.minimax.arms.selected.sample_sd,0);assert(Object.values(result.metricsByRepeat).every(m=>m.completed===60&&m.categories.halt===60));
 const first=schedule.rows[0],path=join(out,'responses',first.model,`${first.request_id}.json`);rmSync(path);const partial=aggregateRepeated(out);assert.equal(partial.complete,false);assert.equal(partial.pending.length,1);assert.equal(partial.finding.stage,'IN_DEVELOPMENT');assert.equal(partial.finding.effects,null);
 const c=cases[0],ev=structuredClone(c.oracle_validation.reference[0]);ev.candidate_sha256='wrong';assert.throws(()=>verifyEvaluation(c,c.reference,ev),/candidate/);
 console.log('Full 1080-slot synthetic integration passed: /4 finding, three runs, all denominators, fixed-weight and unweighted contrasts, no confirmation authorization, pending response blocks inference, raw candidate mismatch rejected. No API or oracle calls.');
}finally{rmSync(d,{recursive:true,force:true});}
