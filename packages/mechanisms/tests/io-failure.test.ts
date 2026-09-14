import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,test,vi} from 'vitest';
const faults=vi.hoisted(()=>({receiptWrites:0,failReceipt:false,renameTarget:''}));
vi.mock('node:fs',async()=>{
 const fs=await vi.importActual<typeof import('node:fs')>('node:fs');
 return {...fs,
  writeFileSync:(...args:Parameters<typeof fs.writeFileSync>)=>{
   if(String(args[0]).endsWith('.json')&&faults.failReceipt&&++faults.receiptWrites>=3)throw Error('receipt disk failure');
   return fs.writeFileSync(...args);
  },
  renameSync:(...args:Parameters<typeof fs.renameSync>)=>{
   if(String(args[1])===faults.renameTarget)throw Error('rename failure');
   return fs.renameSync(...args);
  }};
});
import {main} from '../src/cli.js';
import {runMechanism} from '../src/adapter.js';
const roots:string[]=[];
afterEach(()=>{faults.failReceipt=false;faults.receiptWrites=0;faults.renameTarget='';vi.unstubAllEnvs();vi.restoreAllMocks();for(const p of roots.splice(0))rmSync(p,{recursive:true,force:true});});
function inputs(){const dir=mkdtempSync(join(tmpdir(),'mrgr-io-'));roots.push(dir);const files=['base','ours','theirs'].map((p,i)=>{const f=join(dir,p);writeFileSync(f,['a\n','a\n','b\n'][i]);return f;});return {dir,files};}
test('receipt failure after commit retains the merged bytes and reports infrastructure failure',async()=>{
 const {dir,files}=inputs();vi.stubEnv('MRGR_MECHANISM_LOG_DIR',join(dir,'logs'));faults.failReceipt=true;
 const stderr=vi.spyOn(process.stderr,'write').mockReturnValue(true);
 expect(await main(['git_text',...files,'7','file.txt'])).toBe(130);
 expect(readFileSync(files[1],'utf8')).toBe('b\n');expect(String(stderr.mock.calls[0][0])).toContain('"committed":true');
});
test('failed output rename never reports uncommitted conflict markers',async()=>{
 const {files}=inputs();writeFileSync(files[1],'ours\n');faults.renameTarget=files[1];
 const r=await runMechanism('git_text',{base:files[0],ours:files[1],theirs:files[2],path:'file.txt'});
 expect(r.ok).toBe(true);if(!r.ok)return;
 expect(r.value.rawStatus).toBe(1);expect(r.value.normalizedStatus).toBe(130);
 expect(r.value.hasConflictMarkers).toBe(false);expect(r.value.error).toBe('rename failure');expect(readFileSync(files[1],'utf8')).toBe('ours\n');
});
