import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {sparseContext,window} from './sparse-context.mjs';
const directory=mkdtempSync(join(tmpdir(),'mrgr-sparse-check-'));
const library=resolve('.do-not-commit/h0-v3-tools/go.so');
const git=(...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8'}).trim();
try{
 const unicode=Buffer.from('éaøbc');
 const w=window(unicode,3,5,4,true);assert.equal(Buffer.byteLength(w.text),4);assert(!w.text.includes('\ufffd'));assert(w.start<=3&&w.end>=5);
 assert.throws(()=>window(Buffer.from('éé'),2,2,3,true),/no exact UTF-8/);
 const hunk='\treturn Helper(x) + Helper(x)\n';
 writeFileSync(join(directory,'main.go'),'package p\n\nfunc Target(x int) int {\n'+hunk+'}\n\n'+ '// unrelated filler\n'.repeat(30));
 writeFileSync(join(directory,'helper.go'),'package p\nfunc Helper(x int) int { return x+1 }\nfunc Distractor() int { return 99 }\n');
 mkdirSync(join(directory,'other'));
 writeFileSync(join(directory,'other/helper.go'),'package other\nfunc Helper(x int) int { return 0 }\n');
 git('init','-q');git('add','.');git('-c','user.name=Check','-c','user.email=check@example.invalid','commit','-qm','fixture');
 const revision=git('rev-parse','HEAD');
 const input=new Proxy({language:'Go',path:'main.go',ours:hunk,theirs:hunk,git:{directory,ours:revision,theirs:revision}},{get(target,key){assert(!['reference','evaluator','git_validation','resolution'].includes(key),'oracle access');return target[key];}});
 const result=sparseContext(input,library);
 for(const side of ['ours','theirs']){
  const sources=result.contexts.selected.filter(s=>s.side===side);
  assert.equal(sources.length,2);assert.equal(sources[0].role,'enclosing-declaration');assert(sources[0].text.includes(hunk));
  assert.equal(sources[1].path,'helper.go');assert(!sources.some(s=>s.text.includes('Distractor')));
 }
 assert(result.retrieval.byte_budget_exact);assert(result.retrieval.selected_bytes<1000);
 assert.deepEqual(sparseContext(input,library),result);
 // The same method name on distinct receivers is not a unique lexical candidate.
 writeFileSync(join(directory,'duplicate.go'),'package p\ntype A struct{}\ntype B struct{}\nfunc (a A) Helper(x int) int { return x }\nfunc (b B) Helper(x int) int { return x }\n');
 git('add','.');git('-c','user.name=Check','-c','user.email=check@example.invalid','commit','-qm','ambiguous');
 input.git.ours=input.git.theirs=git('rev-parse','HEAD');
 const ambiguous=sparseContext(input,library);
 assert.equal(ambiguous.contexts.selected.length,2);
 assert(ambiguous.retrieval.diagnostics.some(d=>d.identifier==='Helper'&&d.reason==='ambiguous-package-candidate'&&d.candidates===3));
 // A newline after a declaration and a span crossing declarations must not
 // turn available complete declarations into a generic proximity window.
 const spanning='// First comment\nfunc First() int { return 1 }\n\nfunc Second() int { return 2 }\n';
 writeFileSync(join(directory,'main.go'),'package p\n\n'+spanning+'\n// éø UTF-8 footer\n');
 git('add','.');git('-c','user.name=Check','-c','user.email=check@example.invalid','commit','-qm','spanning');
 input.git.ours=input.git.theirs=git('rev-parse','HEAD');input.ours=input.theirs=spanning;
 const multi=sparseContext(input,library);
 assert(multi.contexts.selected.every(s=>s.scope_complete&&s.declaration_count===2));
 assert(multi.contexts.selected.every(s=>s.text===spanning));assert(multi.retrieval.byte_budget_exact);
 const save=(body,message)=>{writeFileSync(join(directory,'main.go'),'package p\nfunc Target() {\n'+body+'}\n');git('add','.');git('-c','user.name=Check','-c','user.email=check@example.invalid','commit','-qm',message);return git('rev-parse','HEAD');};
 input.git.base=save('\tBase()\n','base');input.git.ours=save('\tOurs()\n','ours');input.git.theirs=save('','theirs');
 input.base='\tBase()\n';input.ours='\tOurs()\n';input.theirs='';
 const empty=sparseContext(input,library);
 assert(empty.contexts.selected.some(s=>s.side==='theirs'&&s.scope_complete));
 assert(empty.retrieval.diagnostics.some(d=>d.side==='theirs'&&d.reason==='exact-diff3-parent-range'));
 assert(empty.retrieval.byte_budget_exact);
 input.base='unmatched';assert.throws(()=>sparseContext(input,library),/one exact diff3 triple/);
 console.log(JSON.stringify({pass:true,mandatory_both_scopes:true,same_package_only:true,distractor_excluded:true,ambiguous_name_rejected:true,deterministic:true,ascii_payload_budgets_exact:true,oracle_fields_inaccessible:true,multi_declaration_and_trailing_newline:true,empty_parent_hunk_and_invalid_triple:true,exact_utf8_or_explicit_failure:true,utility_credit:false}));
}finally{rmSync(directory,{recursive:true,force:true});}
