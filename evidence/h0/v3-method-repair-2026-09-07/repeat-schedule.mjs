import assert from 'node:assert/strict';
import {ARMS,MODELS,checkGroups} from '../v3.mjs';
import {hash} from '../v3-data.mjs';
export function repeatSchedule(cases,protocolHash,requestHashes){
 assert(/^[a-f0-9]{64}$/.test(protocolHash),'requires frozen protocol digest');assert.equal(cases.length,60);checkGroups(cases);
 assert(cases.every(c=>typeof c.cluster_id==='string'&&c.cluster_id),'missing cluster');
 const cells=Object.keys(MODELS).flatMap(model=>ARMS.map(arm=>({model,arm}))),rows=[];
 assert.equal(Object.keys(requestHashes).length,cases.length*cells.length,'one frozen request per case/model/arm');
 for(let repeat=1;repeat<=3;repeat++){
  const ordered=[...cases].sort((a,b)=>hash(`${protocolHash}:${repeat}:${a.id}`).localeCompare(hash(`${protocolHash}:${repeat}:${b.id}`)));
  for(const [i,c] of ordered.entries())for(let j=0;j<cells.length;j++){
   const {model,arm}=cells[(i+repeat-1+j)%cells.length],key=`${c.id}/${model}/${arm}`,request_sha256=requestHashes[key];assert(/^[a-f0-9]{64}$/.test(request_sha256),'missing request body digest');
   rows.push({request_id:hash(`${protocolHash}:${repeat}:${key}`),case_id:c.id,cluster_id:c.cluster_id,model,arm,repeat,request_sha256});
  }
 }
 return{version:'h0-three-repeat-schedule/1',protocol_sha256:protocolHash,independent_cases:cases.length,independent_clusters:new Set(cases.map(c=>c.cluster_id)).size,scheduled_requests:rows.length,primary_repeat:1,repetitions:3,rows};
}
