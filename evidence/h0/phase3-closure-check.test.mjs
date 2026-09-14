// Proves phase3-closure-check.mjs's rules can actually fail -- a checker that
// can only ever print true is not a falsifiable claim, it's decoration.
import test from 'node:test';
import assert from 'node:assert/strict';

import {measurableOk,studyIsClosed,registerIsOffCriticalPath,checkClosure} from './phase3-closure-check.mjs';

test('an unannotated live MEASURABLE= fails the check',()=>{
  assert.equal(measurableOk('the result was MEASURABLE=NO this run'),false);
});
test('an annotated historical MEASURABLE= passes',()=>{
  assert.equal(measurableOk('MEASURABLE=NO below names the historical binary gate, since retired.'),true);
});
test('no occurrence at all passes',()=>{
  assert.equal(measurableOk('the study reports a finding record, not a verdict bit'),true);
});
test('a stage mismatch fails the study-closed check',()=>{
  const a={valid:true,finding:{stage:'IN_DEVELOPMENT'}};
  const ok=studyIsClosed(a,'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED');
  assert.equal(ok,false);
});
test('valid:false fails the study-closed check even with the right stage string',()=>{
  const a={valid:false,finding:{stage:'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED'}};
  const ok=studyIsClosed(a,'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED');
  assert.equal(ok,false);
});
test('a critical-path register row fails the register check',()=>{
  const rows=[{on_critical_path:true}];
  assert.equal(registerIsOffCriticalPath(rows),false);
});

test('historical annotation cannot bless a separate live occurrence',()=>{
  assert.equal(measurableOk('MEASURABLE=NO: historical binary gate, since retired\nNew result: MEASURABLE=YES'),false);
});
test('the actual closure check passes current artifacts',()=>{
  const result=checkClosure();assert.equal(result.closed,true,JSON.stringify(result.checks));
});
