// Acquisition only: original Git cases, existing unit tests, no model requests.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,rmSync,cpSync,symlinkSync,chmodSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {git,hash,treeHash,safePath,parseTree,evaluate,verifyGitCase} from './v3-data.mjs';
import {sourceHashes} from './v3.mjs';
const root=resolve(import.meta.dirname,'../..');
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
export function extractTrackedTree(directory,commit,destination){
  assert.equal(readdirSync(destination).length,0,'extraction requires an empty directory');
  const missing=git(directory,'rev-list','--objects','--no-walk','--missing=print',commit).toString().split('\n').filter(line=>line.startsWith('?')).map(line=>{
    assert(/^\?[a-f0-9]{40}$/.test(line),'invalid missing Git object');return line.slice(1);
  });
  if(missing.length)execFileSync('git',['-C',directory,'-c','gc.auto=0','fetch','--no-tags','--no-write-fetch-head','--stdin','origin'],{input:missing.join('\n')+'\n',maxBuffer:4*1024*1024,timeout:120000});
  const entries=git(directory,'ls-tree','-r','-l','-z',commit).toString().split('\0').filter(Boolean).map(entry=>{
    const m=entry.match(/^(100644|100755|120000) blob ([a-f0-9]{40}) +(\d+)\t([\s\S]+)$/);
    assert(m,'unsupported tracked tree entry');assert(+m[3]<=32*1024*1024,'tracked blob exceeds existing Git read limit');
    return {mode:m[1],oid:m[2],size:+m[3],path:safePath(m[4])};
  });
  // Write links last so no blob extraction can traverse a newly created link.
  entries.sort((a,b)=>(a.mode==='120000')-(b.mode==='120000'));
  for(let first=0;first<entries.length;){
    let end=first,total=0;
    while(end<entries.length&&(end===first||total+entries[end].size+100<=16*1024*1024)){total+=entries[end].size+100;end++;}
    const group=entries.slice(first,end),batch=execFileSync('git',['-C',directory,'cat-file','--batch'],{input:group.map(e=>e.oid+'\n').join(''),maxBuffer:64*1024*1024,timeout:30000});
    let offset=0;
    for(const e of group){
      const newline=batch.indexOf(10,offset);assert(newline>=offset,'missing Git object header');
      assert.equal(batch.subarray(offset,newline).toString(),`${e.oid} blob ${e.size}`);
      const bytes=batch.subarray(newline+1,newline+1+e.size);assert.equal(bytes.length,e.size);offset=newline+1+e.size;assert.equal(batch[offset++],10);
      const path=join(destination,e.path);mkdirSync(dirname(path),{recursive:true});
      if(e.mode==='120000')symlinkSync(bytes.toString(),path);
      else {writeFileSync(path,bytes,{flag:'wx'});chmodSync(path,e.mode==='100755'?0o755:0o644);}
    }
    assert.equal(offset,batch.length,'unexpected Git object output');first=end;
  }
  return treeHash(destination);
}
export function packageCwd(path){return `cd '${join('/work',dirname(safePath(path))).replaceAll("'", "'\\''")}'\n`;}
export function chooseBase(bases,reported){
  assert(bases.length&&bases.every(b=>/^[a-f0-9]{40}$/.test(b)),'invalid Git merge bases');
  if(reported){assert(bases.includes(reported),'reported base is not a Git merge base');return reported;}
  assert.equal(bases.length,1,'missing base metadata with multiple Git merge bases');return bases[0];
}

export function mutations(file,start,end,library){
  const bytes=Buffer.from(file),nodes=parseTree(file,'Go',library),changes=[];
  assert(!nodes.some(n=>n.type==='ERROR'&&n.start<end&&n.end>start),'parse error in focal span');
  const add=(at,to,value)=>{if(at>=start&&to<=end)changes.push({start:at,end:to,value});};
  for(const n of nodes){
    if(n.start<start||n.end>end)continue;
    if(n.field==='condition'){add(n.start,n.end,'true');add(n.start,n.end,'false');add(n.start,n.end,`!(${n.text})`);}
    if(n.type==='true'||n.type==='false')add(n.start,n.end,n.type==='true'?'false':'true');
    if(n.type==='int_literal')add(n.start,n.end,n.text==='0'?'1':'0');
    if(n.type==='binary_expression'){
      const left=nodes.find(x=>x.field==='left'&&x.start===n.start&&x.end<n.end);
      const right=nodes.find(x=>x.field==='right'&&x.end===n.end&&x.start>n.start);
      if(!left||!right)continue;
      const gap=bytes.subarray(left.end,right.start).toString(),operator=gap.trim();
      const replacement={'==':'!=','!=':'==','<':'>=','>':'<=','<=':'>','>=':'<','&&':'||','||':'&&'}[operator];
      if(replacement){const at=left.end+Buffer.byteLength(gap.slice(0,gap.indexOf(operator)));add(at,at+operator.length,replacement);add(n.start,n.end,'true');add(n.start,n.end,'false');}
    }
  }
  const unique=new Map();
  for(const c of changes.sort((a,b)=>a.start-b.start||a.end-b.end)){
    const resolution=Buffer.concat([bytes.subarray(start,c.start),Buffer.from(c.value),bytes.subarray(c.end,end)]).toString();
    unique.set(hash(resolution),{name:`token-${c.start-start}-${c.value}`,resolution});
  }
  return [...unique.values()].slice(0,8);
}

export async function screen(configPath){
  const config=JSON.parse(readFileSync(configPath)),out=resolve(config.output),sources=readFileSync(config.triples);
  assert(!existsSync(out),'new screening directory required');mkdirSync(out,{recursive:true});
  const library=join(root,'.do-not-commit/h0-v3-tools/go.so');
  const frozen={config,source_sha256:hash(sources),script_sha256:hash(readFileSync(import.meta.filename)),instrument_hashes:sourceHashes(),parser_sha256:hash(readFileSync(library)),legacy_gopath_sha256:config.legacy_gopath?treeHash(resolve(config.legacy_gopath)):null,created_at:new Date().toISOString(),selection:'one eligible production Go hunk per event, event/path/ordinal order, target package unit tests, before model outcomes',missing_base_text:'Normalize null to empty text; independent Git reproduction remains mandatory',max_reference_bytes:8192,mutation_limit:8,model_calls:0};save(join(out,'freeze.json'),frozen);
  assert(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(config.repo));assert(Number.isSafeInteger(config.limit)&&config.limit>0);
  const skip=new Set(config.exclude_events??[]),seen=new Set(),rows=[],accepted=[];
  const triples=sources.toString().trim().split('\n').filter(Boolean).map(JSON.parse).map(t=>({...t,base:t.base??''})).sort((a,b)=>a.merge_sha.localeCompare(b.merge_sha)||a.path.localeCompare(b.path)||a.ordinal-b.ordinal);
  const frame=[];
  for(const t of triples){let reason=null;
    assert(/^[a-f0-9]{40}$/.test(t.merge_sha),'invalid merge SHA');safePath(t.path);
    if(skip.has(t.merge_sha))reason='existing-admission-or-exposure';
    else if(!t.path.endsWith('.go')||t.path.endsWith('_test.go'))reason='outside-production-go-screen';
    else if(typeof t.ours!=='string'||typeof t.theirs!=='string'||!t.resolution||Buffer.byteLength(t.resolution)>frozen.max_reference_bytes)reason='missing-parent-or-empty-reference-or-over-8192-byte-screen';
    else if(seen.has(t.merge_sha))reason='one-hunk-per-event-screen';
    if(!reason){try{const file=git(resolve(config.repository),'show',`${t.merge_sha}:${safePath(t.path)}`),start=file.indexOf(Buffer.from(t.resolution));assert(start>=0&&file.indexOf(Buffer.from(t.resolution),start+1)<0,'ambiguous reference occurrence');assert(mutations(file.toString(),start,start+Buffer.byteLength(t.resolution),library).length>=2,'fewer than two available token mutations');}catch(e){reason=e.message;}}
    if(!reason)seen.add(t.merge_sha);
    frame.push({event:t.merge_sha,path:t.path,ordinal:t.ordinal,reason});
  }
  const selected=frame.filter(x=>!x.reason).slice(0,config.limit);save(join(out,'frame.json'),{rows:frame,selected});
  for(const chosen of selected){
    const t=triples.find(x=>x.merge_sha===chosen.event&&x.path===chosen.path&&x.ordinal===chosen.ordinal),dir=join(out,t.merge_sha),scaffold=join(dir,'scaffold'),oracle=join(dir,'oracle');mkdirSync(scaffold,{recursive:true});mkdirSync(oracle);
    const record={...chosen,status:'started',attempts:[]};rows.push(record);save(join(out,'screening.json'),rows);
    try{
      const directory=resolve(config.repository),parents=git(directory,'show','-s','--format=%P',t.merge_sha).toString().trim().split(' ');assert.equal(parents.length,2);
      const base=chooseBase(git(directory,'merge-base','--all',...parents).toString().trim().split('\n'),t.base_reachability?.base_sha);record.base_resolution={base,source:t.base_reachability?.base_sha?'verified-materializer-metadata':'unique-native-git-merge-base'};
      const shipped=git(directory,'show',`${t.merge_sha}:${safePath(t.path)}`),start=shipped.indexOf(Buffer.from(t.resolution)),end=start+Buffer.byteLength(t.resolution);assert(start>=0&&shipped.indexOf(Buffer.from(t.resolution),start+1)<0,'ambiguous reference occurrence');
      const mutants=mutations(shipped.toString(),start,end,library);assert(mutants.length>=2,'fewer than two available token mutations');
      extractTrackedTree(directory,t.merge_sha,scaffold);
      const moduleFiles=['go.mod','go.sum'].map(p=>[p,existsSync(join(scaffold,p))?readFileSync(join(scaffold,p)):null]);
      if(moduleFiles[0][1]){
        const env={PATH:process.env.PATH,HOME:dir,GOTOOLCHAIN:'local',GOMODCACHE:join(out,'module-cache'),GOCACHE:join(out,'go-cache'),GOPROXY:'https://proxy.golang.org',GOSUMDB:'sum.golang.org'};
        for(const args of [['mod','download','all'],['mod','vendor']]){const r=spawnSync('go',args,{cwd:scaffold,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});record.attempts.push({command:['go',...args],status:r.status,error:r.error?.message,stdout:r.stdout,stderr:r.stderr});assert(!r.error&&r.status===0,'dependency acquisition failed');}
        for(const [p,b]of moduleFiles){if(b)writeFileSync(join(scaffold,p),b);else rmSync(join(scaffold,p),{force:true});}
      }
      const localSources=readdirSync(scaffold).filter(p=>p.endsWith('.go')).map(p=>readFileSync(join(scaffold,p),'utf8')).join('\n');
      const importPath=config.legacy_import_path??(localSources.includes('"github.com/codegangsta/cli"')?'github.com/codegangsta/cli':`github.com/${config.repo}`);
      safePath(importPath);assert(/^[a-zA-Z0-9_./-]+$/.test(importPath),'invalid legacy import path');
      if(!moduleFiles[0][1]&&config.legacy_gopath){assert.equal(treeHash(resolve(config.legacy_gopath)),frozen.legacy_gopath_sha256,'legacy dependency drift');cpSync(resolve(config.legacy_gopath),join(oracle,'legacy'),{recursive:true,verbatimSymlinks:true});record.legacy_gopath_sha256=treeHash(join(oracle,'legacy'));assert.equal(record.legacy_gopath_sha256,frozen.legacy_gopath_sha256);}
      let compatibility='';
      if(config.repo==='urfave/cli'&&existsSync(join(scaffold,'app_test.go'))){
        const original=readFileSync(join(scaffold,'app_test.go'));
        const declarations=parseTree(original.toString(),'Go',library).filter(n=>n.type==='var_declaration'&&n.text==='var parsedOption, firstArg string').sort((a,b)=>b.end-a.end);
        if(declarations.length){let patched=original;for(const declaration of declarations)patched=Buffer.concat([patched.subarray(0,declaration.end),Buffer.from('\n\t_ = parsedOption; _ = firstArg'),patched.subarray(declaration.end)]);writeFileSync(join(oracle,'compat_app_test.go'),patched);record.test_compatibility={path:'app_test.go',source_sha256:hash(original),patched_sha256:hash(patched),declarations:declarations.length,change:'Add blank-identifier uses to two declared string locals; no assertion or control-flow changes.'};compatibility='cp /oracle/compat_app_test.go /work/app_test.go\n';}
      }
      const env='export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath'+(!moduleFiles[0][1]&&config.legacy_gopath?':/oracle/legacy':'')+(moduleFiles[0][1]?" GOFLAGS='-mod=vendor'":' GO111MODULE=off');
      const mapping=moduleFiles[0][1]?'':`mkdir -p /tmp/gopath/src/${dirname(importPath)}\nln -s /work /tmp/gopath/src/${importPath}\n`;
      writeFileSync(join(oracle,'build.sh'),`#!/bin/sh\nset -eu\n${env}\n${mapping}${compatibility}${packageCwd(t.path)}go test -vet=off -c -o /work/h0.test\n`);
      writeFileSync(join(oracle,'test.sh'),`#!/bin/sh\nset -eu\n${env}\n${mapping}${packageCwd(t.path)}exec /work/h0.test -test.v -test.run '^Test'\n`);
      const marker='<<<<<<< ours\n'+t.ours+'||||||| base\n'+t.base+'=======\n'+t.theirs+'>>>>>>> theirs\n',target=Buffer.concat([shipped.subarray(0,start),Buffer.from(marker),shipped.subarray(end)]);writeFileSync(join(scaffold,t.path),target);
      const c={repo:config.repo,event:t.merge_sha,group_id:`${config.repo}:${t.merge_sha}`,language:'Go',path:t.path,base:t.base,ours:t.ours,theirs:t.theirs,reference:t.resolution,git:{directory,base,ours:parents[0],theirs:parents[1]},evaluator:{scaffold,oracle,target:t.path,start_byte:start,end_byte:start+Buffer.byteLength(marker),preimage_sha256:hash(target),scaffold_sha256:treeHash(scaffold),oracle_sha256:treeHash(oracle),build:['/bin/sh','/oracle/build.sh'],test:['/bin/sh','/oracle/test.sh'],test_completion:[{pattern:'^PASS$',count:1}]},mutations:[]};
      record.git_validation=verifyGitCase(c);record.reference=evaluate(c,c.reference);assert(record.reference.pass,'reference does not pass existing unit tests');
      const count=(record.reference.stages[1].stdout.match(/^--- PASS: Test/gm)??[]).length;assert(count>0,'no passing unit tests');c.evaluator.test_completion.push({pattern:'^--- PASS: Test',count});record.mutations=[];
      for(const mutant of mutants){const result=evaluate(c,mutant.resolution);record.mutations.push({name:mutant.name,resolution_sha256:hash(mutant.resolution),...result});if(result.category==='test-failure')c.mutations.push(mutant);if(c.mutations.length===2)break;}
      assert(c.mutations.length===2,'unit tests did not reject two compiling mutants');
      save(join(dir,'case.json'),[c]);accepted.push(c);record.status='screen-passed-not-yet-admitted';record.manifest=join(dir,'case.json');
    }catch(e){record.status='excluded';record.reason=e.message;}
    save(join(dir,'receipt.json'),record);save(join(out,'screening.json'),rows);save(join(out,'candidates.json'),accepted);console.log(JSON.stringify({event:record.event,status:record.status,reason:record.reason,screen_passed:accepted.length}));
  }
  return {screened:rows.length,passed:accepted.length,output:out};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(await screen(process.argv[2]));}catch(e){console.error(e);process.exitCode=1;}}
