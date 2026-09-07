// Stage the tested selector revision; never issue solver requests or alter a protocol.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {load} from '../v3.mjs';
import {hash} from '../v3-data.mjs';
import {context} from '../../../.do-not-commit/h0-selector-repair/v3-data-compatible.mjs';
const root=resolve(import.meta.dirname,'../../..');
const source=resolve(import.meta.dirname,'../v3-development-2026-09-06e');
const out=join(import.meta.dirname,'selector-contexts-compatible');
const modulePath=join(root,'.do-not-commit/h0-selector-repair/v3-data-compatible.mjs');
const moduleHash=hash(readFileSync(modulePath));
const provenance=JSON.parse(readFileSync(join(import.meta.dirname,'selector-name-repair-provenance.json')));
assert.equal(moduleHash,provenance.prototype_sha256);
const {cases,protocol,digest}=load(source);
assert.equal(cases.length,60);assert(protocol.eligible&&protocol.mode==='development');
assert(!existsSync(out),'refuse existing staging directory');mkdirSync(out);
const libraries=Object.fromEntries(['C','Go'].map(k=>[k,join(root,'.do-not-commit/h0-v3-tools',k==='C'?'c.so':'go.so')]));
const save=(name,x)=>writeFileSync(join(out,name),JSON.stringify(x,null,2)+'\n');
save('freeze.json',{at:new Date().toISOString(),source,protocol_sha256:digest,cases_sha256:protocol.cases_sha256,case_ids:cases.map(c=>c.id),module:modulePath,module_sha256:moduleHash,regenerator_sha256:hash(readFileSync(import.meta.filename)),libraries:Object.fromEntries(Object.entries(libraries).map(([k,p])=>[k,hash(readFileSync(p))])),input_projection:['git','path','language','ours','theirs'],purpose:'Repaired parent-only contexts on existing development cases; no new independent evidence',solver_requests:0});
const completed=[];
try{
  for(const c of cases){
    assert.equal(hash(readFileSync(modulePath)),moduleHash,'repair module drift');
    const repaired=context({git:c.git,path:c.path,language:c.language,ours:c.ours,theirs:c.theirs},libraries);
    assert.equal(repaired.retrieval.method,'syntax-ranges-and-identifier-candidates/3');
    assert.deepEqual(repaired.contexts['local-context'],c.contexts['local-context'],'local comparator drift');
    save(`${c.id}.json`,{id:c.id,source_protocol_sha256:digest,repair_module_sha256:moduleHash,...repaired});
    completed.push(c.id);save('progress.json',{at:new Date().toISOString(),completed,expected:60});
    console.log(completed.length,c.id);
  }
  assert.equal(hash(readFileSync(modulePath)),moduleHash);assert.equal(load(source).digest,digest);
  save('result.json',{complete:true,cases:completed.length,source_protocol_sha256:digest,repair_module_sha256:moduleHash,solver_requests:0});
}catch(error){save('result.json',{complete:false,completed:completed.length,error:error.message,solver_requests:0});throw error;}
