import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {request,decode,rng,checkGroups,clustered,verdict,MODELS,BASELINES,ARMS,runProvider,aggregate,sourceHashes,fetchLineageMetadata} from './v3.mjs';
import {hash,budget,applyCandidate,safePath,treeHash,evaluate,verifyGitCase,context} from './v3-data.mjs';
import {simulate,wilsonLower,design} from './v3-design.mjs';
const root=resolve(import.meta.dirname,'../..');
const sample={id:'x',repo:'r',event:'e',group_id:'g',language:'C',path:'a.c',base:'a',ours:'b',theirs:'c',reference:'SECRET_REFERENCE',contexts:{'local-context':[{id:'p',text:'parent'}],selected:[{id:'q',text:'declaration'}]},evaluator:{secret:'HIDDEN_TEST'},git:{event:'FINAL_SHA'}};
const valid=resolution=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({decision:'resolve',resolution,citations:[]}),reasoning_content:'not replacement'}}],usage:{prompt_tokens:10,completion_tokens:10}});
test('provider requests whitelist sources and separate MiniMax reasoning',()=>{
 for(const p of Object.values(MODELS))for(const arm of ARMS){const req=request(sample,arm,p),text=JSON.stringify(req);assert(!text.includes('SECRET_REFERENCE'));assert(!text.includes('HIDDEN_TEST'));assert(!text.includes('FINAL_SHA'));assert.equal(text.includes('declaration'),arm==='selected');const user=req.messages[1].content;assert(user.includes('FOCAL_HUNKS\n'));assert.equal(user.includes('READ_ONLY_CONTEXT\n'),arm!=='hunk-only');if(arm!=='hunk-only')assert(user.indexOf('READ_ONLY_CONTEXT\n')>user.indexOf('"id":"theirs"'));}
 assert.equal(decode(valid('return 1;'),sample,'selected').parsed.resolution,'return 1;');
 assert.equal(decode({...valid('ok'),choices:[{finish_reason:'length',message:{content:'{}'}}]},sample,'selected').kind,'truncated');
 const fake=valid('ok');fake.choices[0].message.content=JSON.stringify({decision:'resolve',resolution:'x',citations:['invented']});assert.equal(decode(fake,sample,'selected').parsed,null);
 assert.equal(decode({base_resp:{status_code:1008},...valid('x')},sample,'selected').kind,'provider-error');
});
test('byte budgets and exact focal application preserve literal whitespace and surrounding bytes',()=>{
 const text='😀'.repeat(10000);const b=budget([{id:'x',text}])[0];assert(Buffer.byteLength(b.text)<=32768);assert(!b.text.includes('\ufffd'));
 assert.equal(applyCandidate(Buffer.from('pre\nold\npost\n'),4,8,' " a "\n').toString(),'pre\n " a "\npost\n');
 assert.throws(()=>applyCandidate(Buffer.from('a'),-1,1,''));assert.throws(()=>safePath('../outside'));assert.throws(()=>safePath('.git/config'));
});
test('PRNG diversity, event/content grouping, positive/null/harmful clustered rules',()=>{
 const r=rng();assert(new Set(Array.from({length:100},r)).size===100);
 assert.throws(()=>checkGroups([sample,{...sample,id:'y'}]));
 const rows=Array.from({length:240},(_,i)=>({repo:`repo${i%12}`,id:String(i),selected:true,...Object.fromEntries([...ARMS.filter(a=>a!=='selected'),...BASELINES].map(a=>[a,false]))}));
 const positive=verdict({mercury:rows,minimax:rows},{complete:true,eligible:true,integrity:true});assert.equal(positive.MEASURABLE,'YES');
 assert.equal(verdict({mercury:rows,minimax:rows},{complete:false,eligible:true,integrity:true}).MEASURABLE,'NO');
 const nullRows=rows.map(r=>({...r,selected:false}));assert.equal(verdict({mercury:rows,minimax:nullRows},{complete:true,eligible:true,integrity:true}).MEASURABLE,'NO');
 const harmful=rows.map(r=>({...r,selected:false,'hunk-only':true}));assert(clustered(harmful,['hunk-only'],100)['hunk-only'].upper<0);
});
test('power simulation executes the joint rule and rejects a feasibility pilot as development',()=>{
 const s=simulate(40,12,{repetitions:2,bootstrap:100});assert(s.joint_power>=0&&s.joint_power<=1);assert(s.joint_power_lower<=s.joint_power);assert(wilsonLower(200,200)>0.98);
 const d=fixture();try{writeFileSync(join(d,'aggregate.json'),JSON.stringify({complete:true,valid:true}));assert.throws(()=>design(d,[]),/60-case development/);}finally{rmSync(d,{recursive:true,force:true});}
});
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'mrgr-v3-test-'));const c={...sample,baselines:Object.fromEntries(BASELINES.map(k=>[k,{evaluation:{pass:false}}]))};
 writeFileSync(join(dir,'cases.json'),JSON.stringify([c]));
 const paths=['evidence/h0/v3.mjs','evidence/h0/v3-data.mjs','evidence/h0/v3-design.mjs','evidence/h0/v2.mjs','packages/mechanisms/dist/adapter.js','packages/mechanisms/dist/result.js'];
 const protocol={version:'h0-behavioral/3',mode:'feasibility',eligible:false,source_hashes:sourceHashes(),cases_sha256:hash(readFileSync(join(dir,'cases.json'))),models:MODELS,limits:{timeout_ms:1000}};
 writeFileSync(join(dir,'protocol.json'),JSON.stringify(protocol));return dir;
}
test('429 stops only its provider; resume never repeats completed answers; missing matrix never passes',async()=>{
 const dir=fixture();let calls=0;
 try{
  const limited=await runProvider(dir,'mercury',{key:'test-secret',fetcher:async()=>{calls++;return new Response('{"error":"limited"}',{status:429});}});
  assert.equal(limited.stopped,'429');assert.equal(calls,1);assert.equal(aggregate(dir).complete,false);
  const success=async(url,options)=>{assert(options.headers.Authorization==='Bearer test-secret');calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({decision:'halt',resolution:'',citations:[]})}}]}));};
  await runProvider(dir,'minimax',{key:'test-secret',fetcher:success});assert.equal(calls,4);await runProvider(dir,'minimax',{key:'test-secret',fetcher:success});assert.equal(calls,4);
  await runProvider(dir,'mercury',{key:'test-secret',fetcher:success});assert.equal(calls,7);
  const result=aggregate(dir);assert(result.complete);assert.equal(result.MEASURABLE,'NO');assert.equal(result.metrics.minimax.selected.halt,1);
  const p=join(dir,'minimax','x-selected.json'),record=JSON.parse(readFileSync(p));assert(!JSON.stringify(record).includes('test-secret'));record.request.messages[0].content='changed';writeFileSync(p,JSON.stringify(record));assert.throws(()=>aggregate(dir));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('transport failure is recorded without answer retry and remains in denominator',async()=>{
 const dir=fixture();try{let n=0;await runProvider(dir,'mercury',{key:'test',fetcher:async()=>{n++;throw new TypeError('network');}});assert.equal(n,3);const r=aggregate(dir);assert.equal(r.metrics.mercury.selected.invalid,1);assert.equal(r.metrics.mercury.selected.scheduled,1);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('an interrupted attempt is a terminal unknown, never an invisible paid retry',async()=>{
 const d=fixture();try{mkdirSync(join(d,'mercury'));writeFileSync(join(d,'mercury','x-selected.started'),JSON.stringify({request_sha256:hash(JSON.stringify(request(sample,'selected',MODELS.mercury)))}));let calls=0;await runProvider(d,'mercury',{key:'test',fetcher:async()=>{calls++;throw new TypeError('network');}});assert.equal(calls,2);assert.equal(JSON.parse(readFileSync(join(d,'mercury','x-selected.json'))).error,'interrupted-attempt-unknown-response');}finally{rmSync(d,{recursive:true,force:true});}
});
test('Git admission binds base, reference, focal range and all tracked scaffold content',()=>{
 const d=mkdtempSync(join(tmpdir(),'mrgr-v3-provenance-'));try{
  const repo=join(d,'repo'),scaffold=join(d,'scaffold');mkdirSync(repo);mkdirSync(scaffold);
  const g=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'}}).trim();
  g('init','-q');const commit=(text)=>{writeFileSync(join(repo,'a.c'),text);g('add','a.c');g('commit','-qm','fixture');return g('rev-parse','HEAD');};
  const base='int f(void) { return 0; }\n',ours=base.replace('0','1'),theirs=base.replace('0','2'),reference=base.replace('0','3');
  const b=commit(base),o=commit(ours);g('checkout','-q','--detach',b);const t=commit(theirs);writeFileSync(join(repo,'a.c'),reference);g('add','a.c');const tree=g('write-tree'),event=g('commit-tree',tree,'-p',o,'-p',t,'-m','merge');writeFileSync(join(scaffold,'a.c'),reference);
  const c={path:'a.c',base,ours,theirs,reference,event,git:{directory:repo,base:b,ours:o,theirs:t},evaluator:{scaffold,target:'a.c',start_byte:0,end_byte:Buffer.byteLength(reference)}};
  assert.equal(verifyGitCase(c).localized.localizationStatus,'exact');assert.throws(()=>verifyGitCase({...c,base:'reference-only secret'}));assert.throws(()=>verifyGitCase({...c,reference:'wrong'}));assert.throws(()=>verifyGitCase({...c,evaluator:{...c.evaluator,start_byte:1}}));writeFileSync(join(scaffold,'a.c'),'unrelated');assert.throws(()=>verifyGitCase(c));
 }finally{rmSync(d,{recursive:true,force:true});}
});
test('isolated evaluator rejects compiling wrong behavior and excludes environment credentials',{skip:!existsSync('/usr/bin/bwrap')},()=>{
 const d=mkdtempSync(join(tmpdir(),'mrgr-v3-sandbox-'));try{
  const scaffold=join(d,'source'),oracle=join(d,'oracle');mkdirSync(scaffold);mkdirSync(oracle);writeFileSync(join(scaffold,'a.sh'),'exit 0\n');
  writeFileSync(join(oracle,'test.sh'),'test -z "${INCEPTION_API_KEY:-}" && test -z "${MINIMAX_API_KEY:-}" && test ! -e /home && /bin/sh /work/a.sh && echo TEST_COMPLETED\n');
  const input={evaluator:{scaffold,oracle,target:'a.sh',start_byte:0,end_byte:7,preimage_sha256:hash(readFileSync(join(scaffold,'a.sh'))),scaffold_sha256:treeHash(scaffold),oracle_sha256:treeHash(oracle),build:['/bin/sh','-n','/work/a.sh'],test:['/bin/sh','/oracle/test.sh'],test_completion:[{pattern:'^TEST_COMPLETED$',count:1}]}};
  assert(evaluate(input,'exit 0\n').pass);assert.equal(evaluate(input,'exit 1\n').category,'test-failure');writeFileSync(join(oracle,'test.sh'),'exit 0');assert.throws(()=>evaluate(input,'exit 0\n'));
 }finally{rmSync(d,{recursive:true,force:true});}
});
test('add/add admission reproduces an absent base file without hiding a missing parent',()=>{
 const d=mkdtempSync(join(tmpdir(),'mrgr-v3-add-add-'));try{
  const repo=join(d,'repo'),scaffold=join(d,'scaffold');mkdirSync(repo);mkdirSync(scaffold);
  const g=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'}}).trim();
  g('init','-q');g('commit','--allow-empty','-qm','base');const base=g('rev-parse','HEAD');
  const ours='int f(void) { return 1; }\n',theirs=ours.replace('1','2'),reference=ours.replace('1','3');
  const commit=text=>{writeFileSync(join(repo,'a.c'),text);g('add','a.c');g('commit','-qm','side');return g('rev-parse','HEAD');};
  const o=commit(ours);g('checkout','-q','--detach',base);const t=commit(theirs);
  writeFileSync(join(repo,'a.c'),reference);g('add','a.c');const event=g('commit-tree',g('write-tree'),'-p',o,'-p',t,'-m','merge');writeFileSync(join(scaffold,'a.c'),reference);
  const c={path:'a.c',base:'',ours,theirs,reference,event,git:{directory:repo,base,ours:o,theirs:t},evaluator:{scaffold,target:'a.c',start_byte:0,end_byte:Buffer.byteLength(reference)}};
  assert.equal(verifyGitCase(c).localized.localizationStatus,'exact');
  const emptyContext=context({...c,ours:'',theirs:''},{});
  assert.deepEqual(emptyContext.contexts,{'local-context':[],selected:[]});
  assert.deepEqual(emptyContext.retrieval.unresolved.map(r=>r.reason),['empty-parent-hunk-no-context','empty-parent-hunk-no-context']);
  assert.throws(()=>context({...c,ours:null},{}));
  assert.throws(()=>verifyGitCase({...c,base:'invented base'}));
  assert.throws(()=>verifyGitCase({...c,git:{...c.git,base:'f'.repeat(40)}}));
  assert.throws(()=>verifyGitCase({...c,git:{...c.git,ours:base}}));
 }finally{rmSync(d,{recursive:true,force:true});}
});

test('lineage metadata survives remote idle closure during synchronous oracle work',async()=>{
 const server=spawn(process.execPath,['--input-type=module','-e',`import http from 'node:http';const s=http.createServer((req,res)=>{const socket=req.socket;res.setHeader('Content-Type','application/json');res.end('{}');setTimeout(()=>socket.destroy(),80);});s.listen(0,'127.0.0.1',()=>console.log(s.address().port));`],{stdio:['ignore','pipe','inherit']});
 try{
  const [chunk]=await once(server.stdout,'data'),url='http://127.0.0.1:'+chunk.toString().trim();
  assert.deepEqual(await(await fetchLineageMetadata(url)).json(),{});
  await new Promise(setImmediate);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200);
  assert.deepEqual(await(await fetchLineageMetadata(url)).json(),{});
 }finally{server.kill();await once(server,'exit');}
});
