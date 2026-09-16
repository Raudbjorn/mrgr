// One predeclared control substitution. Original case and receipts stay immutable.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {evaluate,environmentHash,hash,treeHash} from '../../evidence/h0/v3-data.mjs';
import {verifyEvaluation} from '../../evidence/h0/v3-method-repair-2026-09-07/evaluation-receipt.mjs';
const root=resolve(import.meta.dirname,'../..');
export const CASE='1ef47c17386e0c6585ca4c3bd2c8ea58d4a63c18cdfedd13ffbf9d2e6f21dc6f';
export const REPLACEMENT='\tstart, end, step := 0, MaxInt, 2\n';
const source=join(root,'evidence/h0/v3-candidate-repair-2026-09-07/run/cases.json');
const prior='/mnt/mrgr/ornith-lora/runs/9b-selector-2026-09-14-r2/oracle/'+CASE+'.json';
const amendment=join(root,'docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-control-repair-2026-09-16.md');
const read=p=>JSON.parse(readFileSync(p));
const save=(p,v)=>{writeFileSync(p+'.tmp',JSON.stringify(v,null,2)+'\n');renameSync(p+'.tmp',p);};
export function rejected(ev){
  const [build,test]=ev.stages??[],clean=s=>s&&s.status===0&&!s.error&&!s.signal;
  return Boolean(ev.category==='test-failure'&&!ev.reason&&build?.stage==='build'&&test?.stage==='test'&&clean(build)&&Number.isInteger(test.status)&&test.status!==0&&!test.error&&!test.signal&&/^--- FAIL: Test/m.test(test.stdout??'')&&!/panic:|fatal error:|^bwrap:/m.test((test.stdout??'')+'\n'+(test.stderr??'')));
}
export function requireEnvironment(expected,actual){assert.equal(actual,expected,'environment fingerprint drift; no controls authorized');}
export function freeze(out){
  assert(!existsSync(out),'new amendment directory required');
  const c=read(source).find(c=>c.id===CASE),old=read(prior);assert(c&&old.status==='admitted');
  assert.equal(c.reference,'\tstart, end, step := 0, MaxInt, 1\n');
  assert.equal(c.mutations[0].resolution,'\tstart, end, step := 1, MaxInt, 1\n');
  assert.equal(c.mutations[1].resolution,'\tstart, end, step := 0, MaxInt, 0\n');
  const paths=[source,prior,amendment,import.meta.filename,join(root,'evidence/h0/v3-data.mjs'),join(root,'evidence/h0/v3-method-repair-2026-09-07/evaluation-receipt.mjs'),join(root,'packages/core/dist/evaluation/localize.js')];
  mkdirSync(out,{recursive:true});
  save(join(out,'freeze.json'),{version:'ornith-control-repair/1',case:CASE,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),inputs:Object.fromEntries(paths.map(p=>[p,hash(readFileSync(p))])),expected_environment:old.environment,scaffold_sha256:treeHash(c.evaluator.scaffold),oracle_sha256:treeHash(c.evaluator.oracle),replacement:REPLACEMENT,replacement_sha256:hash(REPLACEMENT),cycles:3,stage_timeout_ms:120000,revalidation_seconds:3600,experiment_seconds:86400,cleanup_seconds:300,created_at:new Date().toISOString()});
}
export function run(out){
  const frozen=read(join(out,'freeze.json'));assert(!existsSync(join(out,'execution.json')),'no retries or resumed control attempt');
  const started=Date.now(),execution={started,deadline:started+86400000,status:'running',freeze_sha256:hash(readFileSync(join(out,'freeze.json')))};
  save(join(out,'execution.json'),execution);
  const result={version:'ornith-control-repair-result/1',case:CASE,finding:'INCOMPLETE',evaluations:[],candidate_checks:[],training_runs:0,model_requests:0};
  try{
    for(const [p,sha]of Object.entries(frozen.inputs))assert.equal(hash(readFileSync(p)),sha,'frozen input drift: '+p);
    assert.equal(frozen.replacement,REPLACEMENT);assert.equal(frozen.replacement_sha256,hash(REPLACEMENT));
    const c=read(source).find(c=>c.id===CASE),old=read(prior);
    const actual=environmentHash();result.environment={expected:frozen.expected_environment,actual};save(join(out,'result.json'),result);
    requireEnvironment(frozen.expected_environment,actual);
    assert.equal(treeHash(c.evaluator.scaffold),frozen.scaffold_sha256);assert.equal(treeHash(c.evaluator.oracle),frozen.oracle_sha256);
    c.evaluator.environment_sha256=actual;c.evaluator.timeout_ms=frozen.stage_timeout_ms;
    const one=(name,text)=>{
      assert(Date.now()-started+2*frozen.stage_timeout_ms<=3600000,'revalidation deadline');
      const ev=evaluate(c,text);verifyEvaluation(c,text,ev);
      result.evaluations.push({name,resolution_sha256:hash(text),...ev});save(join(out,'result.json'),result);return ev;
    };
    for(let cycle=0;cycle<3;cycle++){
      assert(one(`reference-${cycle}`,c.reference).pass,'reference control failed');
      assert(rejected(one(`start-one-${cycle}`,c.mutations[0].resolution)),'retained mutant lacks ordinary assertion rejection');
      assert(rejected(one(`step-two-${cycle}`,REPLACEMENT)),'replacement mutant lacks ordinary assertion rejection');
    }
    for(const candidate of old.candidates){
      const ev=one('candidate-'+candidate.id,candidate.text);
      assert(!['environment-error'].includes(ev.category)&&!['test-timeout','test-completion-contract'].includes(ev.reason),'candidate incomplete');
      assert.equal(ev.pass,candidate.evaluation.pass,'candidate label changed');
      result.candidate_checks.push({id:candidate.id,pass:ev.pass});
    }
    result.finding='CONTROL REVALIDATION PASSED';result.original_receipt_sha256=hash(readFileSync(prior));
  }catch(error){result.error=String(error);execution.status='INCOMPLETE';}
  finally{
    result.finished_at=new Date().toISOString();result.terminal=result.finding==='INCOMPLETE';save(join(out,'result.json'),result);
    execution.status=result.terminal?'INCOMPLETE':'controls-complete';execution.elapsed_seconds=(Date.now()-started)/1000;save(join(out,'execution.json'),execution);
  }
  console.log(JSON.stringify({finding:result.finding,evaluations:result.evaluations.length,error:result.error}));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [mode,path]=process.argv.slice(2);assert(['freeze','run'].includes(mode));(mode==='freeze'?freeze:run)(resolve(path));}
