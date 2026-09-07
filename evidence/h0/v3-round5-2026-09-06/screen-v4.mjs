// Acquisition only: original Git cases, existing unit tests, no model requests.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {git,hash,treeHash,safePath,parseTree,evaluate,verifyGitCase} from './v3-data.mjs';
const root=resolve(import.meta.dirname,'../..');
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
export function packageCwd(path){return `cd '${join('/work',dirname(safePath(path))).replaceAll("'", "'\\''")}'\n`;}

export function mutations(file,start,end,library){
  const bytes=Buffer.from(file),nodes=parseTree(file,'Go',library),changes=[];
  assert(!nodes.some(n=>n.type==='ERROR'&&n.start<end&&n.end>start),'parse error in focal span');
  const add=(at,to,value)=>{if(at>=start&&to<=end)changes.push({start:at,end:to,value});};
  for(const n of nodes){
    if(n.start<start||n.end>end)continue;
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
  const frozen={config,source_sha256:hash(sources),script_sha256:hash(readFileSync(import.meta.filename)),parser_sha256:hash(readFileSync(library)),created_at:new Date().toISOString(),selection:'one eligible production Go hunk per event, event/path/ordinal order, target package unit tests, before model outcomes',mutation_limit:8,model_calls:0};save(join(out,'freeze.json'),frozen);
  assert(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(config.repo));assert(Number.isSafeInteger(config.limit)&&config.limit>0);
  const skip=new Set(config.exclude_events??[]),seen=new Set(),rows=[],accepted=[];
  const triples=sources.toString().trim().split('\n').filter(Boolean).map(JSON.parse).sort((a,b)=>a.merge_sha.localeCompare(b.merge_sha)||a.path.localeCompare(b.path)||a.ordinal-b.ordinal);
  const frame=[];
  for(const t of triples){let reason=null;
    assert(/^[a-f0-9]{40}$/.test(t.merge_sha),'invalid merge SHA');safePath(t.path);
    if(skip.has(t.merge_sha))reason='existing-admission-or-exposure';
    else if(!t.path.endsWith('.go')||t.path.endsWith('_test.go'))reason='outside-production-go-screen';
    else if(!t.ours||!t.theirs||!t.resolution||Buffer.byteLength(t.resolution)>3000)reason='empty-side-or-reference-or-over-3000-byte-screen';
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
      const shipped=git(directory,'show',`${t.merge_sha}:${safePath(t.path)}`),start=shipped.indexOf(Buffer.from(t.resolution)),end=start+Buffer.byteLength(t.resolution);assert(start>=0&&shipped.indexOf(Buffer.from(t.resolution),start+1)<0,'ambiguous reference occurrence');
      const mutants=mutations(shipped.toString(),start,end,library);assert(mutants.length>=2,'fewer than two available token mutations');
      const archive=git(directory,'archive',t.merge_sha);execFileSync('tar',['-x','--no-same-owner','-C',scaffold],{input:archive});treeHash(scaffold);
      const moduleFiles=['go.mod','go.sum'].map(p=>[p,existsSync(join(scaffold,p))?readFileSync(join(scaffold,p)):null]);
      if(moduleFiles[0][1]){
        const env={PATH:process.env.PATH,HOME:dir,GOTOOLCHAIN:'local',GOMODCACHE:join(out,'module-cache'),GOCACHE:join(out,'go-cache'),GOPROXY:'https://proxy.golang.org',GOSUMDB:'sum.golang.org'};
        for(const args of [['mod','download','all'],['mod','vendor']]){const r=spawnSync('go',args,{cwd:scaffold,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});record.attempts.push({command:['go',...args],status:r.status,error:r.error?.message,stdout:r.stdout,stderr:r.stderr});assert(!r.error&&r.status===0,'dependency acquisition failed');}
        for(const [p,b]of moduleFiles){if(b)writeFileSync(join(scaffold,p),b);else rmSync(join(scaffold,p),{force:true});}
      }
      const localSources=readdirSync(scaffold).filter(p=>p.endsWith('.go')).map(p=>readFileSync(join(scaffold,p),'utf8')).join('\n');
      const importPath=localSources.includes('"github.com/codegangsta/cli"')?'github.com/codegangsta/cli':`github.com/${config.repo}`;
      let compatibility='';
      if(config.repo==='urfave/cli'&&existsSync(join(scaffold,'app_test.go'))){
        const original=readFileSync(join(scaffold,'app_test.go'));
        const declarations=parseTree(original.toString(),'Go',library).filter(n=>n.type==='var_declaration'&&n.text==='var parsedOption, firstArg string').sort((a,b)=>b.end-a.end);
        if(declarations.length){let patched=original;for(const declaration of declarations)patched=Buffer.concat([patched.subarray(0,declaration.end),Buffer.from('\n\t_ = parsedOption; _ = firstArg'),patched.subarray(declaration.end)]);writeFileSync(join(oracle,'compat_app_test.go'),patched);record.test_compatibility={path:'app_test.go',source_sha256:hash(original),patched_sha256:hash(patched),declarations:declarations.length,change:'Add blank-identifier uses to two declared string locals; no assertion or control-flow changes.'};compatibility='cp /oracle/compat_app_test.go /work/app_test.go\n';}
      }
      const env='export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath'+(moduleFiles[0][1]?" GOFLAGS='-mod=vendor'":' GO111MODULE=off');
      const mapping=moduleFiles[0][1]?'':`mkdir -p /tmp/gopath/src/${importPath.slice(0,importPath.lastIndexOf('/'))}\nln -s /work /tmp/gopath/src/${importPath}\n`;
      writeFileSync(join(oracle,'build.sh'),`#!/bin/sh\nset -eu\n${env}\n${mapping}${compatibility}${packageCwd(t.path)}go test -vet=off -c -o /work/h0.test\n`);
      writeFileSync(join(oracle,'test.sh'),`#!/bin/sh\nset -eu\n${env}\n${mapping}${packageCwd(t.path)}exec /work/h0.test -test.v -test.run '^Test'\n`);
      const marker='<<<<<<< ours\n'+t.ours+'||||||| base\n'+t.base+'=======\n'+t.theirs+'>>>>>>> theirs\n',target=Buffer.concat([shipped.subarray(0,start),Buffer.from(marker),shipped.subarray(end)]);writeFileSync(join(scaffold,t.path),target);
      const c={repo:config.repo,event:t.merge_sha,group_id:`${config.repo}:${t.merge_sha}`,language:'Go',path:t.path,base:t.base,ours:t.ours,theirs:t.theirs,reference:t.resolution,git:{directory,base:t.base_reachability.base_sha,ours:parents[0],theirs:parents[1]},evaluator:{scaffold,oracle,target:t.path,start_byte:start,end_byte:start+Buffer.byteLength(marker),preimage_sha256:hash(target),scaffold_sha256:treeHash(scaffold),oracle_sha256:treeHash(oracle),build:['/bin/sh','/oracle/build.sh'],test:['/bin/sh','/oracle/test.sh'],test_completion:[{pattern:'^PASS$',count:1}]},mutations:[]};
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
