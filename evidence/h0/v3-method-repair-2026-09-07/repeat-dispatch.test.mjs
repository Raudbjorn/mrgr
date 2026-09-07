import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ARMS,MODELS,request} from '../v3.mjs';
import {hash} from '../v3-data.mjs';
import {repeatSchedule} from './repeat-schedule.mjs';
import {loadRepeated,dispatchRepeated} from './repeat-dispatch.mjs';
const cases=JSON.parse(readFileSync(new URL('../v3-development-2026-09-06e/cases.json',import.meta.url))).map(c=>({...c,base:c.id,ours:c.id+'ours',theirs:c.id+'theirs',contexts:{'local-context':[],selected:[]}}));
const d=mkdtempSync(join(tmpdir(),'mrgr-repeat-dispatch-'));
const save=(p,x)=>writeFileSync(p,JSON.stringify(x));
try{
 const requests=Object.fromEntries(cases.flatMap(c=>Object.entries(MODELS).flatMap(([name,p])=>ARMS.map(arm=>[`${c.id}/${name}/${arm}`,request(c,arm,p)]))));
 save(join(d,'cases.json'),cases);save(join(d,'requests.json'),requests);
 const source=new URL('repeat-dispatch.mjs',import.meta.url).pathname;
 save(join(d,'protocol.json'),{version:'h0-repaired-development/1',mode:'development',models:MODELS,timeout_ms:1000,cases_sha256:hash(readFileSync(join(d,'cases.json'))),requests_sha256:hash(readFileSync(join(d,'requests.json'))),source_hashes:{[source]:hash(readFileSync(source))}});
 const digest=hash(readFileSync(join(d,'protocol.json'))),schedule=repeatSchedule(cases,digest,Object.fromEntries(Object.entries(requests).map(([k,v])=>[k,hash(JSON.stringify(v))])));save(join(d,'schedule.json'),schedule);
 assert.equal(loadRepeated(d).schedule.rows.length,1080);
 let calls=0;
 const limited=async()=>{calls++;return{status:429,text:async()=>'{"error":"rate limited"}'}};
 assert.equal((await dispatchRepeated(d,'mercury',{key:'fake',fetcher:limited})).stopped,'429');
 await dispatchRepeated(d,'mercury',{key:'fake',fetcher:limited});assert.equal(calls,1,'429 resume must not retry');
 const fake=async()=>{calls++;if(calls===2)return{status:200,text:async()=>'<non-json>'};if(calls===3)throw new Error('SECRET MUST NOT BE PERSISTED');return{status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({decision:'halt',resolution:'',citations:[]})}}]})};};
 assert.equal((await dispatchRepeated(d,'minimax',{key:'fake',fetcher:fake})).stopped,'matrix-complete');assert.equal(calls,541);
 await dispatchRepeated(d,'minimax',{key:'fake',fetcher:fake});assert.equal(calls,541,'completed answers must not retry');
 const mr=schedule.rows.filter(r=>r.model==='minimax');
 const receipt=i=>JSON.parse(readFileSync(join(d,'responses/minimax',`${mr[i].request_id}.json`)));
 assert.equal(receipt(0).error,'non-json-response');assert.equal(receipt(1).error,'transport-error');assert.equal(receipt(2).kind,'halt');assert(!JSON.stringify(receipt(1)).includes('SECRET'));
 // Remove only synthetic output to exercise an interrupted attempt separately.
 rmSync(join(d,'responses/mercury'),{recursive:true});mkdirSync(join(d,'responses/mercury'));
 const first=schedule.rows.find(r=>r.model==='mercury');save(join(d,'responses/mercury',`${first.request_id}.json.started`),{protocol_sha256:digest,request_sha256:first.request_sha256,at:'synthetic'});
 const before=calls;await dispatchRepeated(d,'mercury',{key:'fake',fetcher:limited});assert.equal(calls,before+1);
 const unknown=JSON.parse(readFileSync(join(d,'responses/mercury',`${first.request_id}.json`)));assert.equal(unknown.error,'interrupted-attempt-unknown-response');assert.equal(unknown.started_at,'synthetic');
 const altered=structuredClone(schedule);altered.rows.reverse();save(join(d,'schedule.json'),altered);assert.throws(()=>loadRepeated(d),/schedule/);
 console.log('Repeat dispatcher controls passed: 1080 slots, persistent 429 stop, interrupted attempt retained, no answer retries, malformed/transport outcomes preserved, schedule drift rejected. No API requests.');
}finally{rmSync(d,{recursive:true,force:true});}
