import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {freezeRecovery,recoveryWorker,recoverySummary} from './recovery-screen.mjs';
const d=mkdtempSync(join(tmpdir(),'mrgr-recovery-control-'));
try{
 const input=JSON.parse(readFileSync(new URL('screen-inventory.json',import.meta.url)));input.cases=input.cases.filter(c=>c.recheck_candidate).slice(0,3);
 // Keep authentic historical provenance, deliberately unavailable retained trees.
 // This checks the failure ledger without running the oracle or modifying inputs.
 for(const c of input.cases)for(const i of c.recoverable_input_attempts)input.attempts[i].directory=join(d,'unavailable',String(i));
 const inventory=join(d,'inventory.json');writeFileSync(inventory,JSON.stringify(input));const out=join(d,'recovery');assert.equal(freezeRecovery(inventory,out).scheduled,3);
 const frame=JSON.parse(readFileSync(join(out,'frame.json')));assert(frame.rows.every(r=>r.era.era==='GOPATH'&&r.era.recorded_at));assert.equal(recoverySummary(out).complete,false);
 recoveryWorker(out,0,1);const result=recoverySummary(out);assert.equal(result.complete,true);assert.equal(result.counts['GOPATH/excluded'],3);
 const before=readFileSync(join(out,frame.rows[0].id,'receipt.json'));recoveryWorker(out,0,1);assert.deepEqual(readFileSync(join(out,frame.rows[0].id,'receipt.json')),before,'completed case must not rerun');
 console.log('Recovery controls passed: era recorded before missing-tree exclusions, all scheduled cases accounted, no completed-case retries. No API or oracle calls.');
}finally{rmSync(d,{recursive:true,force:true});}
