import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,cpSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {git,hash,treeHash,evaluate,verifyGitCase,environmentHash,safePath} from '../v3-data.mjs';
import {eraStratum,packageCwd,mutations} from '../v3-screen-go.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const sources=()=>Object.fromEntries(['recovery-screen.mjs','../v3-screen-go.mjs','../v3-data.mjs','../../../.do-not-commit/h0-v3-tools/go.so'].map(p=>[resolve(import.meta.dirname,p),hash(readFileSync(resolve(import.meta.dirname,p)))]));
export function freezeRecovery(inventory,directory){
 assert(!existsSync(directory));mkdirSync(directory,{recursive:true});const data=read(inventory),rows=[];
 for(const c of data.cases.filter(c=>c.work_label_build_failure_attempts.length)){
  const index=c.recoverable_input_attempts[0]??c.work_label_build_failure_attempts[0],a=data.attempts[index];
  const row={id:hash(`${c.repo}:${c.event}:${c.path}`),repo:c.repo,event:c.event,path:c.path,attempt_indices:c.attempt_indices,selected_attempt:index,input:a,status:c.ever_screen_passed?'existing-screen-pass':!c.recoverable_input_attempts.length?'retained-input-unavailable':'scheduled'};
  try{const old=read(a.screening).find(r=>r.event===c.event&&r.path===c.path);assert(old);row.original_receipt={git_validation:old.git_validation};row.input_screening_sha256=hash(readFileSync(a.screening));row.era=eraStratum(old.git_validation?.parents.directory??read(join(dirname(a.screening),'freeze.json')).config.repository,c.event,c.path);if(row.era.era!=='GOPATH')row.status='not-legacy-build-mode';}
  catch(e){row.era={availability:'unavailable',era:null,recorded_at:new Date().toISOString(),reason:e.message};row.status='era-unavailable';}
  rows.push(row);save(join(directory,'frame.json'),{complete:false,rows});
 }
 const frame={complete:true,rows};save(join(directory,'frame.json'),frame);
 save(join(directory,'freeze.json'),{at:new Date().toISOString(),source_hashes:sources(),inventory:{path:resolve(inventory),sha256:hash(readFileSync(inventory))},frame_sha256:hash(readFileSync(join(directory,'frame.json'))),environment_sha256:environmentHash(),ordering:'deduplicated inventory repository/event/path order; first retained legacy attempt; no yield-based reordering',admission:'initial reference screen, two compiling rejected mutations, three reference passes under frozen completion counts',api_requests:0});
 return{directory,frame:rows.length,scheduled:rows.filter(r=>r.status==='scheduled').length};
}
export function recoveryWorker(directory,index,total){
 assert(Number.isInteger(index)&&index>=0&&index<total);const frozen=read(join(directory,'freeze.json'));
 assert.equal(hash(readFileSync(join(directory,'frame.json'))),frozen.frame_sha256);assert.equal(environmentHash(),frozen.environment_sha256);
 for(const [p,s]of Object.entries(frozen.source_hashes))assert.equal(hash(readFileSync(p)),s);
 const frame=read(join(directory,'frame.json')).rows.filter(r=>r.status==='scheduled');
 for(const [i,row]of frame.entries())if(i%total===index){
  const d=join(directory,row.id),p=join(d,'receipt.json');if(existsSync(p)){const prior=read(p);if(prior.status==='started')save(p,{...prior,status:'interrupted-evaluation',finished_at:new Date().toISOString()});continue;}
  mkdirSync(d,{recursive:true});const receipt={id:row.id,repo:row.repo,event:row.event,path:row.path,era:row.era,status:'started',started_at:new Date().toISOString()};save(p,receipt);
  try{
   assert.equal(hash(readFileSync(row.input.screening)),row.input_screening_sha256,'historical screen changed');
   const old=row.original_receipt,scaffold=resolve(row.input.directory,'scaffold'),originalOracle=resolve(row.input.directory,'oracle'),oracle=join(d,'oracle');
   const target=safePath(row.path),original=readFileSync(join(scaffold,target)),shipped=git(old.git_validation.parents.directory,'show',`${row.event}:${target}`);assert.equal(hash(shipped),old.git_validation.shipped_sha256);
   const range=old.git_validation.localized.resolutionRange,lines=shipped.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[],reference=lines.slice(range.startLine-1,range.endLineExclusive-1).join('');assert.equal(hash(reference),old.git_validation.reference_sha256);
   const start=original.indexOf('<<<<<<< ours\n'),end=original.indexOf('>>>>>>> theirs\n',start)+15;assert(start>=0&&end>start);
   assert(Buffer.concat([original.subarray(0,start),Buffer.from(reference),original.subarray(end)]).equals(shipped),'restored reference must equal historical file');
   const parts=original.subarray(start,end).toString().match(/^<<<<<<< ours\n([\s\S]*?)\|\|\|\|\|\|\| base\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs\n$/);assert(parts);
   cpSync(originalOracle,oracle,{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true});
   for(const name of ['build.sh','test.sh']){const path=join(oracle,name),text=readFileSync(path,'utf8'),importPath=text.match(/^ln -s \/work \/tmp\/gopath\/src\/(.+)$/m)?.[1];assert(importPath);assert.equal(text.split(packageCwd(target)).length,2,'expected original unused mapping');writeFileSync(path,text.replace(packageCwd(target),packageCwd(target,importPath)));receipt.canonical_import_path=importPath;}
   const c={id:row.id,repo:row.repo,event:row.event,group_id:`${row.repo}:${row.event}`,language:'Go',path:target,ours:parts[1],base:parts[2],theirs:parts[3],reference,git:old.git_validation.parents,era:row.era,evaluator:{scaffold,oracle,target,start_byte:start,end_byte:end,preimage_sha256:hash(original),scaffold_sha256:treeHash(scaffold),oracle_sha256:treeHash(oracle),environment_sha256:frozen.environment_sha256,build:['/bin/sh','/oracle/build.sh'],test:['/bin/sh','/oracle/test.sh'],test_completion:[{pattern:'^PASS$',count:1}]},mutations:[]};
   receipt.git_validation=verifyGitCase(c);receipt.evaluator=c.evaluator;save(p,receipt);
   receipt.reference_screen=evaluate(c,reference);save(p,receipt);assert(receipt.reference_screen.pass,'reference screen failed');
   const count=(receipt.reference_screen.stages[1].stdout.match(/^--- PASS: Test/gm)??[]).length;assert(count>0);c.evaluator.test_completion.push({pattern:'^--- PASS: Test',count});
   const candidates=mutations(shipped.toString(),start,start+Buffer.byteLength(reference),'.do-not-commit/h0-v3-tools/go.so');receipt.mutation_screens=[];const rejected=[];
   for(const mutant of candidates){const ev=evaluate(c,mutant.resolution);receipt.mutation_screens.push({name:mutant.name,resolution_sha256:hash(mutant.resolution),...ev});if(ev.category==='test-failure'){c.mutations.push(mutant);rejected.push({name:mutant.name,...ev});}save(p,receipt);if(c.mutations.length===2)break;}
   assert.equal(c.mutations.length,2,'fewer than two compiling rejected mutants');receipt.references=[];
   for(let repeat=0;repeat<3;repeat++){receipt.references.push(evaluate(c,reference));save(p,receipt);}
   assert(receipt.references.every(r=>r.pass),'reference not stable over three admission runs');
   c.oracle_validation={valid:true,reference:receipt.references,mutations:rejected};save(join(d,'case.json'),c);receipt.status='admitted-oracle-only';
  }catch(e){receipt.status='excluded';receipt.reason=e.message;}
  receipt.finished_at=new Date().toISOString();save(p,receipt);console.log(JSON.stringify({worker:index,id:row.id,repo:row.repo,status:receipt.status,category:receipt.reference_screen?.category,reason:receipt.reason}));
 }
 return{worker:index,finished:true};
}
export function recoverySummary(directory){
 const frame=read(join(directory,'frame.json')).rows,rows=frame.map(r=>{const p=join(directory,r.id,'receipt.json');return{...r,original_receipt:undefined,result:existsSync(p)?read(p):null};}),pending=rows.filter(r=>r.status==='scheduled'&&(!r.result||r.result.status==='started'));
 const counts={};for(const r of rows){const key=`${r.era.era??'unavailable'}/${r.result?.status??r.status}`;counts[key]=(counts[key]??0)+1;}
 const result={at:new Date().toISOString(),complete:pending.length===0,frame:rows.length,scheduled:rows.filter(r=>r.status==='scheduled').length,pending:pending.length,counts,rows,api_requests:0,limits:'Retained historical failure recovery; oracle admission is not independent-confirmation eligibility. No recovered case changes the frozen 60-case development cohort.'};save(join(directory,'summary.json'),result);return{...result,rows:undefined};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [command,...args]=process.argv.slice(2);try{console.log(JSON.stringify(command==='freeze'?freezeRecovery(...args):command==='worker'?recoveryWorker(args[0],Number(args[1]),Number(args[2])):recoverySummary(args[0])));}catch(e){console.error(e);process.exitCode=1;}}
