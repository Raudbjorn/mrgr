// Prospective operating-characteristic check; optional descriptive confirmation intervals.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {compare} from './v2.mjs';
const dir=new URL('./v2-2026-09-06b/',import.meta.url);
const logFact=[0];for(let i=1;i<=1000;i++)logFact.push(logFact[i-1]+Math.log(i));
const binom=(n,k,p)=>Math.exp(logFact[n]-logFact[k]-logFact[n-k]+k*Math.log(p)+(n-k)*Math.log1p(-p));
assert(Math.abs(Array.from({length:11},(_,k)=>binom(10,k,.3)).reduce((a,b)=>a+b,0)-1)<1e-12);
const scenarios=[];
for(const [n,d,q] of [[92,0,.3],[92,.05,.25],[92,.10,.3],[92,.15,.3],[234,.10,.3]]){
  let probability=0;
  for(let m=1;m<=n;m++)for(let wins=Math.ceil(m/2);wins<=m;wins++){
    const a=Array.from({length:n},(_,i)=>i<wins),b=Array.from({length:n},(_,i)=>i>=wins&&i<m);
    if(compare(a,b).pass)probability+=binom(n,m,q)*binom(m,wins,(q+d)/(2*q));
  }
  scenarios.push({independent_pairs:n,true_gain:d,discordance:q,marginal_gate_pass_probability:probability});
}
const design={method:'exact enumeration of binomial discordance count and conditional wins; tests the frozen magnitude+McNemar rule',
  assumptions:'independent paired outcomes with constant discordance; per-comparison probabilities, not joint power across baselines or empirical estimates',scenarios};
writeFileSync(new URL('design-check.json',dir),JSON.stringify(design,null,2)+'\n');
console.log(JSON.stringify(design,null,2));
const scorePath=new URL('confirmation-scores.jsonl',dir);
if(existsSync(scorePath)){
  const scores=readFileSync(scorePath,'utf8').trim().split('\n').map(JSON.parse);
  const rows=[...Map.groupBy(scores,s=>s.id)].map(([id,rs])=>({id,repo:rs[0].repo,arms:Object.fromEntries(rs.map(s=>[s.arm,Number(s.matched)]))}));
  const strata=[...Map.groupBy(rows,r=>r.repo).values()],comparators=Object.keys(rows[0].arms).filter(a=>a!=='selected');
  const draws=Object.fromEntries(comparators.map(a=>[a,[]]));
  // ponytail: 5,000 deterministic SHA-256 bootstrap draws; increase for finer tail precision.
  for(let b=0;b<5000;b++){
    const sample=strata.flatMap((s,k)=>s.map((_,j)=>s[Math.floor(createHash('sha256').update(`mrgr-h0-ci-v1:${b}:${k}:${j}`).digest().readUInt32BE(0)/2**32*s.length)]));
    for(const a of comparators)draws[a].push(sample.reduce((n,r)=>n+r.arms.selected-r.arms[a],0)/sample.length);
  }
  const result={method:'descriptive percentile bootstrap, 5000 draws, paired within merge and stratified by the three named repositories; not an additional acceptance gate',
    limitations:'Assumes independent sampled merge events within each repository; does not account for unknown shared-history dependence or establish repository-population inference.',
    intervals:Object.fromEntries(comparators.map(a=>{const v=draws[a].sort((x,y)=>x-y);return[a,{lower:v[125],upper:v[4874]}];})),
    leave_one_repo_out:Object.fromEntries(strata.map(s=>[s[0].repo,Object.fromEntries(comparators.map(a=>{const kept=rows.filter(r=>r.repo!==s[0].repo);return[a,kept.reduce((n,r)=>n+r.arms.selected-r.arms[a],0)/kept.length];}))]))};
  writeFileSync(new URL('uncertainty.json',dir),JSON.stringify(result,null,2)+'\n');
}

const aggregatePath=new URL('confirmation-aggregate.json',dir);
if(existsSync(aggregatePath)){
  const {metrics}=JSON.parse(readFileSync(aggregatePath,'utf8'));
  const forced=['keep-ours','keep-theirs','git-union','longer-side'];
  const best=forced.reduce((a,b)=>metrics[a].matched>=metrics[b].matched?a:b);
  const arms=Object.fromEntries(['hunk-only','selected','bounded-context'].map(arm=>{
    const m=metrics[arm], review=m.halt+m.invalid, accepted=m.matched+m.nonmatched;
    const lower=accepted?m.nonmatched/accepted:null;
    const upper=review?(metrics[best].nonmatched-m.nonmatched)/review:null;
    return [arm,{mean_total_tokens:m.tokens/m.scheduled,mean_request_seconds:m.duration_ms/m.scheduled/1000,
      accepted,review,historical_disagreement_among_accepted:lower,
      beats_always_halt_when_review_cost_above:lower,
      beats_best_forced_when_review_cost_below:upper,
      no_review_case:review===0?'Compare fixed nonmatched counts directly; no finite upper threshold.':null,
      some_nonnegative_cost_beats_both:accepted>0 && (review===0?m.nonmatched<metrics[best].nonmatched:upper>Math.max(0,lower))}];
  }));
  const costs={assumptions:'Descriptive loss only: one historically nonmatching accepted output costs 1; halt and invalid output each incur review cost c>=0; historically matching output costs 0. Historical disagreement is not semantic harm. Invalid-as-review is an explicit accounting assumption, not the frozen primary endpoint.',
    formula:'L_arm(c) = (nonmatched + c * (halt + invalid)) / scheduled; L_always_halt(c)=c',
    best_forced_baseline:best,baseline_disagreement:metrics[best].nonmatched,arms};
  writeFileSync(new URL('cost-characterization.json',dir),JSON.stringify(costs,null,2)+'\n');
}

if(existsSync(aggregatePath)){
  const readRows=name=>readFileSync(new URL(name,dir),'utf8').trim().split('\n').map(JSON.parse);
  const refs=new Map(readRows('references.jsonl').map(r=>[r.id,r.resolution]));
  const inputs=readRows('inputs.jsonl').filter(r=>r.split==='confirmation'),norm=s=>s.replace(/\r\n/g,'\n');
  const arms=Object.fromEntries(['hunk-only','selected','bounded-context'].map(arm=>{
    const misses=inputs.map(i=>({reference:refs.get(i.id),record:JSON.parse(readFileSync(new URL(`confirmation/${i.id}-${arm}.json`,dir)))}))
      .filter(r=>!r.record.error && r.record.parsed.decision==='resolve' && norm(r.record.parsed.resolution)!==norm(r.reference));
    return [arm,{exact_misses:misses.length,
      misses_equal_after_trimming_outer_whitespace:misses.filter(r=>norm(r.record.parsed.resolution).trim()===norm(r.reference).trim()).length,
      misses_equal_after_removing_all_whitespace:misses.filter(r=>norm(r.record.parsed.resolution).replace(/\s+/g,'')===norm(r.reference).replace(/\s+/g,'')).length,
      misses_with_literal_backslash_n_and_no_real_newline:misses.filter(r=>r.record.parsed.resolution.includes('\\n')&&!r.record.parsed.resolution.includes('\n')).length}];
  }));
  writeFileSync(new URL('format-diagnostic.json',dir),JSON.stringify({status:'POST-HOC DESCRIPTION ONLY; no replacement endpoint, semantic credit, or change to MEASURABLE',warning:'Removing whitespace can change code semantics. These counts diagnose presentation sensitivity and are not alternative correct counts.',arms},null,2)+'\n');
}
