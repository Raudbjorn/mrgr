// Synthetic instrument calibration; no empirical utility credit.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {evaluate as original} from '../v3-development-2026-09-06e/instrument/evidence/h0/v3-data.mjs';
import {evaluate as repaired,hash,treeHash} from '../../../.do-not-commit/h0-selector-repair/v3-data-revised.mjs';
const d=mkdtempSync(join(tmpdir(),'mrgr-timeout-regression-'));
try {
  const scaffold=join(d,'scaffold'),oracle=join(d,'oracle');mkdirSync(scaffold);mkdirSync(oracle);
  writeFileSync(join(scaffold,'target'),'good');
  const evaluator={scaffold,oracle,target:'target',scaffold_sha256:treeHash(scaffold),oracle_sha256:treeHash(oracle),preimage_sha256:hash('good'),start_byte:0,end_byte:4,timeout_ms:500,build:['/bin/true'],test:['/bin/sh','-c','if [ "$(cat target)" = good ]; then echo PASS; else exec sleep 5; fi'],test_completion:[{pattern:'^PASS$',count:1}]};
  const good=repaired({evaluator},'good'),before=original({evaluator},'bad'),after=repaired({evaluator},'bad');
  assert(good.pass);assert.equal(before.category,'environment-error');assert.equal(after.category,'test-failure');assert.equal(after.reason,'test-timeout');assert(!before.pass&&!after.pass);assert.match(after.stages[1].error,/ETIMEDOUT/);
  const buildTimeout=repaired({evaluator:{...evaluator,build:['/bin/sleep','5']}},'good');assert.equal(buildTimeout.category,'environment-error');
  console.log(JSON.stringify({pass:true,good,before,after,buildTimeout,empirical_utility_credit:false}));
} finally {rmSync(d,{recursive:true,force:true});}
