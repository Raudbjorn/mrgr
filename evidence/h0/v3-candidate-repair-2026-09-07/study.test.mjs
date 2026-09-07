import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {MODELS,BASELINES} from '../v3.mjs';
import {hash} from '../v3-data.mjs';
import {CANDIDATE_ARMS,TOOL_FREE,STRUCTURAL,candidates,citableIds,request,decode,toolSubset} from './candidate-arms.mjs';
import {schedule,effectsFor,bindingFor,floorFor,CONTEXT_KEYS,readouts} from './study.mjs';

const SOURCE=resolve(import.meta.dirname,'../v3-repaired-development-2026-09-07');
const cases=JSON.parse(readFileSync(`${SOURCE}/cases.json`,'utf8'));
const closed=JSON.parse(readFileSync(`${SOURCE}/aggregate.json`,'utf8'));
const body=text=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(text)}}]});

test('candidate sets deduplicate and are drawn only from frozen baselines',()=>{
  for(const c of cases)for(const arm of CANDIDATE_ARMS){
    const list=candidates(c,arm),texts=list.map(x=>x.text);
    assert.equal(new Set(texts).size,texts.length,'duplicate candidate text');
    assert.equal(new Set(list.map(x=>x.id)).size,list.length,'duplicate candidate id');
    const allowed=(arm==='candidates-tool-free'?TOOL_FREE:STRUCTURAL).map(k=>c.baselines[k].resolution);
    for(const t of texts)assert(allowed.includes(t),'candidate not from this arm\'s baselines');
    for(const x of list)assert.equal(x.id,`cand-${hash(x.text).slice(0,8)}`);
  }
});
test('ordering is deterministic and independent of the arm',()=>{
  for(const c of cases){
    assert.deepEqual(candidates(c,'candidates-tool-free'),candidates(c,'candidates-tool-free'));
    const free=candidates(c,'candidates-tool-free').map(x=>x.id);
    const kept=candidates(c,'candidates-structural').map(x=>x.id).filter(id=>free.includes(id));
    assert.deepEqual(kept,free,'shared candidates must keep their relative order across arms');
  }
});
test('treatment is a superset of control, differing by at most the structural merge',()=>{
  for(const c of cases){
    const free=candidates(c,'candidates-tool-free').map(x=>x.id);
    const structural=candidates(c,'candidates-structural').map(x=>x.id);
    assert(free.every(id=>structural.includes(id)));
    assert(structural.filter(id=>!free.includes(id)).length<=1);
  }
});
test('the tool subset is exactly the set of byte-differing prompts',()=>{
  const subset=toolSubset(cases),differing=cases
    .filter(c=>JSON.stringify(request(c,'candidates-tool-free',MODELS.mercury))!==JSON.stringify(request(c,'candidates-structural',MODELS.mercury)))
    .map(c=>c.id);
  assert.deepEqual([...subset.differs].sort(),differing.sort());
  assert.equal(subset.differs.length+subset.identical.length,60);
  assert(subset.differs.length<subset.mergiraf_resolves,'dedup must remove duplicate structural output');
});
test('prompts carry the candidates, the focal hunks and the splice boundary, and no scaffold bytes',()=>{
  for(const c of cases.slice(0,12))for(const arm of CANDIDATE_ARMS){
    const r=request(c,arm,MODELS.mercury),user=r.messages[1].content;
    assert(r.messages[0].content.includes('CANDIDATE_RESOLUTIONS holds independently produced'));
    assert(user.includes('FIXED_SPLICE_BOUNDARY')&&user.includes('CANDIDATE_RESOLUTIONS'));
    assert(!user.includes('READ_ONLY_CONTEXT'),'candidate arms are built on hunk-only');
    for(const x of candidates(c,arm))assert(user.includes(x.id)&&user.includes(x.text));
    assert(user.includes(`CITABLE_IDS: ${JSON.stringify(citableIds(c,arm))}`));
    assert(!user.includes(c.evaluator.scaffold),'evaluator path must never reach a prompt');
  }
});
test('decode enforces the frozen output contract and this arm\'s citable ids',()=>{
  const c=cases.find(x=>toolSubset(cases).differs.includes(x.id));
  const id=candidates(c,'candidates-structural')[0].id;
  assert.equal(decode(body({decision:'resolve',resolution:'x',citations:[id]}),c,'candidates-structural').kind,'resolve');
  assert.equal(decode(body({decision:'halt',resolution:'',citations:[]}),c,'candidates-structural').kind,'halt');
  assert.equal(decode(body({decision:'resolve',resolution:'x',citations:['cand-deadbeef']}),c,'candidates-structural').kind,'invalid-output');
  assert.equal(decode({choices:[{finish_reason:'length',message:{content:''}}]},c,'candidates-structural').kind,'truncated');
  assert.equal(decode({base_resp:{status_code:1}},c,'candidates-structural').kind,'provider-error');
  const only=candidates(c,'candidates-structural').filter(x=>!candidates(c,'candidates-tool-free').some(y=>y.id===x.id))[0];
  assert.equal(decode(body({decision:'resolve',resolution:'x',citations:[only.id]}),c,'candidates-tool-free').kind,'invalid-output',
    'a structural-only id must not be citable in the control arm');
});
test('schedule covers every cell three times in a frozen order',()=>{
  const digest=hash('x'.repeat(10)).slice(0,64);
  const requests=Object.fromEntries(cases.flatMap(c=>Object.keys(MODELS).flatMap(m=>CANDIDATE_ARMS.map(a=>[`${c.id}/${m}/${a}`,hash(`${c.id}${m}${a}`)]))));
  const s=schedule(cases,digest,requests);
  assert.equal(s.rows.length,720);assert.equal(new Set(s.rows.map(r=>r.request_id)).size,720);
  assert.deepEqual(s,schedule(cases,digest,requests));
  for(let repeat=1;repeat<=3;repeat++)for(const m of Object.keys(MODELS))for(const a of CANDIDATE_ARMS)
    assert.equal(s.rows.filter(r=>r.repeat===repeat&&r.model===m&&r.arm===a).length,60);
  assert.notDeepEqual(s.rows.filter(r=>r.repeat===1).map(r=>r.case_id),s.rows.filter(r=>r.repeat===2).map(r=>r.case_id));
});
test('duplicated outcomes produce exactly zero contrast',()=>{
  const rows=closed.rowsByRepeat[0].mercury.map(r=>({...r,'context-selected':r.selected,'candidates-tool-free':r['hunk-only']}));
  const measured=effectsFor(rows,'candidates-tool-free',['hunk-only']);
  assert.equal(measured.unweighted['hunk-only'].delta,0);
  assert.equal(measured.standardized['hunk-only'].delta,0);
  assert.deepEqual(bindingFor(measured,['hunk-only']).map(b=>b.comparator),['hunk-only','hunk-only']);
});
test('a planted advantage reproduces its declared delta through the frozen estimator',()=>{
  const base=closed.rowsByRepeat[0].mercury;
  for(const planted of [3,6,12]){
    let left=planted;
    const rows=base.map(r=>{const gain=!r['hunk-only']&&left>0&&left--;return{...r,'context-selected':r.selected,'candidates-tool-free':r['hunk-only']||!!gain};});
    const measured=effectsFor(rows,'candidates-tool-free',['hunk-only']);
    assert.equal(measured.unweighted['hunk-only'].delta,planted/60,'unweighted delta must equal the planted advantage');
    assert.equal(measured.unweighted['hunk-only'].discordance.selected_only,planted);
    assert.equal(measured.unweighted['hunk-only'].discordance.comparator_only,0);
    assert.equal(measured.unweighted['hunk-only'].n,60,'denominator preserved');
    assert.equal(measured.unweighted['hunk-only'].clusters,34,'clustering preserved');
    assert.deepEqual(Object.keys(measured.counts).map(k=>measured.counts[k]),[15,15,17,13],'strata preserved');
  }
});
test('floors match the closed study: arms +5pp, deterministic baselines above zero',()=>{
  for(const k of [...Object.values(CONTEXT_KEYS),...CANDIDATE_ARMS])assert.equal(floorFor(k),0.05);
  for(const k of BASELINES)assert.equal(floorFor(k),0);
});
test('a treatment cannot be compared against itself',()=>{
  const rows=closed.rowsByRepeat[0].mercury.map(r=>({...r,'candidates-tool-free':r['hunk-only']}));
  assert.throws(()=>effectsFor(rows,'candidates-tool-free',['candidates-tool-free']),/itself/);
});
test('readouts stage a binding repeat-1 result as an exploratory null and never as gate clearing',()=>{
  const protocol={models:MODELS,tool_subset:{ids:toolSubset(cases).differs}};
  const runs=closed.rowsByRepeat.map(rep=>Object.fromEntries(Object.entries(rep).map(([m,rows])=>[m,rows.map(r=>{
    const row={id:r.id,repo:r.repo,cell:r.cell};for(const k of BASELINES)row[k]=r[k];
    for(const [from,to] of Object.entries(CONTEXT_KEYS))row[to]=r[from];
    for(const a of CANDIDATE_ARMS)row[a]=false;return row;})])));
  const out=readouts(runs,protocol,cases);
  assert.equal(out.stage,'NO DEMONSTRATED BENEFIT (EXPLORATORY)');
  assert.equal(out.gate_clearing,false);
  assert.equal(out.identical_prompt_cases,43);
  assert.equal(out.R2,undefined);
  assert.equal(out.readouts.R2.mercury[0].estimator,'unweighted-only');
  assert.equal(out.readouts.R2.mercury[0].n,17);
  assert.equal(out.readouts.R4.mercury.arms['candidates-tool-free'].sample_sd,0);
});
