import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {hash} from '../v3-data.mjs';
import {dispatchRepeated,loadRepeated} from '../v3-method-repair-2026-09-07/repeat-dispatch.mjs';
import {aggregateRepeated} from '../v3-method-repair-2026-09-07/repaired-study.mjs';
const directory=import.meta.dirname,{digest}=loadRepeated(directory);
const state={pid:process.pid,started_at:new Date().toISOString(),protocol_sha256:digest,executor_sha256:hash(readFileSync(import.meta.filename)),stage:'generating'};
const save=()=>{const p=join(directory,'state.json');writeFileSync(p+'.tmp',JSON.stringify({...state,at:new Date().toISOString()},null,2)+'\n');renameSync(p+'.tmp',p);};
save();
try{
 const models=['mercury','minimax'];const results=await Promise.allSettled(models.map(name=>dispatchRepeated(directory,name)));
 state.providers=results.map((r,i)=>r.status==='fulfilled'?r.value:{model:models[i],stopped:'error',error:r.reason.message});
 state.generation_finished_at=new Date().toISOString();state.stage='evaluating';save();
 const result=aggregateRepeated(directory);state.complete=result.complete;state.valid=result.valid;state.finding_stage=result.finding.stage;state.stage=result.complete?'finished':'incomplete';save();
 console.log(JSON.stringify(state));
}catch(e){state.stage='error';state.error=e.message;save();console.error(e.message);process.exitCode=1;}
