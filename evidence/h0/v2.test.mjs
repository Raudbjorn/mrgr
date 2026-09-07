import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {messages} from './v2.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const script=new URL('./v2.mjs',import.meta.url).pathname;
test('concrete grading and positive/null controls',()=>execFileSync(process.execPath,[script,'selftest']));
test('full aggregation preserves failures, validates raw provenance, and refuses missing cases',()=>{
  const dir=mkdtempSync(`${tmpdir()}/mrgr-h0-v2-test-`);
  const save=(p,x)=>writeFileSync(`${dir}/${p}`,JSON.stringify(x));
  const jsonl=(p,x)=>writeFileSync(`${dir}/${p}`,x.map(r=>JSON.stringify(r)).join('\n')+'\n');
  try{
    const protocol=JSON.parse(readFileSync(new URL('./v2-2026-09-06/protocol.json',import.meta.url)));
    const inputs=Array.from({length:4},(_,i)=>({id:String(i),split:'confirmation',repo:'fixture',language:'C',path:'a.c',base:'base\n',ours:'left\n',theirs:'right\n',selected:[],'bounded-context':[]}));
    const refs=inputs.map(x=>({id:x.id,resolution:'left\n',baselines:Object.fromEntries(protocol.baselines.map(a=>[a,a==='always-halt'?null:'right\n']))}));
    jsonl('inputs.jsonl',inputs);jsonl('references.jsonl',refs);
    protocol.code_sha256=hash(readFileSync(script));protocol.input_sha256=hash(readFileSync(`${dir}/inputs.jsonl`));protocol.reference_sha256=hash(readFileSync(`${dir}/references.jsonl`));save('protocol.json',protocol);
    const digest=hash(readFileSync(`${dir}/protocol.json`));mkdirSync(`${dir}/confirmation`);
    for(const input of inputs)for(const arm of protocol.arms){
      const schema={...protocol.schema,properties:{...protocol.schema.properties,citations:{type:'array',items:{type:'string',enum:['base','ours','theirs']}}}};
      const request={model:protocol.model,messages:messages(input,arm),temperature:protocol.temperature,seed:protocol.seed,max_tokens:protocol.max_tokens,json_schema:schema};
      const parsed=input.id==='3'?null:{decision:input.id==='2'?'halt':'resolve',resolution:input.id==='2'?'':input.id==='0'?'left\n':'wrong\n',citations:[]};
      save(`confirmation/${input.id}-${arm}.json`,{id:input.id,arm,protocol_sha256:digest,request,request_sha256:hash(JSON.stringify(request)),response:{choices:[{finish_reason:'stop',message:{content:parsed?JSON.stringify(parsed):'invalid JSON'}}],usage:{total_tokens:10}},parsed,error:parsed?null:'invalid-output',duration_ms:1});
    }
    const aggregate=()=>execFileSync(process.execPath,[script,'aggregate',dir,'confirmation'],{stdio:'pipe'});
    aggregate();let result=JSON.parse(readFileSync(`${dir}/confirmation-aggregate.json`));
    assert.equal(result.valid,true);assert.equal(result.MEASURABLE,'NO');
    assert.deepEqual(['matched','nonmatched','halt','invalid','scheduled'].map(k=>result.metrics.selected[k]),[1,1,1,1,4]);
    const p=`${dir}/confirmation/3-selected.json`,r=JSON.parse(readFileSync(p));r.response=null;r.error='transport timeout';writeFileSync(p,JSON.stringify(r));
    aggregate();result=JSON.parse(readFileSync(`${dir}/confirmation-aggregate.json`));assert.equal(result.valid,false);assert.equal(result.phase3_complete,false);
    r.request_sha256='tampered';writeFileSync(p,JSON.stringify(r));assert.throws(aggregate);
    rmSync(p);assert.throws(aggregate);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
