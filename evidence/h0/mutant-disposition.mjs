// Maintained admission rule. Historical evaluator outputs are deliberately unchanged.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function mutantDisposition(ev) {
  const stages=ev.stages??[], [build,test]=stages;
  const logs=stages.map(s=>(s.stdout??'')+'\n'+(s.stderr??'')).join('\n');
  if(ev.category==='environment-error'||ev.reason||stages.some(s=>s.error||s.signal||s.status===null||s.status===124||s.status>=128)||/cannot find package|no required module provides package|cannot find module providing package|^bwrap:/m.test(logs))return 'incomplete';
  if(ev.category!=='test-failure')return 'not-rejected';
  // Go assertion failures exit 1. Init panics, missing tests, and wrapper failures
  // cannot establish a behavioral rejection. Caught/logged panic text is harmless.
  if(stages.length!==2||build.stage!=='build'||build.status!==0||test.stage!=='test'||test.status!==1||! /--- FAIL: (?:Test|Example|Fuzz)\S*/.test(test.stdout??'')||/^(?:panic:|fatal error:)/m.test(logs))return 'incomplete';
  return 'rejected';
}
export function controlAudit(mutations) {
  const names=new Set(), hashes=new Set();
  const controls=mutations.map(m=>{
    const disposition=mutantDisposition(m);
    const distinct=typeof m.name==='string'&&m.name.length>0&&/^[a-f0-9]{64}$/.test(m.candidate_sha256??'')&&!names.has(m.name)&&!hashes.has(m.candidate_sha256);
    names.add(m.name);hashes.add(m.candidate_sha256);
    return {...m,disposition,verified_rejection:distinct&&disposition==='rejected'};
  });
  return {verified_rejections:controls.filter(c=>c.verified_rejection).length,controls};
}
export function verifiedOracle(oracle) {
  return oracle.reference?.length===3&&oracle.reference.every(e=>e.pass&&e.category==='behavioral-pass')&&controlAudit(oracle.mutations??[]).verified_rejections>=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(controlAudit(JSON.parse(readFileSync(0,'utf8')))));
