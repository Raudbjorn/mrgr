import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {ARMS,MODELS} from '../v3.mjs';import {hash} from '../v3-data.mjs';import {repeatSchedule} from './repeat-schedule.mjs';
const raw=readFileSync('evidence/h0/v3-development-2026-09-06e/cases.json'),cases=JSON.parse(raw),protocolHash=hash('SYNTHETIC SCHEDULE CHECK ONLY');
const requests=Object.fromEntries(cases.flatMap(c=>Object.keys(MODELS).flatMap(m=>ARMS.map(a=>[`${c.id}/${m}/${a}`,hash(`synthetic request ${c.id} ${m} ${a}`)]))));
const s=repeatSchedule(cases,protocolHash,requests);assert.equal(s.scheduled_requests,1080);assert.equal(s.independent_cases,60);assert.equal(s.independent_clusters,34);assert.equal(new Set(s.rows.map(r=>r.request_id)).size,1080);
for(const rows of Map.groupBy(s.rows,r=>`${r.case_id}/${r.model}/${r.arm}`).values()){assert.deepEqual(rows.map(r=>r.repeat),[1,2,3]);assert.equal(new Set(rows.map(r=>r.request_sha256)).size,1);assert.equal(new Set(rows.map(r=>r.cluster_id)).size,1);}
for(let repeat=1;repeat<=3;repeat++){
 const rows=s.rows.filter(r=>r.repeat===repeat);assert.equal(rows.length,360);
 for(const model of Object.keys(MODELS))for(const arm of ARMS)assert.equal(rows.filter(r=>r.model===model&&r.arm===arm).length,60);
 // Every six-request case block contains all six model/arm cells, with each
 // cell first exactly ten times per repetition (60 cases / 6 cells).
 const firsts=rows.filter((_,i)=>i%6===0);for(const model of Object.keys(MODELS))for(const arm of ARMS)assert.equal(firsts.filter(r=>r.model===model&&r.arm===arm).length,10);
}
assert.deepEqual(repeatSchedule([...cases].reverse(),protocolHash,requests),s);
assert.throws(()=>repeatSchedule([...cases.slice(1),cases[1]],protocolHash,requests),/duplicate/);
const missing={...requests};delete missing[Object.keys(missing)[0]];assert.throws(()=>repeatSchedule(cases,protocolHash,missing));
const result={at:new Date().toISOString(),pass:true,cases_sha256:hash(raw),source_sha256:hash(readFileSync(new URL('repeat-schedule.mjs',import.meta.url))),test_sha256:hash(readFileSync(new URL(import.meta.url))),scheduled_requests:s.scheduled_requests,independent_cases:s.independent_cases,independent_clusters:s.independent_clusters,identical_body_across_repeats:true,unique_request_ids:true,balanced_cell_order:true,synthetic_only:true,requests_sent:0};
writeFileSync(new URL('repeat-schedule-test.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
