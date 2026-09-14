import assert from 'node:assert/strict';
import fs from 'node:fs';
import {finalContent,normalized} from './harmony.mjs';
const answer=JSON.stringify({decision:'resolve',resolution:'literal <|end|> and <|channel|>final in code',citations:['ours']});
for(const prefix of ['','<|start|>assistant','<|channel|>analysis<|message|>wrong answer {"decision":"halt"}<|end|><|start|>assistant']){
 for(const metadata of ['',' <|constrain|>json','<|constrain|>json']){
  assert.equal(finalContent(prefix+'<|channel|>final'+metadata+'<|message|>'+answer+'<|fim_suffix|>'),answer);
 }
}
for(const s of [answer,'<|channel|>analysis<|message|>'+answer,'<|channel|>final<|message|>{','<|channel|>final<|message|>'+answer+'<|end|><|start|>assistant<|channel|>final<|message|>'+answer])assert.equal(finalContent(s),null);
const truncated={choices:[{finish_reason:'length',message:{content:'<|channel|>final<|message|>'+answer}}]};assert.equal(normalized(truncated),truncated);
const old=new URL('../v3-local-gpt-oss-2026-09-08/run/responses/',import.meta.url);
const failure=fs.readdirSync(old).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(new URL(n,old)))).find(r=>r.error);
const suffix=JSON.parse(failure.raw_body).error.message.split(': ').slice(1).join(': ');
assert.equal(JSON.parse(finalContent(suffix)).decision,'resolve');
console.log('PASS: saved failure header, ordinary/constrained finals, reasoning exclusion, literal markers, malformed/missing/duplicate finals, truncation. No inference.');

const live=JSON.parse(fs.readFileSync(new URL('./smoke.json',import.meta.url)));assert.equal(JSON.parse(normalized(live.response).choices[0].message.content).decision,'halt');console.log('PASS: live raw-server response with terminal return token.');
