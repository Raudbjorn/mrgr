import fs from 'node:fs';import assert from 'node:assert/strict';import {join} from 'node:path';
import {evaluate,environmentHash} from '../v3-data.mjs';import {read,save} from '../v3-mercury-final-2026-09-07/attempt.mjs';import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';
const p=import.meta.dirname,d=join(p,'run'),env=read(join(p,'environment-recovery.json'));assert.equal(environmentHash(),env.current_environment_sha256);const cases=new Map(read(join(d,'cases.json')).map(c=>[c.id,c]));const rows=[];
for(const file of fs.readdirSync(join(d,'evaluations')).filter(f=>f.endsWith('.json'))){
 const response=read(join(d,'responses',file)),old=read(join(d,'evaluations',file)),c=cases.get(response.scheduled.case_id),updated={...c,evaluator:{...c.evaluator,environment_sha256:env.current_environment_sha256}};
 const fresh=evaluate(updated,response.parsed.resolution);verifyEvaluation(updated,response.parsed.resolution,fresh);save(join(p,'environment-recheck',file),fresh);
 const comparable=x=>({pass:x.pass,category:x.category,candidate_sha256:x.candidate_sha256,stages:x.stages.map(s=>({stage:s.stage,status:s.status,signal:s.signal,error:s.error}))});
 assert.deepEqual(comparable(fresh),comparable(old),file);rows.push(file);console.log(rows.length,file);
}
assert.equal(environmentHash(),env.current_environment_sha256);save(join(p,'environment-recheck.json'),{at:new Date().toISOString(),valid:true,compared:rows.length,mismatches:0,rows});
