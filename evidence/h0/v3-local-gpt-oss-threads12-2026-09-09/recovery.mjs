import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {postJSON} from './http.mjs';
import {read,save} from '../v3-mercury-final-2026-09-07/attempt.mjs';
import {hash} from '../v3-data.mjs';
export const retryable=r=>[502,503,504].includes(r.http_status)||(r.error==='transport-error'&&(['ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT'].includes(r.error_detail?.code)||r.error_detail?.message==='response-aborted'))||r.error==='interrupted-attempt-unknown-response';
export async function waitReady({base,verify,heartbeat,stopped=()=>false,limitMs=1800000,pollMs=5000}){
 const deadline=performance.now()+limitMs;
 while(performance.now()<deadline){
  if(stopped())throw Error('drain requested while waiting for server');
  heartbeat();let health,props,slots;
  try{
   const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error(`readiness HTTP ${r.status}`);return r.json();};
   health=await get('/health');if(health.status!=='ok')throw Error('server loading');
   props=await get('/props');slots=await get('/slots');
  }catch{await sleep(pollMs);continue;}
  // Identity failures are fatal, not availability failures. Never swallow them.
  await verify(props);
  assert(Array.isArray(slots),'invalid slots response');
  if(slots.length===1&&!slots[0].is_processing)return {at:new Date().toISOString(),props,slots};
  await sleep(pollMs);
 }
 throw Error('server recovery deadline exceeded (unavailable or busy)');
}
export async function recoverRequest({d,s,p,digest,request,decode,ready,heartbeat}){
 const file=join(d,'responses',s.request_id+'.json'),started=file+'.started',dir=join(d,'attempts',s.request_id);fs.mkdirSync(dir,{recursive:true});
 const check=r=>{assert.equal(r.protocol_sha256,digest);assert.deepEqual(r.scheduled,s);assert.deepEqual(r.request,request);assert.equal(r.request_sha256,hash(JSON.stringify(request)));};
 const attempts=()=>fs.readdirSync(dir).filter(n=>/^\d{3}\.json$/.test(n)).sort();
 const archive=r=>{const names=attempts();for(const n of names){if(read(join(dir,n)).started_at===r.started_at){assert.deepEqual(read(join(dir,n)),r);return;}}save(join(dir,String(names.length).padStart(3,'0')+'.json'),r);};
 if(fs.existsSync(file)){
  const r=read(file);check(r);if(!r.error)return r;
  archive(r);assert(retryable(r),'non-retryable recorded response');
 }
 // A crash after an exchange receipt but before the canonical write reuses that exchange.
 for(const n of attempts()){
  const r=read(join(dir,n));check(r);
  if(!r.error){save(file,r);fs.rmSync(started,{force:true});return r;}
  assert(retryable(r),'non-retryable archived response');
 }
 if(fs.existsSync(started)){
  const x=read(started);assert.equal(x.protocol_sha256,digest);assert.deepEqual(x.scheduled,s);
  if(!attempts().some(n=>read(join(dir,n)).started_at===x.at))archive({protocol_sha256:digest,scheduled:s,request,request_sha256:hash(JSON.stringify(request)),started_at:x.at,finished_at:new Date().toISOString(),elapsed_ms:null,http_status:null,raw_body:null,response:null,error:'interrupted-attempt-unknown-response',kind:'transport-error',parsed:null});
  fs.rmSync(started);
 }
 while(attempts().length<3){
  const readiness=await ready();const number=attempts().length;save(join(dir,String(number).padStart(3,'0')+'.ready.json'),readiness);
  heartbeat(number);const at=new Date().toISOString(),t=performance.now();save(started,{protocol_sha256:digest,scheduled:s,at,attempt:number});
  let http_status=null,response_headers=null,raw_body=null,response=null,error=null,error_detail=null;
  try{const res=await postJSON(p.endpoint,request,p.timeout_ms);http_status=res.status;response_headers=res.headers;raw_body=res.body;try{response=JSON.parse(raw_body);}catch{error='non-json-response';}if(http_status!==200)error??=`http-${http_status}`;}
  catch(e){error=e.name==='TimeoutError'?'timeout':'transport-error';error_detail={name:e.name,message:e.message,code:e.code??null,cause:e.cause?.code??null};}
  let outcome={kind:'transport-error',parsed:null};if(!error){try{outcome=decode(response);}catch(e){error='decode-error';error_detail={name:e.name,message:e.message};}}
  const r={recovery_amendment_sha256:p.recovery_amendment_sha256??null,elapsed_ms:performance.now()-t,protocol_sha256:digest,scheduled:s,request,request_sha256:hash(JSON.stringify(request)),started_at:at,finished_at:new Date().toISOString(),http_status,response_headers,raw_body,response,error,error_detail,...outcome};
  archive(r);fs.rmSync(started);
  if(!error){save(file,r);return r;}
  if(!retryable(r)){save(file,r);throw Error(`non-retryable inference failure: ${error}`);}
 }
 const last=read(join(dir,attempts().at(-1)));save(file,last);throw Error('server recovery exhausted: three exchanges for this scheduled request');
}
export function retryAccounting(d){
 const root=join(d,'attempts'),rows=[];
 if(fs.existsSync(root))for(const id of fs.readdirSync(root))for(const file of fs.readdirSync(join(root,id)).filter(n=>/^\d{3}\.json$/.test(n))){const r=read(join(root,id,file));if(r.error)rows.push({request_id:id,receipt:join(root,id,file),error:r.error,elapsed_ms:r.elapsed_ms??null,usage:r.response?.usage??null});}
 return {failed_exchanges:rows.length,known_failed_exchange_ms:rows.reduce((n,r)=>n+(r.elapsed_ms??0),0),unknown_durations:rows.filter(r=>r.elapsed_ms===null).length,missing_token_usage:rows.filter(r=>r.usage===null).length,rows};
}
