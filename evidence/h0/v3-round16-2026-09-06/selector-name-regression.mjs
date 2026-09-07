// Run from the repository root. Synthetic parser regression; not utility evidence.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {context as original} from '../v3-development-2026-09-06e/instrument/evidence/h0/v3-data.mjs';
import {context as repaired} from '../../../.do-not-commit/h0-selector-repair/v3-data-revised.mjs';
const d=mkdtempSync(join(tmpdir(),'mrgr-selector-regression-'));
const git=(...args)=>execFileSync('git',['-C',d,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
try{
  git('init','-q');git('config','user.name','Selector regression');git('config','user.email','regression@example.invalid');
  const needle='func Use(s *Store) int { return s.Read() }';
  writeFileSync(join(d,'main.go'),'package p\n'+needle+'\n');
  writeFileSync(join(d,'store.go'),'package p\ntype Store struct {}\nfunc (s *Store) Read() int { return 1 }\nfunc (Read *Store) Unrelated() int { return 2 }\n');
  git('add','.');git('commit','-qm','synthetic parser fixture');const ours=git('rev-parse','HEAD');
  git('commit','--allow-empty','-qm','second fixture parent');const theirs=git('rev-parse','HEAD');
  const input={path:'main.go',language:'Go',ours:needle,theirs:needle,git:{directory:d,ours,theirs}};
  const libraries={Go:resolve('.do-not-commit/h0-v3-tools/go.so')};
  const ranks=c=>Object.fromEntries(['type Store','func (s *Store) Read','func (Read *Store) Unrelated'].map(prefix=>[prefix,c.contexts.selected.find(x=>x.text.startsWith(prefix))?.rank]));
  const before=ranks(original(input,libraries)),after=ranks(repaired(input,libraries));
  assert.deepEqual(before,{'type Store':2,'func (s *Store) Read':1,'func (Read *Store) Unrelated':1});
  assert.deepEqual(after,{'type Store':1,'func (s *Store) Read':1,'func (Read *Store) Unrelated':2});
  const cNeedle='int Use(void) { return ReadFactory()(); }';
  writeFileSync(join(d,'main.c'),cNeedle+'\n');
  writeFileSync(join(d,'other.c'),'int (*ReadFactory(void))(void) { int local = 1; return 0; }\n');
  git('add','.');git('commit','-qm','C declarator fixture');const cOurs=git('rev-parse','HEAD');
  git('commit','--allow-empty','-qm','second C parent');const cTheirs=git('rev-parse','HEAD');
  const cInput={path:'main.c',language:'C',ours:cNeedle,theirs:cNeedle,git:{directory:d,ours:cOurs,theirs:cTheirs}};
  const cLibraries={C:resolve('.do-not-commit/h0-v3-tools/c.so')};
  const rank=c=>c.contexts.selected.find(x=>x.path==='other.c')?.rank;
  assert.equal(rank(original(cInput,cLibraries)),1);assert.equal(rank(repaired(cInput,cLibraries)),1);
  console.log(JSON.stringify({pass:true,before,after,c_function_pointer_rank_preserved:true,empirical_utility_credit:false}));
}finally{rmSync(d,{recursive:true,force:true});}
