import assert from 'node:assert/strict';
import fs from 'node:fs';
import {schedule,requestFor,validateUsage} from './profile.mjs';
import {hash} from '../v3-data.mjs';
const here=import.meta.dirname,ids=JSON.parse(fs.readFileSync(here+'/case-ids.json'));
const requests=Object.fromEntries(ids.flatMap(id=>['hunk-only','candidates-structural'].map(arm=>[`${id}/${arm}`,{messages:[{role:'user',content:id+arm}]}])));
const rows=schedule(ids.map(id=>({id})),'test',requests,12);
for(const id of ids){
 const selected=rows.filter(r=>r.case_id===id);assert.equal(selected.length,24);
 let first=0;
 for(let repeat=1;repeat<=12;repeat++){
  const pair=selected.filter(r=>r.repeat===repeat);assert.equal(pair.length,2);assert.equal(pair[0].seed,pair[1].seed);assert.notEqual(pair[0].arm,pair[1].arm);
  first+=Number(pair[0].arm==='hunk-only');
  for(const s of pair){const r=requestFor(requests,s);assert.deepEqual(r.messages,requests[`${id}/${s.arm}`].messages);assert.equal(s.request_sha256,hash(JSON.stringify(r)));}
 }
 assert.equal(first,6);
}
const body={choices:[{}],usage:{prompt_tokens:16128,completion_tokens:16384,total_tokens:32512}};
validateUsage(body);
assert.throws(()=>validateUsage({...body,usage:{...body.usage,prompt_tokens:16129,total_tokens:32513}}));
assert.throws(()=>validateUsage({...body,usage:{prompt_tokens:10}}));
assert.throws(()=>validateUsage({...body,choices:[]}));
assert.deepEqual(schedule(ids.map(id=>({id})),'test',requests,12),rows);
console.log('PASS: paired seeds, balanced order, request identity, context and usage guards');
// The watchdog test runs against a fake systemctl in an isolated directory.
const {execFileSync,spawnSync}=await import('node:child_process');
const {tmpdir}=await import('node:os');
const tmp=fs.mkdtempSync(tmpdir()+'/gptoss-watchdog-');
try{
 fs.copyFileSync(here+'/watchdog.mjs',tmp+'/watchdog.mjs');fs.mkdirSync(tmp+'/run');fs.mkdirSync(tmp+'/bin');
 fs.writeFileSync(tmp+'/bin/systemctl','#!/bin/sh\n[ "$2" = show ] && echo "$TEST_STATE"\nexit 0\n',{mode:0o755});
 fs.writeFileSync(tmp+'/run/state.json',JSON.stringify({stage:'running',at:new Date().toISOString()}));
 const env={...process.env,PATH:tmp+'/bin:'+process.env.PATH,TEST_STATE:'active'};
 execFileSync(process.execPath,[tmp+'/watchdog.mjs'],{env});assert(!fs.existsSync(tmp+'/FAILURE.json'));
 assert.equal(spawnSync(process.execPath,[tmp+'/watchdog.mjs'],{env:{...env,TEST_STATE:'failed'}}).status,1);
 assert.match(JSON.parse(fs.readFileSync(tmp+'/FAILURE.json')).error,/service failed/);
 const preserved=fs.readFileSync(tmp+'/FAILURE.json','utf8');
 fs.writeFileSync(tmp+'/run/state.json',JSON.stringify({stage:'running',at:'2020-01-01T00:00:00Z'}));
 assert.equal(spawnSync(process.execPath,[tmp+'/watchdog.mjs'],{env}).status,1);
 assert.equal(fs.readFileSync(tmp+'/FAILURE.json','utf8'),preserved);
 console.log('PASS: watchdog active, failed, stale and receipt-preservation branches');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const parameters=JSON.parse(fs.readFileSync(here+'/request-parameters.json'));
for(const [key,value] of Object.entries({temperature:1,top_k:0,top_p:1,min_p:0,max_tokens:16384,ignore_eos:false,cache_prompt:false,reasoning_effort:'high',stop:[],samplers:['temperature'],chat_template_kwargs:{reasoning_effort:'high'}}))assert.deepEqual(parameters[key],value);
assert(!('grammar' in parameters));assert(!('response_format' in parameters));
console.log('PASS: scored sampling profile excludes synthetic forced continuation');
