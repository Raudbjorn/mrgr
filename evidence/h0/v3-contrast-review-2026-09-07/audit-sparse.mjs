import {readFileSync,writeFileSync} from 'node:fs';
import {sparseContext} from './sparse-context.mjs';
import {hash} from '../v3-data.mjs';
const directory=import.meta.dirname,raw=readFileSync('evidence/h0/v3-development-2026-09-06e/cases.json'),rows=[];
for(const c of JSON.parse(raw)){
 try{const r=sparseContext({language:c.language,path:c.path,base:c.base,ours:c.ours,theirs:c.theirs,git:c.git},'.do-not-commit/h0-v3-tools/go.so');rows.push({id:c.id,repo:c.repo,retrieval:r.retrieval,scopes:r.contexts.selected.filter(s=>s.role==='enclosing-declaration').map(s=>({side:s.side,declarations:s.declaration_count})),sources:r.contexts.selected.length});}
 catch(e){rows.push({id:c.id,repo:c.repo,error:e.message});}
}
const reasons={};for(const r of rows)for(const d of r.retrieval?.diagnostics??[])reasons[d.reason]=(reasons[d.reason]??0)+1;
const summary={cases:rows.length,errors:rows.filter(r=>r.error).length,exact_budget_cases:rows.filter(r=>r.retrieval?.byte_budget_exact).length,complete_scope_slots:rows.reduce((n,r)=>n+(r.scopes?.length??0),0),reasons};
const result={at:new Date().toISOString(),cases_sha256:hash(raw),selector_sha256:hash(readFileSync(directory+'/sparse-context.mjs')),parent_ranges_sha256:hash(readFileSync(directory+'/parent-ranges.mjs')),summary,rows,solver_requests:0};
writeFileSync(directory+'/sparse-audit-v5.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(summary));
