// Git-only retrieval and networkless execution for H0 v3. No provider credentials here.
import {readFileSync,writeFileSync,readdirSync,lstatSync,mkdtempSync,rmSync,cpSync,existsSync,readlinkSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join,extname,isAbsolute,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {localizeConflictPathEvidence} from '../../packages/core/dist/evaluation/localize.js';

export const hash=x=>createHash('sha256').update(x).digest('hex');
export const git=(directory,...args)=>execFileSync('git',['-C',directory,...args],{maxBuffer:32*1024*1024,timeout:30000});
export const BUDGET=32768;
export function environmentHash(){
  const tools=['git','tree-sitter','bwrap','diff3','mergiraf','cc','cmake','make','go'];
  const files=tools.map(t=>{const p=execFileSync('/bin/sh',['-c',`command -v ${t}`],{encoding:'utf8'}).trim();return[p,hash(readFileSync(p))];});
  const packages=execFileSync('pacman',['-Q'],{maxBuffer:4*1024*1024}).toString();
  return hash(JSON.stringify({files,packages,node:process.version}));
}
export function verifyGitCase(c){
  safePath(c.path);const g=c.git,d=mkdtempSync(join(tmpdir(),'mrgr-v3-git-'));
  try{
    const blobs={};for(const side of ['base','ours','theirs']){
      const absentBase=side==='base'&&git(g.directory,'ls-tree','-z',g.base,'--',c.path).length===0;
      blobs[side]=absentBase?Buffer.alloc(0):git(g.directory,'show',`${g[side]}:${c.path}`);writeFileSync(join(d,side),blobs[side]);
    }
    const shipped=git(g.directory,'show',`${c.event}:${c.path}`);
    const merged=spawnSync('git',['merge-file','--diff3','--diff-algorithm=myers','-p',join(d,'ours'),join(d,'base'),join(d,'theirs')],{timeout:30000,maxBuffer:16*1024*1024});
    assert(!merged.error&&merged.status>0&&merged.status<=127,'not a reproducible textual conflict');
    writeFileSync(join(d,'automatic'),merged.stdout);writeFileSync(join(d,'shipped'),shipped);
    const diff=spawnSync('git',['diff','--no-index','--no-ext-diff','--unified=0','--',join(d,'automatic'),join(d,'shipped')],{timeout:30000,maxBuffer:16*1024*1024});assert(diff.status===1&&!diff.error);
    const localized=localizeConflictPathEvidence({path:c.path,conflictKind:'CONFLICT (content)',stageOids:{base:null,ours:null,theirs:null},automaticBlob:merged.stdout,shippedBlob:shipped,diff:diff.stdout});
    assert(localized.ok,'localization failed');
    const record=localized.value.find(r=>r.localizationStatus==='exact'&&['base','ours','theirs','resolution'].every(k=>r.rawDigests[k]===hash(k==='resolution'?c.reference:c[k])));
    assert(record,'supplied hunk/reference does not match independently localized Git conflict');
    const lines=shipped.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[],range=record.resolutionRange;
    const start=Buffer.byteLength(lines.slice(0,range.startLine-1).join('')),end=Buffer.byteLength(lines.slice(0,range.endLineExclusive-1).join(''));
    assert.equal(c.evaluator.target,c.path);assert.equal(c.evaluator.start_byte,start);assert.equal(end-start,Buffer.byteLength(c.reference));
    const target=readFileSync(join(c.evaluator.scaffold,c.evaluator.target)),restored=applyCandidate(target,c.evaluator.start_byte,c.evaluator.end_byte,c.reference);
    assert(shipped.equals(restored),'reference application differs from common Git scaffold');
    const tracked=git(g.directory,'ls-tree','-r','-z',c.event).toString('utf8').split('\0').filter(Boolean);
    for(const entry of tracked){const m=entry.match(/^([0-7]+) (\w+) ([0-9a-f]+)\t([\s\S]+)$/);assert(m);if(m[2]!=='blob')continue;const path=join(c.evaluator.scaffold,safePath(m[4]));const stat=lstatSync(path);assert.equal(stat.isSymbolicLink(),m[1]==='120000',`scaffold mode drift: ${m[4]}`);const bytes=m[4]===c.path?restored:stat.isSymbolicLink()?Buffer.from(readlinkSync(path)):readFileSync(path);const oid=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(oid,m[3],`tracked scaffold drift: ${m[4]}`);}
    return {automatic_sha256:hash(merged.stdout),shipped_sha256:hash(shipped),localized:record,tracked_files:tracked.length,parents:g,reference_sha256:hash(c.reference)};
  }finally{rmSync(d,{recursive:true,force:true});}
}
export function safePath(p){assert(typeof p==='string'&&p.length&&!isAbsolute(p)&&!p.split(/[\\/]/).some(x=>x==='..'||x==='.git')&&!p.includes('\0'),'unsafe path');return p;}
export function treeHash(directory){
  const entries=[];
  function walk(d,p=''){for(const n of readdirSync(d).sort()){if(n==='.git')continue;const f=join(d,n),rel=p?`${p}/${n}`:n,s=lstatSync(f);if(s.isSymbolicLink()){const target=readlinkSync(f);assert(!isAbsolute(target)&&resolve(dirname(f),target).startsWith(resolve(directory)+sep),'escaping evaluator symlink');entries.push([rel,'symlink',target]);}else if(s.isDirectory())walk(f,rel);else{assert(s.isFile(),'non-regular evaluator input');entries.push([rel,s.mode&0o777,hash(readFileSync(f))]);}}}
  walk(directory);return hash(JSON.stringify(entries));
}
function clipped(text,n){let b=Buffer.from(text).subarray(0,n);while(b.length&&Buffer.from(b.toString('utf8')).compare(b)!==0)b=b.subarray(0,b.length-1);return b.toString('utf8');}
export function budget(sources){let left=BUDGET;return sources.flatMap(s=>{if(!left)return[];const text=clipped(s.text,left);left-=Buffer.byteLength(text);return[{...s,text,truncated:text!==s.text}];});}

// CLI syntax ranges are byte columns. Identifier matching is a conservative candidate
// lookup, not name resolution or a semantic dependency proof.
export function parseTree(text,language,library){
  assert(['C','Go'].includes(language),'v3 retrieval currently admits C and Go only');
  const d=mkdtempSync(join(tmpdir(),'mrgr-v3-parse-'));
  try{
    const f=join(d,language==='C'?'input.c':'input.go');writeFileSync(f,text);
    const r=spawnSync('tree-sitter',['parse','--lib-path',library,'--lang-name',language==='C'?'c':'go',f],{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
    assert(!r.error&&[0,1].includes(r.status)&&r.stdout.includes('['),'source parse failed');
    const bytes=Buffer.from(text),starts=[0];for(let i=0;i<bytes.length;i++)if(bytes[i]===10)starts.push(i+1);
    return r.stdout.split('\n').flatMap(line=>{const m=line.match(/\(([\w]+) \[(\d+), (\d+)\] - \[(\d+), (\d+)\]/);if(!m)return[];const start=starts[+m[2]]+(+m[3]),end=starts[+m[4]]+(+m[5]);return[{type:m[1],field:line.match(/(\w+): \(/)?.[1]??null,start,end,text:bytes.subarray(start,end).toString('utf8')}];});
  }finally{rmSync(d,{recursive:true,force:true});}
}
const identifiers=nodes=>new Set(nodes.filter(n=>/identifier$/.test(n.type)).map(n=>n.text));
const declarations=nodes=>nodes.filter(n=>/^(function_definition|function_declaration|method_declaration|type_declaration|declaration|const_declaration|var_declaration)$/.test(n.type)&&!nodes.some(e=>e.type==='ERROR'&&e.start<n.end&&e.end>n.start));
export function context(input,libraries){
  const selected=[],local=[],unresolved=[],g=input.git;
  for(const side of ['ours','theirs']){
    assert(/^[a-f0-9]{40}$/.test(g[side]));safePath(input.path);
    const file=git(g.directory,'show',`${g[side]}:${input.path}`).toString('utf8'),needle=input[side],at=Buffer.from(file).indexOf(Buffer.from(needle));
    assert(needle.length&&at>=0&&Buffer.from(file).indexOf(Buffer.from(needle),at+1)<0,'ambiguous parent localization');
    const nodes=parseTree(file,input.language,libraries[input.language]);
    for(const n of nodes.filter(n=>n.type==='ERROR'))unresolved.push({side,path:input.path,reason:'syntax-error-range',start_byte:n.start,end_byte:n.end});
    const scope=declarations(nodes).filter(n=>n.start<=at&&n.end>=at+Buffer.byteLength(needle)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
    const source=(path,text,start,rank)=>({id:hash(`${g[side]}:${path}:${start}`).slice(0,24),revision:g[side],path,start_byte:start,text,rank});
    if(scope)selected.push(source(input.path,scope.text,scope.start,0));
    const bytes=Buffer.from(file),start=Math.max(0,at-8192);local.push(source(input.path,bytes.subarray(start,Math.min(bytes.length,start+16384)).toString('utf8'),start,0));
    const refs=identifiers(nodes.filter(n=>n.start>=(scope?.start??at)&&n.end<=(scope?.end??at+Buffer.byteLength(needle))));
    const paths=git(g.directory,'ls-tree','-r','--name-only','-z',g[side]).toString('utf8').split('\0').filter(p=>p&&extname(p)===(input.language==='C'?'.c':'.go')||p&&input.language==='C'&&extname(p)==='.h').sort();
    const found=new Map();
    for(const path of paths){
      if(/(^|\/)(vendor|third_party|generated)\/|\.gen\./i.test(path))continue;
      const text=path===input.path?file:git(g.directory,'show',`${g[side]}:${path}`).toString('utf8');
      if(Buffer.byteLength(text)>1024*1024||![...refs].some(id=>text.includes(id)))continue;
      let ns;try{ns=path===input.path?nodes:parseTree(text,input.language,libraries[input.language]);}catch{unresolved.push({side,path,reason:'parse-failed'});continue;}
      for(const n of declarations(ns)){
        if(path===input.path&&scope&&n.start===scope.start&&n.end===scope.end)continue;
        const ids=identifiers(ns.filter(x=>x.start>=n.start&&x.end<=n.end));const overlap=[...refs].filter(id=>ids.has(id));if(!overlap.length)continue;
        const test=/(^|\/)(test|tests)\/|_test\.|test_/.test(path);
        const name=ns.find(x=>x.type==='identifier'&&['name','declarator'].includes(x.field)&&x.start>=n.start&&x.end<=n.end)?.text;
        const rank=test?3:refs.has(name)?1:2;
        if(rank===1){const hits=found.get(name)??[];hits.push({path,start:n.start});found.set(name,hits);}
        selected.push(source(path,n.text,n.start,rank));
      }
    }
    for(const id of refs)if(!found.has(id))unresolved.push({side,identifier:id,reason:'no-unique-declaration-established'});else if(found.get(id).length>1)unresolved.push({side,identifier:id,reason:'ambiguous',candidates:found.get(id)});
  }
  const order=(a,b)=>a.rank-b.rank||a.revision.localeCompare(b.revision)||a.path.localeCompare(b.path)||a.start_byte-b.start_byte;
  return {contexts:{'local-context':budget(local),'selected':budget([...new Map(selected.sort(order).map(s=>[s.id,s])).values()])},retrieval:{unresolved,method:'syntax-ranges-and-identifier-candidates/1',budget_bytes:BUDGET,libraries:Object.fromEntries(Object.entries(libraries).map(([k,p])=>[k,hash(readFileSync(p))]))}};
}

export function applyCandidate(original,start,end,replacement){
  assert(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&end<=original.length);
  assert(typeof replacement==='string');return Buffer.concat([original.subarray(0,start),Buffer.from(replacement),original.subarray(end)]);
}
export function evaluate(input,resolution){
  const e=input.evaluator;safePath(e.target);
  if(e.environment_sha256)assert.equal(environmentHash(),e.environment_sha256,'toolchain/package environment drift');
  assert(treeHash(e.scaffold)===e.scaffold_sha256&&treeHash(e.oracle)===e.oracle_sha256,'evaluator inputs drifted');
  const original=readFileSync(join(e.scaffold,e.target));assert(hash(original)===e.preimage_sha256,'target preimage drifted');
  const d=mkdtempSync(join(tmpdir(),'mrgr-v3-eval-')),work=join(d,'work');
  try{
    cpSync(e.scaffold,work,{recursive:true,verbatimSymlinks:true,filter:p=>!p.split('/').includes('.git')});
    writeFileSync(join(work,e.target),applyCandidate(original,e.start_byte,e.end_byte,resolution));
    const candidate_sha256=hash(readFileSync(join(work,e.target)));
    const args=['--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL','--ro-bind','/usr','/usr','--symlink','usr/bin','/bin','--symlink','usr/lib','/lib','--symlink','usr/lib','/lib64','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--bind',work,'/work','--ro-bind',resolve(e.oracle),'/oracle','--chdir','/work','--clearenv','--setenv','PATH','/usr/bin:/bin','--setenv','HOME','/tmp','--setenv','LC_ALL','C','--setenv','TZ','UTC'];
    const stages=[];
    for(const [stage,command] of [['build',e.build],['test',e.test]]){
      assert(Array.isArray(command)&&command.length&&command.every(s=>typeof s==='string'),'invalid evaluator command');
      const r=spawnSync('/usr/bin/bwrap',[...args,...command],{encoding:'utf8',timeout:e.timeout_ms??120000,maxBuffer:8*1024*1024,env:{PATH:'/usr/bin:/bin'}});
      stages.push({stage,command,status:r.status,signal:r.signal,error:r.error?.message??null,stdout:r.stdout??'',stderr:r.stderr??''});
      if(r.error||r.signal||r.status!==0)return {pass:false,category:r.error||r.signal||/^bwrap:/m.test(r.stderr??'')?'environment-error':`${stage}-failure`,candidate_sha256,environment_sha256:e.environment_sha256??null,stages};
    }
    assert(Array.isArray(e.test_completion)&&e.test_completion.length,'missing test completion contract');
    const output=stages[1].stdout+'\n'+stages[1].stderr;
    const completion=e.test_completion.map(c=>{assert(typeof c.pattern==='string'&&Number.isSafeInteger(c.count)&&c.count>0);const count=[...output.matchAll(new RegExp(c.pattern,'gm'))].length;return {...c,observed:count,pass:count===c.count};});
    if(!completion.every(c=>c.pass))return {pass:false,category:'test-failure',reason:'test-completion-contract',candidate_sha256,environment_sha256:e.environment_sha256??null,stages,completion};
    return {pass:true,category:'behavioral-pass',candidate_sha256,environment_sha256:e.environment_sha256??null,stages,completion};
  }finally{rmSync(d,{recursive:true,force:true});}
}
export function validateOracle(input){
  assert(Array.isArray(input.mutations)&&input.mutations.length>=2,'need discriminating wrong candidates');
  const reference=Array.from({length:3},()=>evaluate(input,input.reference));
  const mutations=input.mutations.map(m=>({name:m.name,...evaluate(input,m.resolution)}));
  return {valid:reference.every(r=>r.pass)&&mutations.every(r=>r.category==='test-failure'),reference,mutations};
}
