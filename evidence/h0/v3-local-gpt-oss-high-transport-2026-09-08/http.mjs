import http from 'node:http';
export function postJSON(url,body,timeoutMs){
 const data=JSON.stringify(body),signal=AbortSignal.timeout(timeoutMs);
 return new Promise((resolve,reject)=>{
  const req=http.request(url,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)},signal},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);
   res.on('aborted',()=>reject(new Error('response-aborted')));
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
  });
  req.on('error',e=>reject(signal.aborted?signal.reason:e));req.end(data);
 });
}
