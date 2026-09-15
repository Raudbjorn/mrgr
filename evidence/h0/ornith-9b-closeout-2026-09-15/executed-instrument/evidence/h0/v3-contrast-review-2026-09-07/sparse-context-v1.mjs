// Go-only prototype. Same-package identifier candidates, not semantic binding.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {git,hash,parseTree,safePath} from '../v3-data.mjs';
const CAP=32768,PER_SIDE=CAP/2,SOURCE_CAP=6,SCOPE_CAP=8192;
const declaration=n=>/^(function_declaration|method_declaration|type_declaration|const_declaration|var_declaration)$/.test(n.type);
function topDeclarations(nodes){const ds=nodes.filter(declaration),depth=Math.min(...ds.map(n=>n.depth));return ds.filter(n=>n.depth===depth&&!nodes.some(e=>e.type==='ERROR'&&e.start<n.end&&e.end>n.start));}
function names(nodes,d){const ns=nodes.filter(n=>n.start>=d.start&&n.end<=d.end&&/identifier$/.test(n.type)&&n.field==='name'),depth=Math.min(...ns.map(n=>n.depth));return ns.filter(n=>n.depth===depth).map(n=>n.text);}
function utf8Range(bytes,start,end){while(start<end&&(bytes[start]&0xc0)===0x80)start++;while(end>start&&end<bytes.length&&(bytes[end]&0xc0)===0x80)end--;return{start,end,text:bytes.subarray(start,end).toString('utf8')};}
function window(bytes,start,end,size){assert(end-start<=size,'focal hunk exceeds scope window');let a=Math.max(0,start-Math.floor((size-(end-start))/2)),b=Math.min(bytes.length,a+size);a=Math.max(0,b-size);return utf8Range(bytes,a,b);}
export function sparseContext(input,library){
  assert.equal(input.language,'Go','prototype has Go evidence only');safePath(input.path);
  const selected=[],local=[],diagnostics=[];
  const source=(side,path,range,role,extra={})=>({id:hash(`${input.git[side]}:${path}:${range.start}:${range.end}:${role}`).slice(0,24),side,revision:input.git[side],path,start_byte:range.start,end_byte:range.end,text:range.text,role,...extra});
  for(const side of ['ours','theirs']){
    const revision=input.git[side];assert(/^[a-f0-9]{40}$/.test(revision));const bytes=git(input.git.directory,'show',`${revision}:${input.path}`),needle=Buffer.from(input[side]);
    if(!needle.length){diagnostics.push({side,reason:'empty-hunk-needs-parent-range'});continue;}
    const at=bytes.indexOf(needle);assert(at>=0&&bytes.indexOf(needle,at+1)<0,'ambiguous parent hunk');const end=at+needle.length;
    const nodes=parseTree(bytes.toString('utf8'),'Go',library),ds=topDeclarations(nodes);
    const scope=ds.filter(n=>n.start<=at&&n.end>=end).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
    const cap=Math.min(PER_SIDE,bytes.length),scopeLimit=Math.min(SCOPE_CAP,cap);
    assert(needle.length<=scopeLimit,'focal hunk cannot fit bounded scope');
    const scopeComplete=Boolean(scope&&scope.end-scope.start<=scopeLimit);
    const primary=scopeComplete?scope:window(bytes,at,end,scopeLimit);
    const chosen=[source(side,input.path,primary,scopeComplete?'enclosing-declaration':'focal-window',{scope_complete:scopeComplete})];
    if(!scopeComplete)diagnostics.push({side,reason:scope?'oversized-enclosing-declaration':'no-enclosing-declaration',fallback:'focal-window'});
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
    // Match actual source-text bytes, not merely a common maximum. UTF-8 boundaries
    // may reduce the local window by at most a few bytes; report that discrepancy.
    const nearby=window(bytes,at,end,used);
    selected.push(...chosen);local.push(source(side,input.path,nearby,'length-matched-local-window'));
  }
  const size=xs=>xs.reduce((n,s)=>n+Buffer.byteLength(s.text),0);
  assert(selected.length<=2*SOURCE_CAP&&size(selected)<=CAP);
  return {contexts:{selected,'local-context':local},retrieval:{method:'sparse-go-package-candidates/1',language:'Go',max_sources:2*SOURCE_CAP,budget_bytes:CAP,selected_bytes:size(selected),local_bytes:size(local),byte_budget_exact:size(selected)===size(local),diagnostics,library_sha256:hash(readFileSync(library)),limitations:['lexical candidates, not semantic name binding','same-package only; imported definitions not resolved','empty hunks require explicit parent ranges','local UTF-8 boundary rounding is reported']}};
}
