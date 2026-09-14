import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import os from 'node:os';
import {recoverRequest,waitReady,retryAccounting} from './recovery.mjs';import {hash} from '../v3-data.mjs';
const root=fs.mkdtempSync(os.tmpdir()+'/mrgr-recovery-');let calls=0,mode='reset',port;const bodies=[];
const server=http.createServer(async(req,res)=>{
 if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/health'?{status:'ok'}:req.url==='/props'?{model:'fixed'}:[{is_processing:false}]));return;}
 const chunks=[];for await(const c of req)chunks.push(c);bodies.push(Buffer.concat(chunks).toString());calls++;
 if(mode==='reset'&&calls===1){req.socket.destroy();server.close();setTimeout(()=>server.listen(port,'127.0.0.1'),100);return;}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({kind:mode==='truncated'?'truncated':'resolve'}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;const base=`http://127.0.0.1:${port}`;
const ready=()=>waitReady({base,verify:p=>assert.equal(p.model,'fixed'),heartbeat:()=>{},limitMs:3000,pollMs:20});
function options(id){const request={messages:[{role:'user',content:'unchanged'}],seed:42};return{d:root,s:{request_id:id,case_id:'case',arm:'hunk-only',repeat:1},p:{endpoint:base,timeout_ms:1000},digest:'frozen',request,decode:b=>({kind:b.kind,parsed:{resolution:'code'}}),ready,heartbeat:()=>{}};}
try{
 const o=options('reset');const r=await recoverRequest(o);assert.equal(r.kind,'resolve');assert.equal(calls,2);assert.equal(bodies[0],bodies[1]);
 const bytes=fs.readFileSync(root+'/responses/reset.json');await recoverRequest(o);assert.equal(calls,2);assert.deepEqual(fs.readFileSync(root+'/responses/reset.json'),bytes);assert.equal(retryAccounting(root).failed_exchanges,1);
 mode='truncated';await recoverRequest(options('truncated'));assert.equal(calls,3);await recoverRequest(options('truncated'));assert.equal(calls,3);
 await assert.rejects(waitReady({base,verify:()=>assert.fail('configuration drift'),heartbeat:()=>{},limitMs:1000,pollMs:10}),/configuration drift/);
 mode='success';const x=options('interrupted');fs.writeFileSync(root+'/responses/interrupted.json.started',JSON.stringify({protocol_sha256:x.digest,scheduled:x.s,at:'2026-01-01T00:00:00.000Z'}));await recoverRequest(x);assert.equal(retryAccounting(root).unknown_durations,1);
 // Exhausted historical network exchanges must not generate a fourth answer.
 const exhausted=options('exhausted');fs.mkdirSync(root+'/attempts/exhausted',{recursive:true});for(let i=0;i<3;i++)fs.writeFileSync(root+`/attempts/exhausted/00${i}.json`,JSON.stringify({protocol_sha256:exhausted.digest,scheduled:exhausted.s,request:exhausted.request,request_sha256:hash(JSON.stringify(exhausted.request)),started_at:String(i),error:'transport-error',error_detail:{code:'ECONNRESET'}}));
 const before=calls;await assert.rejects(recoverRequest(exhausted),/exhausted/);assert.equal(calls,before);
 console.log('PASS: server restart recovery, identical retry bytes/seed, preserved completed receipt, no retry for truncation, identity rejection, interrupted checkpoint, bounded retries');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
