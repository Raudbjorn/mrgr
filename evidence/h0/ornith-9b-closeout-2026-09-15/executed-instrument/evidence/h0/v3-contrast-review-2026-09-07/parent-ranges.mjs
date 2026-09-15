// GNU diff3 supplies parent line coordinates. Accept only one exact triple match;
// algorithm disagreements are explicit failures, never inferred insertion points.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {git,hash,safePath} from '../v3-data.mjs';
export function parentRanges(input){
 safePath(input.path);const sides=['ours','base','theirs'],directory=mkdtempSync(join(tmpdir(),'mrgr-parent-ranges-'));
 try{
  const blobs=sides.map(side=>{assert(/^[a-f0-9]{40}$/.test(input.git[side]));return git(input.git.directory,'ls-tree','-z',input.git[side],'--',input.path).length?git(input.git.directory,'show',`${input.git[side]}:${input.path}`):Buffer.alloc(0);});
  const paths=sides.map((s,i)=>{const p=join(directory,s);writeFileSync(p,blobs[i]);return p;});
  const r=spawnSync('diff3',paths,{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});assert(!r.error&&r.status===0,'diff3 parent-range extraction failed');
  const starts=blobs.map(b=>{const xs=[0];for(let i=0;i<b.length;i++)if(b[i]===10)xs.push(i+1);if(xs.at(-1)!==b.length)xs.push(b.length);return xs;});
  const matches=[];
  for(const group of r.stdout.split(/^====[123]?\r?\n/m).slice(1)){
   const headers=[...group.matchAll(/^([123]):(\d+)(?:,(\d+))?([ac])$/gm)];if(headers.length!==3)continue;
   const ranges={};let valid=true;
   for(const m of headers){const i=Number(m[1])-1,first=Number(m[2]),last=Number(m[3]??m[2]);const start=starts[i][m[4]==='a'?first:first-1],end=starts[i][m[4]==='a'?first:last];
    if(start===undefined||end===undefined||start>end||!blobs[i].subarray(start,end).equals(Buffer.from(input[sides[i]]))){valid=false;break;}
    ranges[sides[i]]={start_byte:start,end_byte:end,blob_sha256:hash(blobs[i])};
   }
   if(valid&&Object.keys(ranges).length===3)matches.push(ranges);
  }
  assert.equal(matches.length,1,'parent range requires one exact diff3 triple');
  return {method:'gnu-diff3-exact-triple/1',ranges:matches[0],diff3_output_sha256:hash(r.stdout)};
 }finally{rmSync(directory,{recursive:true,force:true});}
}
