import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepare,load,save,dispatch,summarize} from './attempt.mjs';
const parent=fs.mkdtempSync(join(tmpdir(),'mercury-final-test-')),d=join(parent,'study');
try{
 prepare(d);const {digest,rows,cases,requests}=load(d);assert.equal(rows.length,1440);assert.equal(new Set(rows.map(r=>r.request_id)).size,1440);assert.equal(Object.keys(requests).length,120);
 for(const c of cases)for(const arm of ['hunk-only','candidates-structural'])assert.equal(rows.filter(r=>r.case_id===c.id&&r.arm===arm).length,12);
 const fakeRows=cases.map((c,i)=>({id:c.id,repo:c.cluster_id,cell:c.cell,selected:i<20,'hunk-only':i<20}));
 const nullResult=summarize(Array.from({length:12},()=>structuredClone(fakeRows)));assert.equal(nullResult.mean,0);assert.equal(nullResult.cluster.delta,0);assert.equal(nullResult.stage,'NO DEMONSTRATED MEAN BENEFIT (FINAL COHORT ATTEMPT)');assert.equal(nullResult.independent_cases,60);assert.equal(nullResult.independent_lineages,34);assert.equal(nullResult.confirmation_authorized,false);
 const runs=Array.from({length:12},(_,r)=>cases.map((c,i)=>({id:c.id,repo:c.cluster_id,cell:c.cell,selected:i<30+r%3,'hunk-only':i<12})));const positive=summarize(runs);assert(Math.abs(positive.mean-19/60)<1e-12);assert.equal(positive.stage,'EXPLORATORY MEAN BENEFIT');assert(positive.run_interval.sample_sd>0);
 save(join(d,'preflight-complete.json'),{protocol_sha256:digest,valid:true,cases:60});const first=rows[0];save(join(d,'responses',first.request_id+'.json.started'),{protocol_sha256:digest,request_sha256:first.request_sha256,at:new Date().toISOString()});
 let calls=0;const result=await dispatch(d,{key:'fake-test-secret',fetcher:async()=>{calls++;return{status:429,text:async()=>'{}'};}});assert.equal(result,false);assert.equal(calls,1);assert.equal(JSON.parse(fs.readFileSync(join(d,'responses',first.request_id+'.json'))).error,'interrupted-attempt-unknown-response');assert(fs.existsSync(join(d,'rate-limit-stop.json')));assert.equal(await dispatch(d,{key:'fake',fetcher:async()=>{throw Error('must not retry')}}),false);
 const p=join(d,'requests.json');fs.appendFileSync(p,' ');assert.throws(()=>load(d));console.log('PASS: 1440 unique slots, 120 unchanged bodies, 12 paired runs, clustered null/positive mean controls, 60 cases/34 lineages, no confirmation, unknown attempt preserved, permanent 429 stop, drift rejection. No API or oracle calls.');
}finally{fs.rmSync(parent,{recursive:true,force:true});}
