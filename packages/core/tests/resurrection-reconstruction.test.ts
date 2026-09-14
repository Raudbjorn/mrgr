import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { ReconstructionGit, isolatedRepository, reconstruct, detectResurrections, removeCandidates } from "./resurrection-reconstruction.js";

test("fresh three-merge proof needs no final refs, preserves unrelated entries and repeats exactly",()=>{
 const root=mkdtempSync(join(tmpdir(),"resurrection-public-"));
 try{
  const git=new ReconstructionGit(root);git.run(["init","--bare","--quiet","--template="]);
  const commit=(files:Record<string,string>,parents:string[],label:string)=>{
   git.run(["read-tree","--empty"]);
   const records=Object.entries(files).map(([path,content])=>`100644 ${git.run(["hash-object","-w","--stdin"],content).trim()}\t${path}\0`).join("");
   git.run(["update-index","-z","--index-info"],records);
   return git.commit(git.run(["write-tree"]).trim(),parents,label);
  };
  const baseFiles={"src/a.test.ts":"old\n","src/space\t☃.test.ts":"old\n","src/keep.ts":"keep\n","src/unchanged.test.ts":"deleted upstream\n"};
  const base=commit(baseFiles,[],"base");
  const origin=commit({"src/keep.ts":"keep\n"},[base],"upstream deletions");
  const fork4=commit({...baseFiles,"src/a.test.ts":"modified\n","src/space\t☃.test.ts":"雪\n","src/clean.test.ts":"new\n"},[base],"fork4");
  const fork6=commit({...baseFiles,"src/a.test.ts":"modified\n","src/space\t☃.test.ts":"雪\n"},[base],"fork6");
  const inputs={origin,base4:base,base6:base,fork4,fork6};
  const results=[];
  for(let i=0;i<2;i++){
   const isolated=isolatedRepository(join(root,`replay-${i}`),root,inputs);
   assert.equal(isolated.run(["for-each-ref","--format=%(refname)"]).trim().split("\n").length,5);
   const trees=reconstruct(isolated,inputs),candidates=detectResurrections(isolated,inputs,trees.tree);
   assert.deepEqual(candidates.map(c=>c.path),["src/a.test.ts","src/space\t☃.test.ts"]);
   assert.deepEqual(candidates.map(c=>c.legs),[["4","6"],["4","6"]]);
   assert.equal(candidates.reduce((n,c)=>n+c.size,0),Buffer.byteLength("modified\n雪\n"));
   const edited=removeCandidates(isolated,trees.tree,candidates);assert.deepEqual(detectResurrections(isolated,inputs,edited),[]);
   assert(isolated.entries(edited).some(e=>e.path==="src/clean.test.ts"));
   assert(isolated.receipts.filter(r=>r.args.includes("merge-tree")).some(r=>r.status===1));
   assert.throws(()=>reconstruct(isolated,{...inputs,fork4:"0".repeat(40)}),/failed/);
   assert.throws(()=>isolated.run(["merge-tree","--definitely-not-an-option"]),/failed/);
   results.push({trees,candidates,edited});
  }
  assert.deepEqual(results[0],results[1]);
 }finally{rmSync(root,{recursive:true,force:true});}
},30000);
