import fs from 'node:fs';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {load} from './run-local.mjs';
import {requestFor,validateUsage} from './profile.mjs';
import {verifyEvaluation} from '../v3-method-repair-2026-09-07/evaluation-receipt.mjs';
import {hash} from '../v3-data.mjs';
import {read,save} from '../v3-mercury-final-2026-09-07/attempt.mjs';
import {retryAccounting} from './recovery.mjs';
const p=import.meta.dirname,d=join(p,'run'),{rows,cases,requests,digest}=load(d),byId=new Map(cases.map(c=>[c.id,c]));
const metrics={},ledger=[],artifacts={};
const pin=f=>artifacts[f]=hash(fs.readFileSync(f));
for(const s of rows){
 const m=metrics[s.arm]??={planned:0,completed:0,missing:0,passes:0,categories:{},input_tokens:0,output_tokens:0,elapsed_ms:0};m.planned++;
 const f=join(d,'responses',s.request_id+'.json');
 if(!fs.existsSync(f)){m.missing++;ledger.push({...s,status:'not_executed'});continue;}
 const r=read(f);pin(f);assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.deepEqual(r.request,requestFor(requests,s));assert.equal(hash(JSON.stringify(r.request)),r.request_sha256);assert.equal(r.error,null);assert.equal(r.http_status,200);assert.deepEqual(JSON.parse(r.raw_body),r.response);validateUsage(r.response);
 const ef=join(d,'evaluations',s.request_id+'.json');let ev=null;
 if(r.kind==='resolve'){assert(fs.existsSync(ef),'unscored resolution');ev=read(ef);pin(ef);assert.equal(ev.protocol_sha256,digest);assert.equal(ev.resolution_sha256,hash(r.parsed.resolution));const c=byId.get(s.case_id);verifyEvaluation({...c,evaluator:{...c.evaluator,environment_sha256:ev.environment_sha256}},r.parsed.resolution,ev);assert.notEqual(ev.category,'environment-error');}
 const category=ev?.category??r.kind;m.completed++;m.passes+=Number(ev?.pass??false);m.categories[category]=(m.categories[category]??0)+1;m.input_tokens+=r.response.usage.prompt_tokens;m.output_tokens+=r.response.usage.completion_tokens;m.elapsed_ms+=r.elapsed_ms;
 ledger.push({...s,status:'completed',category,pass:ev?.pass??false});
}
const completed=ledger.filter(r=>r.status==='completed').length;assert.equal(completed,782);assert(ledger.slice(0,completed).every(r=>r.status==='completed'));assert(ledger.slice(completed).every(r=>r.status==='not_executed'));
for(const m of Object.values(metrics)){m.completed_pass_rate=m.passes/m.completed;m.planned_success_bounds={lower:m.passes/m.planned,upper:(m.passes+m.missing)/m.planned};}
for(const f of ['protocol.json','schedule.json','cases.json','requests.json','state.json'])pin(join(d,f));
for(const f of ['FAILURE.json','recovery-amendment.json','record-partial.mjs'])pin(join(p,f));
for(const id of fs.readdirSync(join(d,'attempts')))for(const f of fs.readdirSync(join(d,'attempts',id)))if(f.endsWith('.json'))pin(join(d,'attempts',id,f));
const result={version:'gpt-oss-partial-closure/1',recorded_at:new Date().toISOString(),status:'CLOSED_INCOMPLETE_USER_TERMINATED',complete:false,confirmatory:false,gate_clearing:false,protocol_sha256:digest,planned:rows.length,completed,not_executed:rows.length-completed,stop:read(join(d,'state.json')),noticed_at:'2026-09-12T18:59:33.494732Z',unnoticed_hours:(Date.parse('2026-09-12T18:59:33.494732Z')-Date.parse(read(join(d,'state.json')).at))/3600000,reason:'User terminated after approximately 17 hours of unnoticed environment-fingerprint stop. Do not resume.',metrics,descriptive_unadjusted_gain:metrics['candidates-structural'].completed_pass_rate-metrics['hunk-only'].completed_pass_rate,retry_accounting:retryAccounting(d),ledger};
save(join(p,'PARTIAL-RESULT.json'),result);pin(join(p,'PARTIAL-RESULT.json'));save(join(p,'PARTIAL-ARTIFACT-HASHES.json'),artifacts);
console.log(JSON.stringify({completed,missing:result.not_executed,metrics,unnoticed_hours:result.unnoticed_hours}));
