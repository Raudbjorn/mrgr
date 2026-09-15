// Adapter to the existing evaluator. Archived inputs are never modified.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {hash,environmentHash,validateOracle,evaluate,verifyGitCase} from '../../evidence/h0/v3-data.mjs';
import {verifyEvaluation} from '../../evidence/h0/v3-method-repair-2026-09-07/evaluation-receipt.mjs';
import {candidates} from '../../evidence/h0/v3-candidate-repair-2026-09-07/candidate-arms.mjs';
const [command,sourceArg,outArg,indexArg]=process.argv.slice(2);
const source=resolve(sourceArg),out=resolve(outArg),cases=JSON.parse(readFileSync(source));
const save=(file,value)=>{writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n');renameSync(file+'.tmp',file);};
mkdirSync(out,{recursive:true});
if(command==='audit'){
 const protocol=JSON.parse(readFileSync(join(dirname(source),'protocol.json')));
 assert.equal(hash(readFileSync(source)),protocol.cases_sha256,'case archive hash mismatch');
 const rows=[];
 for(const c of cases){
  const record={id:c.id,repo:c.repo,lineage:c.cluster_id,event:c.event,path:c.path,cell:c.cell,source_sha256:hash(JSON.stringify(c))};
  try{
   assert(c.oracle_validation.valid);assert.equal(c.oracle_validation.reference.length,3);
   for(const ev of c.oracle_validation.reference){verifyEvaluation(c,c.reference,ev);assert(ev.pass);}
   assert(c.mutations.length>=2);
   for(const [i,m] of c.mutations.entries()){const ev=c.oracle_validation.mutations[i];verifyEvaluation(c,m.resolution,ev);assert.equal(ev.category,'test-failure');}
   record.candidates=candidates(c,'candidates-structural').map(item=>{
    const baseline=Object.values(c.baselines).find(b=>b.resolution===item.text);
    verifyEvaluation(c,item.text,baseline.evaluation);
    assert(!['environment-error'].includes(baseline.evaluation.category));
    return {id:'cand-'+hash(item.text),text:item.text,archived_pass:baseline.evaluation.pass};
   });
   record.status='archived-verified';
  }catch(e){record.status='unverifiable';record.reason=String(e);}
  rows.push(record);
 }
 save(join(out,'archive-audit.json'),{source,sha256:hash(readFileSync(source)),rows});
}else if(command==='prepare'){
 const index=Number(indexArg);assert(Number.isInteger(index)&&index>=0&&index<cases.length);
 const c=structuredClone(cases[index]),file=join(out,c.id+'.json');
 assert(!existsSync(file),'refuse existing oracle receipt');
 const originalEnvironment=c.evaluator.environment_sha256;
 c.evaluator.environment_sha256=environmentHash();
 const receipt={id:c.id,source_sha256:hash(JSON.stringify(cases[index])),source_archive_sha256:hash(readFileSync(source)),original_environment:originalEnvironment,environment:c.evaluator.environment_sha256,status:'started'};
 save(file,receipt);
 try{
  receipt.git=verifyGitCase(c);
  receipt.oracle=validateOracle(c);save(file,receipt);assert(receipt.oracle.valid,'oracle no longer discriminates');
  receipt.candidates=[];
  for(const candidate of candidates(c,'candidates-structural')){
   const ev=evaluate(c,candidate.text);verifyEvaluation(c,candidate.text,ev);
   receipt.candidates.push({id:'cand-'+hash(candidate.text),text:candidate.text,evaluation:ev});save(file,receipt);
   assert(ev.category!=='environment-error','candidate infrastructure failure');
  }
  receipt.status='admitted';
 }catch(e){receipt.status='excluded';receipt.reason=String(e);}
 receipt.finished_at=new Date().toISOString();save(file,receipt);
}else throw Error('expected audit or prepare');
