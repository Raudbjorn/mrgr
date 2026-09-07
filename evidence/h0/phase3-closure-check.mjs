// Falsifiable backing for docs/planning/final/phase-3-h0-evidence-utility/
// phase-3-closure-certificate.md. Reads the actual result files and the
// decision register; asserts nothing that isn't checked here. `closed` is
// the AND of every named check -- one failure flips the whole verdict.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const ROOT=resolve(import.meta.dirname,'../..');
const path=p=>resolve(ROOT,p);
const readJSON=p=>JSON.parse(readFileSync(path(p),'utf8'));
const readText=p=>readFileSync(path(p),'utf8');
const checks={};

function studyClosedNegative(name,file,expectedStage){
  try{
    const a=readJSON(file);
    const ok=a.valid===true&&a.finding?.stage===expectedStage;
    checks[name]={pass:ok,valid:a.valid,stage:a.finding?.stage,expected:expectedStage,file};
  }catch(e){checks[name]={pass:false,error:e.message,file};}
}
studyClosedNegative('repaired_development_study',
  'evidence/h0/v3-repaired-development-2026-09-07/aggregate.json',
  'NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED');
studyClosedNegative('candidate_repair_exploratory_study',
  'evidence/h0/v3-candidate-repair-2026-09-07/run/aggregate-amended.json',
  'NO DEMONSTRATED BENEFIT (EXPLORATORY)');

function registerEmptyOfCriticalPath(){
  try{
    const reg=readJSON('docs/planning/final/phase-3-h0-evidence-utility/decision-register.json');
    const offending=reg.rows.filter(r=>r.on_critical_path!==false);
    checks.decision_register_off_critical_path={pass:offending.length===0,rows:reg.rows.length,offending};
  }catch(e){checks.decision_register_off_critical_path={pass:false,error:e.message};}
}
registerEmptyOfCriticalPath();

// Live artifacts must not carry the retired binary gate. A historical
// occurrence is allowed only if explicitly annotated as such -- rewriting
// a "Preserved" section to remove it would falsify the historical record
// instead of retiring live terminology.
const MEASURABLE=/MEASURABLE=/;
const HISTORICAL_MARKER='historical binary gate, since retired';
function noLiveMeasurable(name,file){
  try{
    const text=readText(file);
    const hasMeasurable=MEASURABLE.test(text);
    const annotated=text.includes(HISTORICAL_MARKER);
    checks[name]={pass:!hasMeasurable||annotated,hasMeasurable,annotated,file};
  }catch(e){checks[name]={pass:false,error:e.message,file};}
}
noLiveMeasurable('v3_source_no_measurable_field','evidence/h0/v3.mjs');
noLiveMeasurable('current_state_no_live_measurable','docs/planning/final/phase-3-h0-evidence-utility/current-state.md');
noLiveMeasurable('redesign_requirements_no_live_measurable','docs/planning/final/phase-3-h0-evidence-utility/redesign-requirements.md');
noLiveMeasurable('work_packages_measurable_is_annotated_historical','docs/planning/final/phase-3-h0-evidence-utility/work-packages.md');
noLiveMeasurable('answer_first_verdict_no_live_measurable','docs/planning/final/phase-0-frame-and-status/answer-first-verdict.md');

const closed=Object.values(checks).every(c=>c.pass===true);
const result={closed,checked_at:new Date().toISOString(),checks};
console.log(JSON.stringify(result,null,2));
if(!closed)process.exitCode=1;
