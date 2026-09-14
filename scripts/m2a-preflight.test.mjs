import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightEnvironment,preflightExec} from './m2a-preflight.mjs';

test('preflight excludes ambient Git state while retaining executable discovery',()=>{
 const env=preflightEnvironment({PATH:'/tools',GIT_DIR:'/wrong',GIT_WORK_TREE:'/wrong',GIT_INDEX_FILE:'/wrong',GIT_CONFIG_COUNT:'1',HOME:'/wrong',MERGIRAF_BIN:'/tools/mergiraf'});
 assert.equal(env.PATH,'/tools');assert.equal(env.MERGIRAF_BIN,'/tools/mergiraf');
 for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_CONFIG_COUNT','HOME'])assert.equal(env[key],undefined);
});
test('preflight subprocesses are bounded and receive the isolated environment',()=>{
 const old=process.env.GIT_DIR;process.env.GIT_DIR='/wrong';
 try{
  assert.equal(preflightExec(process.execPath,['-e','process.stdout.write(String(process.env.GIT_DIR))']),'undefined');
  assert.throws(()=>preflightExec(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:100}),/ETIMEDOUT/);
 }finally{if(old===undefined)delete process.env.GIT_DIR;else process.env.GIT_DIR=old;}
});

test('preflight discards stale dist and rebuilds before attempting source reconstruction',()=>{
 const temp=mkdtempSync(join(tmpdir(),'mrgr-preflight-build-'));
 const root=resolve(import.meta.dirname,'..');
 const stale=join(root,'packages/mechanisms/dist',`stale-${process.pid}.js`);
 mkdirSync(dirname(stale),{recursive:true});writeFileSync(stale,'stale compiled code');
 try {
  const r=spawnSync(process.execPath,[join(root,'scripts/m2a-preflight.mjs'),join(temp,'absent-source'),join(temp,'output')],{cwd:root,encoding:'utf8',timeout:120000});
  assert.notEqual(r.status,0);assert.equal(r.error,undefined);
  assert.match(r.stderr,/does not exist/);
  assert(!existsSync(stale));assert(existsSync(join(root,'packages/mechanisms/dist/cli.js')));
  assert(existsSync(join(temp,'output/build.log')));
 } finally {rmSync(stale,{force:true});rmSync(temp,{recursive:true,force:true});}
});
