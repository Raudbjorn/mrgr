import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hash} from '../v3-data.mjs';
const here=import.meta.dirname;
export const requestFor=(requests,s)=>({...requests[`${s.case_id}/${s.arm}`],seed:s.seed});
export function schedule(cases,digest,requests,repeats){
 assert.equal(repeats,12);const ids=new Set(cases.map(c=>c.id));assert.equal(ids.size,60);
 const rows=fs.readFileSync(here+'/paired-schedule.jsonl','utf8').trim().split('\n').map(JSON.parse).map(s=>{
  assert(ids.has(s.case_id));const arm={'boundaries_only':'hunk-only','with_candidates':'candidates-structural'}[s.condition];assert(arm);
  const row={repeat:s.repeat+1,case_id:s.case_id,arm,seed:s.seed,request_id:hash(`${digest}:${s.attempt_id}`)};
  row.request_sha256=hash(JSON.stringify(requestFor(requests,row)));return row;
 });
 assert.equal(rows.length,1440);assert.equal(new Set(rows.map(s=>s.request_id)).size,1440);return rows;
}
export function validateUsage(body){
 assert.equal(body?.choices?.length,1,'expected one choice');
 const u=body.usage;
 for(const k of ['prompt_tokens','completion_tokens','total_tokens'])assert(Number.isSafeInteger(u?.[k])&&u[k]>=0,`missing/invalid usage.${k}`);
 assert.equal(u.total_tokens,u.prompt_tokens+u.completion_tokens);
 assert(u.prompt_tokens+16384+256<=32768,'context reserve exceeded');
 assert(u.completion_tokens<=16384,'output cap exceeded');
}
