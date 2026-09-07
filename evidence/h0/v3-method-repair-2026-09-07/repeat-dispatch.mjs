import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {hash} from '../v3-data.mjs';
import {MODELS,decode} from '../v3.mjs';
import {repeatSchedule} from './repeat-schedule.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,x)=>{writeFileSync(`${p}.tmp`,JSON.stringify(x,null,2)+'\n',{mode:0o600});renameSync(`${p}.tmp`,p);};
export function loadRepeated(directory){
 const bytes=readFileSync(join(directory,'protocol.json')),protocol=JSON.parse(bytes),digest=hash(bytes);
 assert.equal(protocol.version,'h0-repaired-development/1');assert.equal(protocol.mode,'development');
 const cases=read(join(directory,'cases.json')),requests=read(join(directory,'requests.json')),schedule=read(join(directory,'schedule.json'));
 assert.equal(hash(readFileSync(join(directory,'cases.json'))),protocol.cases_sha256);
 assert.equal(hash(readFileSync(join(directory,'requests.json'))),protocol.requests_sha256);
 assert(Object.keys(protocol.source_hashes).length>0,'missing frozen source hashes');
 for(const [p,sha] of Object.entries(protocol.source_hashes))assert.equal(hash(readFileSync(resolve(p))),sha,`source drift: ${p}`);
 const requestHashes=Object.fromEntries(Object.entries(requests).map(([k,v])=>[k,hash(JSON.stringify(v))]));
 assert.deepEqual(schedule,repeatSchedule(cases,digest,requestHashes),'schedule differs from frozen order');
 assert.deepEqual(Object.keys(protocol.models).sort(),Object.keys(MODELS).sort());
 for(const [name,p] of Object.entries(protocol.models)){
  assert.equal(p.model,MODELS[name].model);assert.equal(p.endpoint,MODELS[name].endpoint);
  assert.equal(p.helper,MODELS[name].helper);assert.equal(p.env,MODELS[name].env);
  for(const row of schedule.rows.filter(r=>r.model===name)){const req=requests[`${row.case_id}/${name}/${row.arm}`];assert.equal(req.model,p.model);for(const [k,v] of Object.entries(p.settings))assert.deepEqual(req[k],v,'request settings differ from frozen provider');}
 }
 return{protocol,digest,cases,requests,schedule};
}
export async function dispatchRepeated(directory,name,{fetcher=fetch,key}={}){
 const {protocol,digest,cases,requests,schedule}=loadRepeated(directory);assert(Object.hasOwn(MODELS,name));
 const provider=protocol.models[name],out=join(directory,'responses',name);mkdirSync(out,{recursive:true});
 const lock=join(out,'.dispatcher-lock');writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});
 try{
  const stop=join(out,'rate-limit-stop.json');if(existsSync(stop))return{model:name,stopped:'429',pending:true};
  if(!key){try{key=process.env[provider.env]??execFileSync(provider.helper,[],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{throw new Error(`${name}: credential helper failed`);}}assert(key,'credential unavailable');
  const byId=new Map(cases.map(c=>[c.id,c]));
  for(const row of schedule.rows.filter(r=>r.model===name)){
   const request=requests[`${row.case_id}/${name}/${row.arm}`],p=join(out,`${row.request_id}.json`),attempt=`${p}.started`;
   if(existsSync(p)){const r=read(p);assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,row);assert.deepEqual(r.request,request);if(r.http_status===429){save(stop,{request_id:row.request_id,protocol_sha256:digest});return{model:name,stopped:'429',pending:true};}continue;}
   const at=new Date().toISOString(),start=Date.now();let response=null,raw_body=null,http_status=null,error=null;
   if(existsSync(attempt)){
    const prior=read(attempt);assert.equal(prior.protocol_sha256,digest);assert.equal(prior.request_sha256,row.request_sha256);
    error='interrupted-attempt-unknown-response';
   }else{
    writeFileSync(attempt,JSON.stringify({protocol_sha256:digest,request_sha256:row.request_sha256,at}),{flag:'wx',mode:0o600});
    try{const r=await fetcher(provider.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(request),signal:AbortSignal.timeout(protocol.timeout_ms)});http_status=r.status;raw_body=await r.text();try{response=JSON.parse(raw_body);}catch{error='non-json-response';}}
    catch(e){error=e.name==='TimeoutError'?'timeout':'transport-error';}
    if(http_status!==200)error??=`http-${http_status}`;
   }
   const decoded=error?{kind:'transport-error',parsed:null}:decode(response,byId.get(row.case_id),row.arm);
   save(p,{protocol_sha256:digest,scheduled:row,request,request_sha256:row.request_sha256,started_at:existsSync(attempt)?read(attempt).at:at,finished_at:new Date().toISOString(),duration_ms:Date.now()-start,http_status,raw_body,response,error,...decoded});rmSync(attempt);
   if(http_status===429){save(stop,{request_id:row.request_id,protocol_sha256:digest});return{model:name,stopped:'429',pending:true};}
  }
  return{model:name,stopped:'matrix-complete'};
 }finally{rmSync(lock);}
}
