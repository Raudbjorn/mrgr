import assert from 'node:assert/strict';
import {read,schedule} from '../v3-mercury-final-2026-09-07/attempt.mjs';
import {hash} from '../v3-data.mjs';
import {localRequest,serverIdentity,summarize} from './run-local.mjs';
const d=new URL('../v3-mercury-final-2026-09-07/run/',import.meta.url);
const cases=read(new URL('cases.json',d)),old=read(new URL('requests.json',d));
const requests=Object.fromEntries(Object.entries(old).map(([k,r])=>[k,localRequest(r)]));
for(const [k,r]of Object.entries(requests)){assert.equal(r.model,'gpt-oss-20b-Q4_K_M.gguf');assert.deepEqual({...r,model:old[k].model},old[k]);}
const rows=schedule(cases,hash('local-test'),requests,12);assert.equal(rows.length,1440);assert.equal(new Set(rows.map(r=>r.request_id)).size,1440);
for(const c of cases)for(const arm of ['hunk-only','candidates-structural'])assert.equal(rows.filter(r=>r.case_id===c.id&&r.arm===arm).length,12);
const runs=Array.from({length:12},()=>cases.map((c,i)=>({id:c.id,repo:c.cluster_id,cell:c.cell,selected:i<20,'hunk-only':i<20})));
const summary=summarize(runs);assert.equal(summary.mean_gain,0);assert.equal(summary.cases,60);assert.equal(summary.lineages,34);assert.deepEqual(summary.run_interval,{lower:-1,upper:1});
const p={model_alias:'x',model_path:'/x',default_generation_settings:{n_ctx:131072},total_slots:1,chat_template:'template',build_info:'build'};
assert.deepEqual(serverIdentity(p),serverIdentity({...p,is_sleeping:false}));assert.notDeepEqual(serverIdentity(p),serverIdentity({...p,total_slots:4}));
console.log('PASS: 120 request bodies differ only in model ID; 1440 unique slots; 12 repeats per case/arm; cohort/lineage counts; null and zero-variance behavior; server context/slot identity. No model calls.');
