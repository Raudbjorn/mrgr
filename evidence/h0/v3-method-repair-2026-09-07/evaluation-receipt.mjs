import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {hash,applyCandidate} from '../v3-data.mjs';
export function verifyEvaluation(c,candidate,ev){
 assert(Array.isArray(ev.stages)&&ev.stages.length>0&&ev.stages.length<=2,'missing raw stages');
 assert.deepEqual(ev.stages.map(s=>s.stage),ev.stages.length===1?['build']:['build','test']);
 for(const s of ev.stages)assert.deepEqual(s.command,c.evaluator[s.stage]);
 const clean=s=>s.status===0&&!s.error&&!s.signal;
 assert.equal(ev.pass,ev.stages.length===2&&ev.stages.every(clean)&&Array.isArray(ev.completion)&&ev.completion.length>0&&ev.completion.every(r=>r.pass),'evaluation verdict inconsistent');
 assert.equal(ev.environment_sha256,c.evaluator.environment_sha256??null);
 if(ev.completion){const output=ev.stages[1].stdout+'\n'+ev.stages[1].stderr;assert.deepEqual(ev.completion,c.evaluator.test_completion.map(rule=>{const observed=[...output.matchAll(new RegExp(rule.pattern,'gm'))].length;return{...rule,observed,pass:observed===rule.count};}));}
 const bytes=applyCandidate(readFileSync(join(c.evaluator.scaffold,c.evaluator.target)),c.evaluator.start_byte,c.evaluator.end_byte,candidate);
 assert.equal(ev.candidate_sha256,hash(bytes),'candidate receipt mismatch');
 if(ev.pass)assert.equal(ev.category,'behavioral-pass');
 if(ev.category==='test-failure')assert(ev.stages.length===2&&clean(ev.stages[0])&&!ev.pass,'mutant must compile before behavioral rejection');
 return true;
}
