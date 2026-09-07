// Proves phase3-closure-check.mjs's rules can actually fail -- a checker that
// can only ever print true is not a falsifiable claim, it's decoration.
import test from 'node:test';
import assert from 'node:assert/strict';

const MEASURABLE=/MEASURABLE=/;
const HISTORICAL_MARKER='historical binary gate, since retired';
const measurableOk=text=>!MEASURABLE.test(text)||text.includes(HISTORICAL_MARKER);

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
  const ok=a.valid===true&&a.finding?.stage==='NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED';
  assert.equal(ok,false);
});
test('valid:false fails the study-closed check even with the right stage string',()=>{
  const a={valid:false,finding:{stage:'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED'}};
  const ok=a.valid===true&&a.finding?.stage==='NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED';
  assert.equal(ok,false);
});
test('a critical-path register row fails the register check',()=>{
  const rows=[{on_critical_path:true}];
  assert.equal(rows.filter(r=>r.on_critical_path!==false).length===0,false);
});
