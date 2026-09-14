#!/usr/bin/env -S pnpm exec tsx
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ReconstructionGit, isolatedRepository, reconstruct, detectResurrections, removeCandidates } from "../packages/core/tests/resurrection-reconstruction.js";
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),source=resolve(process.argv[2]??root),out=resolve(process.argv[3]??"");
assert(process.argv.length===4,"Usage: pnpm exec tsx scripts/resurrection-proof.ts SOURCE_REPO NEW_PRIVATE_OUTPUT_DIRECTORY");
assert(!existsSync(out),"refusing to overwrite evidence");mkdirSync(out,{recursive:true});
const save=(name:string,value:unknown)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+"\n");
const sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const inputs={origin:"b2d25948e9668982afcda5a9e4a515ff3fe08d97",base4:"4a7299091d226d34baa593ba83c0af0d661bdbef",fork4:"c687b532782dd6464e779f6f028361d0c427fb76",base6:"83c6e7d4d4642629257aa1b0ef8eacc77fcaf954",fork6:"9c25e84e4790283be52bba5df8a33e9ca15f1356"};
const historical="2e393f450d33c7d186b87c9d748a83760f49d6fc";
const expected={"src/main/persistence.test.ts":445919,"src/renderer/src/web/web-preload-api.test.ts":170454,"src/main/codex-accounts/runtime-home-service.test.ts":168669,"src/main/updater.test.ts":164289};
const wrapperMetadata={name:"round4-arm-N3",email:"claude@sveinbjorn.dev",date:"1787624391 +0000",messages:["N3 star leg T4: ov2-base x fork4-p (merge-base base4-p), unresolved","N3 star leg T6: ov2-base x fork6-p (merge-base base6-p), unresolved"] as [string,string]};
const sources=["scripts/resurrection-proof.ts","packages/core/tests/resurrection-reconstruction.ts","packages/core/tests/resurrection-reconstruction.test.ts"];
let stage="prerequisites";
try{
 console.log(stage);
 const closure=JSON.parse(execFileSync(process.execPath,[join(root,"evidence/h0/phase3-closure-check.mjs")],{cwd:root,encoding:"utf8",timeout:30000}));assert.equal(closure.closed,true);save("phase3-check.json",closure);
 const manifestPath=join(root,"evidence/m2a/2026-09-06/manifest.json"),m=JSON.parse(readFileSync(manifestPath,"utf8"));
 for(const [file,h] of Object.entries(m.source_hashes))assert.equal(sha(join(root,file)),h,file);
 for(const [file,h] of Object.entries(m.public_fixture_files))assert.equal(sha(join(root,"evidence/m2a/2026-09-06",file)),h,file);
 for(const [name,t] of Object.entries(m.tools) as [string,{path:string;sha256:string}][])assert.equal(sha(t.path),t.sha256,name);
 for(const name of ["protocol","summary"])assert.equal(sha(join(root,m.private_preflight.path,name+".json")),m.private_preflight[name+"_sha256"]);
 let verifiedTrees=0;
 for(const file of Object.keys(m.public_fixture_files).filter(f=>f.endsWith(".bundle"))){
  const dir=join(out,"phase4-"+file.slice(0,-7));mkdirSync(dir);const g=new ReconstructionGit(dir);g.run(["init","--bare","--quiet","--template="]);g.run(["fetch","--quiet",join(root,"evidence/m2a/2026-09-06",file),"+refs/*:refs/*"]);
  const fixture=JSON.parse(readFileSync(join(root,"evidence/m2a/2026-09-06",file.replace(/\.bundle$/,".json")),"utf8"));
  fixture.runs.forEach((r:{tree:string},i:number)=>{assert.equal(g.run(["rev-parse",`refs/mrgr-evidence/run-${i}^{tree}`]).trim(),r.tree);g.run(["fsck","--connectivity-only","--no-dangling"]);verifiedTrees++;});
 }
 assert.equal(verifiedTrees,45);save("phase4-check.json",{valid:true,manifest_sha256:sha(manifestPath),verifiedTrees});
 save("protocol.json",{version:"resurrection-fresh-proof/1",at:new Date().toISOString(),inputs,wrapperMetadata,source,git:execFileSync("/usr/bin/git",["--version"],{encoding:"utf8"}).trim(),git_sha256:sha("/usr/bin/git"),node:process.version,source_hashes:Object.fromEntries(sources.map(f=>[f,sha(join(root,f))])),detection:".test.ts blob present in fork base, absent from origin, retained in fork, present in fresh join; union across both legs",comparison_only:{historical,expected},timeout_ms_per_git:120000,private_evidence:true});
 const results=[];
 for(let i=0;i<2;i++){
  stage=`fresh reconstruction ${i+1}/2`;console.log(stage);
  const g=isolatedRepository(join(out,`replay-${i}`),source,inputs,join(out,`commands-${i}.json`));
  Object.assign(g.env,{GIT_AUTHOR_NAME:wrapperMetadata.name,GIT_COMMITTER_NAME:wrapperMetadata.name,GIT_AUTHOR_EMAIL:wrapperMetadata.email,GIT_COMMITTER_EMAIL:wrapperMetadata.email,GIT_AUTHOR_DATE:wrapperMetadata.date,GIT_COMMITTER_DATE:wrapperMetadata.date});
  const trees=reconstruct(g,inputs,wrapperMetadata.messages),candidates=detectResurrections(g,inputs,trees.tree);
  save(`candidates-${i}.json`,{inputs,trees,candidates}); // Freeze before any final/historical lookup.
  const edited=removeCandidates(g,trees.tree,candidates);assert.deepEqual(detectResurrections(g,inputs,edited),[]);
  g.run(["update-ref","refs/results/join",g.commit(trees.tree,[trees.commit4,trees.commit6],"fresh join")]);
  g.run(["update-ref","refs/results/edited",g.commit(edited,[trees.commit4,trees.commit6],"remove frozen candidates")]);
  results.push({trees,candidates,edited});save(`reconstruction-${i}.json`,results[i]);
 }
 assert.deepEqual(results[0],results[1],"fresh reconstructions differ");
 stage="historical comparisons after candidate freeze";console.log(stage);
 const g=new ReconstructionGit(source,join(out,"comparison-commands.json"));const fresh=new ReconstructionGit(join(out,"replay-0"));
 const r=results[0]!;const baseline=new Map(g.entries(historical).map(e=>[e.path,e]));const now=new Map(fresh.entries(r.trees.tree).map(e=>[e.path,e]));
 const diff=[...new Set([...baseline.keys(),...now.keys()])].sort().filter(p=>JSON.stringify(baseline.get(p))!==JSON.stringify(now.get(p))).map(path=>({path,historical:baseline.get(path)??null,fresh:now.get(path)??null}));save("historical-differences.json",diff);
 const finals=Object.fromEntries(["n1","n2","n3","s1","s2","s3"].map(n=>[n,g.run(["rev-parse",`refs/mrgr-imports/resurrection/r4-${n}-final^{commit}`]).trim()]));
 const absence=Object.fromEntries(Object.entries(finals).map(([name,oid])=>{const paths=new Set(g.entries(oid).map(e=>e.path));return [name,r.candidates.every(c=>!paths.has(c.path))];}));
 const candidateMatch=JSON.stringify(Object.entries(Object.fromEntries(r.candidates.map(c=>[c.path,c.size]))).sort())===JSON.stringify(Object.entries(expected).sort());
 const checks={deterministic:true,candidates_match: candidateMatch,total_bytes:r.candidates.reduce((n,c)=>n+c.size,0)===949331,all_finals_absent:Object.values(absence).every(Boolean),post_edit_zero:true,unrelated_entries_unchanged:true,exact_historical_tree:r.trees.tree===historical};
 const complete=Object.values(checks).every(Boolean);
 save("result.json",{complete,valid_fresh_reconstruction:true,phase5_closed:complete,checks,trees:r.trees,candidates:r.candidates,edited:r.edited,finals,absence,historical_difference_count:diff.length,candidate_manifest_sha256:sha(join(out,"candidates-0.json")),claim:complete?"Fresh reconstruction matches historical tree and deletion proof":"Fresh deterministic characterization; exact historical proof not closed. Differences preserved, no outcome-based filtering."});
 console.log(JSON.stringify({complete,checks,candidates:r.candidates.length,historical_difference_count:diff.length}));if(!complete)process.exitCode=1;
}catch(e){save("FAILURE.json",{stage,error:e instanceof Error?e.stack:String(e),complete:false});console.error(e);process.exitCode=1;}
