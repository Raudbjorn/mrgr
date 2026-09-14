import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { accessSync, constants, mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { devNull } from "node:os";
import { delimiter, join, resolve } from "node:path";

export type ReconstructionInputs = Record<"origin" | "base4" | "fork4" | "base6" | "fork6", string>;
export interface Entry { path: string; mode: string; type: string; oid: string; size: number }
export interface ResurrectionCandidate extends Entry { legs: string[] }

export function resolveGit(path = process.env.PATH ?? ""): string {
 for (const directory of path.split(delimiter).filter(Boolean)) {
  const file = resolve(directory, process.platform === "win32" ? "git.exe" : "git");
  try { accessSync(file, constants.X_OK); if (statSync(file).isFile()) return realpathSync(file); } catch { /* Try the next PATH entry. */ }
 }
 throw new Error("Git executable not found on PATH");
}

/** Git receives no inherited configuration, object alternates, credentials or hooks. */
export class ReconstructionGit {
 readonly receipts: { args: string[]; status: number | null; stdout: string; stderr: string; error: string | null }[] = [];
 readonly env = {
  PATH: process.env.PATH ?? "", ...(process.platform === "win32" ? {SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP} : {}), LC_ALL: "C", TZ: "UTC",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull, GIT_ATTR_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "mrgr reconstruction", GIT_AUTHOR_EMAIL: "reconstruction@example.invalid",
  GIT_COMMITTER_NAME: "mrgr reconstruction", GIT_COMMITTER_EMAIL: "reconstruction@example.invalid",
  GIT_AUTHOR_DATE: "2026-09-06T00:00:00Z", GIT_COMMITTER_DATE: "2026-09-06T00:00:00Z",
 };
 readonly executable = resolveGit(this.env.PATH);
 constructor(readonly cwd: string, readonly receiptFile?: string) {}
 run(args: string[], input?: string | Buffer, accepted = [0]): string {
  const effective = ["-c", "merge.conflictStyle=diff3", "-c", `core.hooksPath=${devNull}`, "-c", `core.attributesFile=${devNull}`, "-c", "core.autocrlf=false", "-c", "commit.gpgSign=false", ...args];
  const r = spawnSync(this.executable, effective, {cwd:this.cwd,env:this.env,input,encoding:"utf8",timeout:120000,maxBuffer:64*1024*1024});
  this.receipts.push({args:effective,status:r.status,stdout:r.stdout??"",stderr:r.stderr??"",error:r.error?.message??null});
  if(this.receiptFile)writeFileSync(this.receiptFile, JSON.stringify(this.receipts,null,2)+"\n");
  assert(!r.error && r.signal===null && r.status!==null && accepted.includes(r.status), `git ${args[0]} failed: ${r.error?.message??r.stderr}`);
  return r.stdout;
 }
 entries(ref: string): Entry[] {
  return this.run(["ls-tree","-r","-z","--long",ref]).split("\0").filter(Boolean).map(record=>{
   const tab=record.indexOf("\t"),[mode,type,oid,size]=record.slice(0,tab).trim().split(/\s+/);
   assert(mode && type && oid && size);return {path:record.slice(tab+1),mode,type,oid,size:type==="blob"?Number(size):0};
  });
 }
 commit(tree:string,parents:string[],message:string):string {
  return this.run(["commit-tree",tree,...parents.flatMap(p=>["-p",p]),"-m",message]).trim();
 }
}

export function reconstruct(git: ReconstructionGit, inputs: ReconstructionInputs, messages: [string,string] = ["resurrection fork4","resurrection fork6"]) {
 for(const oid of Object.values(inputs))assert(/^[0-9a-f]{40}$/.test(oid),"pinned SHA-1 input required");
 for(const oid of Object.values(inputs))git.run(["cat-file","-e",`${oid}^{commit}`]);
 const merge=(base:string,ours:string,theirs:string)=>{
  const raw=git.run(["merge-tree","--write-tree","--name-only","-z",`--merge-base=${base}`,ours,theirs],undefined,[0,1]);
  const tree=raw.split("\0")[0]!;assert(/^[0-9a-f]{40}$/.test(tree),"missing returned tree");git.run(["cat-file","-e",`${tree}^{tree}`]);return tree;
 };
 const leg4=merge(inputs.base4,inputs.origin,inputs.fork4),leg6=merge(inputs.base6,inputs.origin,inputs.fork6);
 const commit4=git.commit(leg4,[inputs.origin,inputs.fork4],messages[0]),commit6=git.commit(leg6,[inputs.origin,inputs.fork6],messages[1]);
 const tree=merge(inputs.origin,commit4,commit6);
 return {leg4,leg6,commit4,commit6,tree};
}

/** Candidate identity depends only on upstream deletion, fork presence and returned-tree presence. */
export function detectResurrections(git: ReconstructionGit, inputs: ReconstructionInputs, tree:string):ResurrectionCandidate[] {
 const origin=new Set(git.entries(inputs.origin).map(e=>e.path)),joined=new Map(git.entries(tree).map(e=>[e.path,e]));
 const found=new Map<string,ResurrectionCandidate>();
 for(const leg of ["4","6"] as const){
  const fork=new Set(git.entries(inputs[`fork${leg}`]).map(e=>e.path));
  for(const e of git.entries(inputs[`base${leg}`])){
   const result=joined.get(e.path);
   if(e.type!=="blob" || !e.path.endsWith(".test.ts") || origin.has(e.path) || !fork.has(e.path) || !result || result.type!=="blob")continue;
   const c=found.get(e.path)??{...result,legs:[]};c.legs.push(leg);found.set(e.path,c);
  }
 }
 return [...found.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}

export function removeCandidates(git:ReconstructionGit,tree:string,candidates:ResurrectionCandidate[]):string {
 const paths=new Set(candidates.map(c=>c.path));assert.equal(paths.size,candidates.length,"duplicate removal");
 const before=git.entries(tree);for(const c of candidates)assert(before.some(e=>e.path===c.path&&e.oid===c.oid),"candidate is not in input tree");
 // A disposable repository's index; no checkout or original worktree is touched.
 git.run(["read-tree",tree]);git.run(["update-index","-z","--index-info"],Buffer.from([...paths].map(path=>`0 ${"0".repeat(40)}\t${path}\0`).join("")));
 const edited=git.run(["write-tree"]).trim();assert.deepEqual(git.entries(edited),before.filter(e=>!paths.has(e.path)));return edited;
}

export function isolatedRepository(directory:string,source:string,inputs:ReconstructionInputs,receiptFile?:string):ReconstructionGit {
 mkdirSync(directory,{recursive:false});const git=new ReconstructionGit(directory,receiptFile);git.run(["init","--bare","--quiet","--template="]);
 // Fetch only pinned input histories. Never clone final refs or borrow an object database.
 for(const [name,oid] of Object.entries(inputs)){
  assert(/^[0-9a-f]{40}$/.test(oid));git.run(["-c","protocol.file.allow=always","fetch","--quiet","--no-tags",source,`${oid}:refs/inputs/${name}`]);
 }
 git.run(["fsck","--connectivity-only","--no-dangling"]);return git;
}
