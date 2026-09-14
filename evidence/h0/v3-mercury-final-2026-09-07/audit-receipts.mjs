import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {load,read,save} from './attempt.mjs';
import {hash,environmentHash} from '../v3-data.mjs';
import {decode as hunkDecode} from '../v3.mjs';
import {decode as candidateDecode} from '../v3-candidate-repair-2026-09-07/candidate-arms.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';

const here=import.meta.dirname,d=join(here,'run');
const {p,digest,cases,requests,rows}=load(d),byId=new Map(cases.map(c=>[c.id,c]));
assert.equal(environmentHash(),p.environment_sha256);
assert.equal(cases.length,60);assert.equal(new Set(cases.map(c=>c.cluster_id)).size,34);
assert.equal(p.confirmation_authorized,false);assert.equal(p.last_attempt_on_cohort,true);
const old=read(join(here,'../v3-repaired-development-2026-09-07/cases.json'));
assert.deepEqual(cases,old.map(c=>({...c,evaluator:{...c.evaluator,environment_sha256:p.environment_sha256}})));
const archive={
 'hunk-only':read(join(here,'../v3-repaired-development-2026-09-07/requests.json')),
 'candidates-structural':read(join(here,'../v3-candidate-repair-2026-09-07/run/requests.json')),
};
for(const c of cases)for(const arm of p.arms)assert.deepEqual(requests[`${c.id}/${arm}`],archive[arm][`${c.id}/mercury/${arm}`]);
const artifacts={},record=file=>{artifacts[file]=hash(fs.readFileSync(file));return read(file);};
for(const name of ['protocol','cases','requests','schedule','preflight-complete'])record(join(d,name+'.json'));
const preflight=read(join(d,'preflight-complete.json'));
assert.equal(preflight.protocol_sha256,digest);assert.equal(preflight.cases,60);assert.equal(preflight.valid,true);
let referencePasses=0,rejectedMutations=0;
for(const c of cases){
 const v=record(join(d,'preflight',c.id+'.json'));
 assert.equal(v.protocol_sha256,digest);assert.equal(v.valid,true);assert.equal(v.reference.length,3);assert(v.mutations.length>=2);
 for(const ev of v.reference){verifyEvaluation(c,c.reference,ev);assert.equal(ev.pass,true);referencePasses++;}
 for(const [i,ev]of v.mutations.entries()){verifyEvaluation(c,c.mutations[i].resolution,ev);assert.equal(ev.category,'test-failure');rejectedMutations++;}
}
const names=fs.readdirSync(join(d,'responses'));
assert.deepEqual(names.sort(),rows.map(s=>s.request_id+'.json').sort());
assert.equal(rows.length,1440);assert.equal(new Set(rows.map(s=>s.request_id)).size,1440);
const cells={},kinds={};let previousFinish=Date.parse(preflight.at);
for(const s of rows){
 const r=record(join(d,'responses',s.request_id+'.json')),c=byId.get(s.case_id);
 assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);
 assert.deepEqual(r.request,requests[`${s.case_id}/${s.arm}`]);
 assert.equal(r.request_sha256,s.request_sha256);assert.equal(hash(JSON.stringify(r.request)),s.request_sha256);
 assert(Date.parse(r.started_at)>=previousFinish);assert(Date.parse(r.finished_at)>=Date.parse(r.started_at));previousFinish=Date.parse(r.finished_at);
 assert.notEqual(r.http_status,429);
 if(r.raw_body!==null){let raw=null;try{raw=JSON.parse(r.raw_body);}catch{}assert.deepEqual(raw,r.response);}
 const decoded=r.error?{kind:'transport-error',parsed:null}:(s.arm==='hunk-only'?hunkDecode:candidateDecode)(r.response,c,s.arm);
 assert.equal(r.kind,decoded.kind);assert.deepEqual(r.parsed,decoded.parsed);
 const cell=cells[`${s.repeat}/${s.arm}`]??={cases:[],kinds:{}};
 assert(!cell.cases.includes(s.case_id));cell.cases.push(s.case_id);
 cell.kinds[r.kind]=(cell.kinds[r.kind]??0)+1;kinds[r.kind]=(kinds[r.kind]??0)+1;
}
assert.equal(Object.keys(cells).length,24);for(const cell of Object.values(cells))assert.equal(cell.cases.length,60);
load(d);assert.equal(environmentHash(),p.environment_sha256);
const report={version:'h0-mercury-final-receipt-audit/1',at:new Date().toISOString(),status:'PASS',protocol_sha256:digest,independent_cases:60,independent_lineages:34,fresh_paired_runs:12,scheduled_receipts:1440,arm_run_cells:24,cases_per_cell:60,archived_request_bodies:120,reference_passes:referencePasses,compiling_rejected_mutations:rejectedMutations,kinds,cells,nonoverlapping_dispatch:true,prior_artifacts_preserved:p.preserved,artifacts,audit_source_sha256:hash(fs.readFileSync(join(here,'audit-receipts.mjs'))),scope:'Input preservation, complete request coverage, chronology, raw response/decode consistency, and all oracle preflight receipts. Candidate behavioral results and final finding require the separate completion audit.'};
save(join(here,'receipt-audit.json'),report);
console.log(JSON.stringify({status:report.status,receipts:1440,reference_passes:referencePasses,compiling_rejected_mutations:rejectedMutations,kinds},null,2));
