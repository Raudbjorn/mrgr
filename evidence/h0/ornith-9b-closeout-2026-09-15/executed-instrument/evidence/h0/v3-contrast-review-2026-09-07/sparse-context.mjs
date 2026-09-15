// Go-only prototype. Same-package identifier candidates, not semantic binding.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {git,hash,parseTree,safePath} from '../v3-data.mjs';
import {parentRanges} from './parent-ranges.mjs';
const CAP=32768,PER_SIDE=CAP/2,SOURCE_CAP=6,SCOPE_CAP=8192;
const declaration=n=>/^(function_declaration|method_declaration|type_declaration|const_declaration|var_declaration)$/.test(n.type);
function topDeclarations(nodes){const ds=nodes.filter(declaration),depth=Math.min(...ds.map(n=>n.depth));return ds.filter(n=>n.depth===depth&&!nodes.some(e=>e.type==='ERROR'&&e.start<n.end&&e.end>n.start));}
function names(nodes,d){const ns=nodes.filter(n=>n.start>=d.start&&n.end<=d.end&&/identifier$/.test(n.type)&&n.field==='name'),depth=Math.min(...ns.map(n=>n.depth));return ns.filter(n=>n.depth===depth).map(n=>n.text);}
function utf8Range(bytes,start,end){while(start<end&&(bytes[start]&0xc0)===0x80)start++;while(end>start&&end<bytes.length&&(bytes[end]&0xc0)===0x80)end--;return{start,end,text:bytes.subarray(start,end).toString('utf8')};}
export function window(bytes,start,end,size,exact=false){
 assert(end-start<=size,'focal hunk exceeds scope window');
 let a=Math.max(0,start-Math.floor((size-(end-start))/2)),b=Math.min(bytes.length,a+size);a=Math.max(0,b-size);
 if(exact){
  // At most 16 KiB candidate offsets; reject impossible lengths instead of
  // silently giving the two arms different amounts of source text.
  const low=Math.max(0,end-size),high=Math.min(start,bytes.length-size);
  const boundary=i=>i===bytes.length||(bytes[i]&0xc0)!==0x80;
  for(let distance=0;distance<=high-low;distance++)for(const candidate of distance?[a-distance,a+distance]:[a]){
   if(candidate>=low&&candidate<=high&&boundary(candidate)&&boundary(candidate+size))return{start:candidate,end:candidate+size,text:bytes.subarray(candidate,candidate+size).toString('utf8')};
  }
  assert.fail('no exact UTF-8 local window containing focal hunk');
 }
 return utf8Range(bytes,a,b);
}
export function sparseContext(input,library){
  assert.equal(input.language,'Go','prototype has Go evidence only');safePath(input.path);
  const selected=[],local=[],diagnostics=[];let mapped;
  const source=(side,path,range,role,extra={})=>({id:hash(`${input.git[side]}:${path}:${range.start}:${range.end}:${role}`).slice(0,24),side,revision:input.git[side],path,start_byte:range.start,end_byte:range.end,text:range.text,role,...extra});
  for(const side of ['ours','theirs']){
    const revision=input.git[side];assert(/^[a-f0-9]{40}$/.test(revision));const bytes=git(input.git.directory,'show',`${revision}:${input.path}`),needle=Buffer.from(input[side]);
    let at=bytes.indexOf(needle);
    if(!needle.length||at<0||bytes.indexOf(needle,at+1)>=0){mapped??=parentRanges(input);const range=mapped.ranges[side];assert.equal(range.blob_sha256,hash(bytes));at=range.start_byte;assert(bytes.subarray(at,range.end_byte).equals(needle));diagnostics.push({side,reason:'exact-diff3-parent-range',...range});}
    const end=at+needle.length;
    const nodes=parseTree(bytes.toString('utf8'),'Go',library),ds=topDeclarations(nodes);
    // Hunk whitespace is part of the replacement, but not part of an AST node.
    // Cover every intersected top-level declaration, including multi-declaration hunks.
    const leading=Buffer.byteLength(needle.toString('utf8').match(/^\s*/)[0]);
    const trailing=Buffer.byteLength(needle.toString('utf8').match(/\s*$/)[0]);
    const contentStart=at+leading,contentEnd=end-trailing;
    const topDepth=Math.min(...nodes.filter(n=>n.type!=='source_file').map(n=>n.depth));
    const units=[...ds,...nodes.filter(n=>n.depth===topDepth&&['comment','package_clause','import_declaration'].includes(n.type))];
    const intersected=units.filter(n=>n.start<contentEnd&&n.end>contentStart);
    const scopeStart=intersected.length?Math.min(at,...intersected.map(n=>n.start)):at;
    const scopeEnd=intersected.length?Math.max(end,...intersected.map(n=>n.end)):end;
    const covers=intersected.length>0&&Math.min(...intersected.map(n=>n.start))<=contentStart&&Math.max(...intersected.map(n=>n.end))>=contentEnd;
    const cap=Math.min(PER_SIDE,bytes.length),scopeLimit=Math.min(SCOPE_CAP,cap);
    assert(needle.length<=scopeLimit,'focal hunk cannot fit bounded scope');
    const scopeComplete=covers&&scopeEnd-scopeStart<=scopeLimit&&!nodes.some(n=>n.type==='ERROR'&&n.start<scopeEnd&&n.end>scopeStart);
    const primary=scopeComplete?{start:scopeStart,end:scopeEnd,text:bytes.subarray(scopeStart,scopeEnd).toString('utf8')}:window(bytes,at,end,scopeLimit);
    const chosen=[source(side,input.path,primary,scopeComplete?'enclosing-declaration':'focal-window',{scope_complete:scopeComplete,declaration_count:intersected.filter(declaration).length})];
    if(!scopeComplete)diagnostics.push({side,reason:covers?'oversized-enclosing-declaration':'no-enclosing-declaration',fallback:'focal-window'});
    const focal=nodes.filter(n=>n.start>=at&&n.end<=end&&/identifier$/.test(n.type));
    const declared=new Set(focal.filter(n=>n.field==='name').map(n=>n.text));const refs=new Map();
    for(const n of focal)if(!declared.has(n.text))refs.set(n.text,(refs.get(n.text)??0)+1);
    const packageName=nodes.find(n=>n.type==='package_clause')?.text;
    const paths=git(input.git.directory,'ls-tree','-r','--name-only','-z',revision).toString('utf8').split('\0').filter(p=>p.endsWith('.go')&&!p.endsWith('_test.go')&&dirname(p)===dirname(input.path)).sort();
    const matches=new Map();
    for(const path of paths){const text=path===input.path?bytes.toString('utf8'):git(input.git.directory,'show',`${revision}:${path}`).toString('utf8');
      if(Buffer.byteLength(text)>1024*1024){diagnostics.push({side,path,reason:'file-over-1MiB'});continue;}
      const ns=path===input.path?nodes:parseTree(text,'Go',library);if(ns.find(n=>n.type==='package_clause')?.text!==packageName)continue;
      for(const d of topDeclarations(ns))for(const name of names(ns,d))if(refs.has(name)){
        const hits=matches.get(name)??[];hits.push({path,d,name});matches.set(name,hits);
      }
    }
    const candidates=new Map();
    for(const [name,count] of refs){const hits=matches.get(name)??[];
      if(hits.length!==1){diagnostics.push({side,identifier:name,reason:hits.length?'ambiguous-package-candidate':'no-package-candidate',candidates:hits.length});continue;}
      const {path,d}=hits[0];if(path===input.path&&d.start<primary.end&&d.end>primary.start)continue;
      const key=`${path}:${d.start}:${d.end}`,candidate=candidates.get(key)??{path,d,score:0,names:[]};candidate.score+=count;candidate.names.push(name);candidates.set(key,candidate);
    }
    // Relevance: direct focal reference frequency, then same-file proximity.
    // Paths only break remaining ties; revision SHA never assigns one side priority.
    const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score||Number(a.path!==input.path)-Number(b.path!==input.path)||(a.path===input.path?Math.abs(a.d.start-at):0)-(b.path===input.path?Math.abs(b.d.start-at):0)||a.path.localeCompare(b.path)||a.d.start-b.d.start);
    let used=Buffer.byteLength(primary.text);
    for(const c of ranked){const size=Buffer.byteLength(c.d.text);if(chosen.length===SOURCE_CAP)break;
      if(used+size>cap){diagnostics.push({side,path:c.path,start_byte:c.d.start,reason:'whole-declaration-over-budget'});continue;}
      chosen.push(source(side,c.path,c.d,'unique-package-name-candidate',{score:c.score,names:c.names.sort(),scope_complete:true}));used+=size;
    }
    const nearby=window(bytes,at,end,used,true);
    selected.push(...chosen);local.push(source(side,input.path,nearby,'length-matched-local-window'));
  }
  const size=xs=>xs.reduce((n,s)=>n+Buffer.byteLength(s.text),0);
  assert(selected.length<=2*SOURCE_CAP&&size(selected)<=CAP);
  return {contexts:{selected,'local-context':local},retrieval:{method:'sparse-go-package-candidates/5',language:'Go',max_sources:2*SOURCE_CAP,budget_bytes:CAP,selected_bytes:size(selected),local_bytes:size(local),byte_budget_exact:size(selected)===size(local),diagnostics,library_sha256:hash(readFileSync(library)),limitations:['lexical candidates, not semantic name binding','same-package only; imported definitions not resolved','ambiguous or empty hunks require one exact GNU diff3 triple','impossible exact UTF-8 local windows fail explicitly']}};
}
