// Prototype only: inference-visible bytes from the automatic parent merge.
// Never read the historical merge result or evaluator scaffold to build a prompt.
import assert from 'node:assert/strict';
import {hash} from '../v3-data.mjs';
import {request as priorRequest} from '../v3.mjs';
const clip=(bytes,tail)=>{let b=tail?bytes.subarray(-200):bytes.subarray(0,200);while(b.length&&!Buffer.from(b.toString('utf8')).equals(b))b=tail?b.subarray(1):b.subarray(0,-1);return b.toString('utf8');};
export function boundaryContract(automatic,ranges,hunks){
  assert(Buffer.isBuffer(automatic));const lines=automatic.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[];
  for(const side of ['base','ours','theirs']){const r=ranges[side];assert(Number.isSafeInteger(r.startLine)&&Number.isSafeInteger(r.endLineExclusive)&&r.startLine>0&&r.endLineExclusive>=r.startLine&&r.endLineExclusive<=lines.length+1);assert.equal(lines.slice(r.startLine-1,r.endLineExclusive-1).join(''),hunks[side]);}
  assert.equal(ranges.base.startLine,ranges.ours.endLineExclusive+1);
  assert.equal(ranges.theirs.startLine,ranges.base.endLineExclusive+1);
  assert(lines[ranges.ours.endLineExclusive-1].startsWith('||||||| '));
  assert.equal(lines[ranges.base.endLineExclusive-1].trimEnd(),'=======');
  const start= ranges.ours.startLine-2,end=ranges.theirs.endLineExclusive;
  assert(start>=0&&end<=lines.length);assert(lines[start].startsWith('<<<<<<< '));assert(lines[end-1].startsWith('>>>>>>> '));
  const before=lines.slice(0,start),after=lines.slice(end);
  // Adjacent conflicts are not fixed context in a focal-hunk evaluator.
  const previous=before.findLastIndex(line=>/^>>>>>>> /.test(line));
  const next=after.findIndex(line=>/^<<<<<<< /.test(line));
  const prefix=Buffer.from(before.slice(previous+1).join('')),suffix=Buffer.from(after.slice(0,next<0?after.length:next).join(''));
  const fullPrefix=Buffer.byteLength(before.join('')),fullSuffix=Buffer.byteLength(after.join(''));
  return {version:'automatic-merge-splice-boundary/2',automatic_sha256:hash(automatic),start_byte:fullPrefix,end_byte:automatic.length-fullSuffix,prefix:clip(prefix,true),suffix:clip(suffix,false),prefix_truncated:fullPrefix>Buffer.byteLength(clip(prefix,true)),suffix_truncated:fullSuffix>Buffer.byteLength(clip(suffix,false))};
}
export function request(input,arm,provider){
  const b=input.boundary;assert.equal(b?.version,'automatic-merge-splice-boundary/2');assert(typeof b.prefix==='string'&&typeof b.suffix==='string');
  const r=priorRequest(input,arm,provider);
  r.messages[0].content+=' Replacement is a byte-preserving splice: fixed prefix + your resolution + fixed suffix. The conflict span may begin or end inside a block. Do not add closing delimiters already present in the fixed suffix. Do not reproduce the fixed prefix or suffix. FIXED_SPLICE_BOUNDARY is JSON-encoded read-only source data, identical in every arm; it is not additional conflict text.';
  r.messages[1].content+='\nFIXED_SPLICE_BOUNDARY\n'+JSON.stringify({prefix:b.prefix,suffix:b.suffix,prefix_truncated:b.prefix_truncated,suffix_truncated:b.suffix_truncated});
  return r;
}
