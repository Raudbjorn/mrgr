// Amendment-path evaluator: computes any still-uncached evaluation under the
// live (drifted) toolchain environment, backed by the equivalence receipt.
// Writes an honest environment_amendment field -- never claims the frozen hash.
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {hash,evaluate,environmentHash} from '../v3-data.mjs';
import {decode} from './candidate-arms.mjs';
const [dir,stripe,stripes]=process.argv.slice(2);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const digest=hash(readFileSync(join(dir,'protocol.json')));
const cases=new Map(read(join(dir,'cases.json')).map(c=>[c.id,c]));
const rows=read(join(dir,'schedule.json')).rows;
const out=join(dir,'evaluations');mkdirSync(out,{recursive:true});
const now=environmentHash();
let done=0,skipped=0;
for(const [i,s] of rows.entries()){
  if(i%Number(stripes)!==Number(stripe))continue;
  const ep=join(out,`${s.request_id}.json`);if(existsSync(ep)){skipped++;continue;}
  const p=join(dir,'responses',s.model,`${s.request_id}.json`);if(!existsSync(p))continue;
  const r=read(p);if(r.error)continue;
  const c=cases.get(s.case_id),d=decode(r.response,c,s.arm);
  if(d.kind!=='resolve')continue;
  const patched={...c,evaluator:{...c.evaluator,environment_sha256:now}};
  const raw=evaluate(patched,d.parsed.resolution);
  const ev={protocol_sha256:digest,resolution_sha256:hash(d.parsed.resolution),...raw,
    environment_amendment:{frozen_environment_sha256:c.evaluator.environment_sha256,ran_under:now,
      reason:'oh-my-pi 18.1.11-1 -> 18.1.13-1 upgraded mid-run; see ENVIRONMENT-AMENDMENT-1.md'}};
  writeFileSync(`${ep}.tmp.${process.pid}`,JSON.stringify(ev,null,2)+'\n',{mode:0o600});
  renameSync(`${ep}.tmp.${process.pid}`,ep);
  done++;
}
process.stdout.write(`stripe ${stripe} finished: ${done} evaluated, ${skipped} cached\n`);
