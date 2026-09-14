import assert from 'node:assert/strict';
import http from 'node:http';
import {postJSON} from './http.mjs';
const server=http.createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);
 const r=JSON.parse(Buffer.concat(chunks));
 if(r.abort){res.destroy();return;}
 setTimeout(()=>{res.writeHead(r.status??200,{'Content-Type':'application/json'});res.end(JSON.stringify(r));},r.delay??0);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
try{
 const payload={text:'æ🙂',delay:100};const r=await postJSON(url,payload,1000);assert.deepEqual(JSON.parse(r.body),payload);assert.equal(r.status,200);
 assert.equal((await postJSON(url,{status:503},1000)).status,503);
 await assert.rejects(postJSON(url,{delay:100},20),{name:'TimeoutError'});
 await assert.rejects(postJSON(url,{abort:true},1000));
 console.log('PASS: delayed headers, exact UTF-8 body, HTTP errors, hard deadline, broken connection');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
