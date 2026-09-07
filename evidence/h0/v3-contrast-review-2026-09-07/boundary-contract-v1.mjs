// Prototype only: inference-visible bytes from the automatic parent merge.
// Never read the historical merge result or evaluator scaffold to build a prompt.
import assert from 'node:assert/strict';
import {hash} from '../v3-data.mjs';
import {request as priorRequest} from '../v3.mjs';
const clip=(bytes,tail)=>{let b=tail?bytes.subarray(-200):bytes.subarray(0,200);while(b.length&&!Buffer.from(b.toString('utf8')).equals(b))b=tail?b.subarray(1):b.subarray(0,-1);return b.toString('utf8');};
export function boundaryContract(automatic,ranges,hunks){
  assert(Buffer.isBuffer(automatic));const lines=automatic.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[];
  for(const side of ['base','ours','theirs']){const r=ranges[side];assert(Number.isSafeInteger(r.startLine)&&Number.isSafeInteger(r.endLineExclusive)&&r.startLine>0&&r.endLineExclusive>=r.startLine&&r.endLineExclusive<=lines.length+1);assert.equal(lines.slice(r.startLine-1,r.endLineExclusive-1).join(''),hunks[side]);}
  const start= ranges.ours.startLine-2,end=ranges.theirs.endLineExclusive;
  assert(start>=0&&end<=lines.length);assert(lines[start].startsWith('<<<<<<< '));assert(lines[end-1].startsWith('>>>>>>> '));
  const prefix=Buffer.from(lines.slice(0,start).join('')),suffix=Buffer.from(lines.slice(end).join(''));
  return {version:'automatic-merge-splice-boundary/1',automatic_sha256:hash(automatic),start_byte:prefix.length,end_byte:automatic.length-suffix.length,prefix:clip(prefix,true),suffix:clip(suffix,false),prefix_truncated:prefix.length>200,suffix_truncated:suffix.length>200};
}
export function request(input,arm,provider){
  const b=input.boundary;assert.equal(b?.version,'automatic-merge-splice-boundary/1');assert(typeof b.prefix==='string'&&typeof b.suffix==='string');
  const r=priorRequest(input,arm,provider);
  r.messages[0].content+=' Replacement is a byte-preserving splice: fixed prefix + your resolution + fixed suffix. The conflict span may begin or end inside a block. Do not add closing delimiters already present in the fixed suffix. Do not reproduce the fixed prefix or suffix. FIXED_SPLICE_BOUNDARY is JSON-encoded read-only source data, identical in every arm; it is not additional conflict text.';
  r.messages[1].content+='\nFIXED_SPLICE_BOUNDARY\n'+JSON.stringify({prefix:b.prefix,suffix:b.suffix,prefix_truncated:b.prefix_truncated,suffix_truncated:b.suffix_truncated});
  return r;
}
