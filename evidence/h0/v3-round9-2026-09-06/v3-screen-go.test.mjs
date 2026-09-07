import assert from 'node:assert/strict';
import {mutations,packageCwd,chooseBase,extractTrackedTree} from './v3-screen-go.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readlinkSync,symlinkSync,chmodSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temporary=mkdtempSync(join(tmpdir(),'h0-extraction-'));
try{
  const repo=join(temporary,'repo'),out=join(temporary,'out');mkdirSync(repo);mkdirSync(out);
  const git=(...args)=>execFileSync('git',['-C',repo,...args],{stdio:'pipe'});
  git('init');writeFileSync(join(repo,'.gitattributes'),'hidden export-ignore\nscript export-subst\n');
  const binary=Buffer.from([0,255,13,10]);writeFileSync(join(repo,'hidden'),binary);
  writeFileSync(join(repo,'script'),'$Format:%H$\n');chmodSync(join(repo,'script'),0o755);symlinkSync('hidden',join(repo,'link'));
  git('add','.');git('-c','user.name=H0','-c','user.email=h0@example.invalid','commit','-m','fixture');
  extractTrackedTree(repo,'HEAD',out);
  assert.deepEqual(readFileSync(join(out,'hidden')),binary);
  assert.equal(readFileSync(join(out,'script'),'utf8'),'$Format:%H$\n');
  assert.equal(statSync(join(out,'script')).mode&0o777,0o755);assert.equal(readlinkSync(join(out,'link')),'hidden');
  assert.throws(()=>extractTrackedTree(repo,'HEAD',out),/empty directory/);
}finally{rmSync(temporary,{recursive:true,force:true});}
assert.equal(packageCwd('x.go'),"cd '/work'\n");
assert.equal(packageCwd('nested/package/x.go'),"cd '/work/nested/package'\n");
assert.throws(()=>packageCwd('../x.go'));
const a='a'.repeat(40),b='b'.repeat(40);
assert.equal(chooseBase([a]),a);assert.equal(chooseBase([a,b],b),b);
assert.throws(()=>chooseBase([a,b]));assert.throws(()=>chooseBase([a],b));assert.throws(()=>chooseBase(['--bad']));
// Decode the shell argument without changing directory, including hostile punctuation.
const unusual="nested/'$(false)`false`/x.go";
assert.equal(execFileSync('/bin/sh',['-c',packageCwd(unusual).replace(/^cd /,"printf '%s' ")],{encoding:'utf8'}),"/work/nested/'$(false)`false`");
const library=new URL('../../.do-not-commit/h0-v3-tools/go.so',import.meta.url).pathname;
const s='package p\n// true == 9\nfunc f(x int) bool { return x == 3 || false }\n';
assert.deepEqual(mutations(s,s.indexOf('x =='),s.indexOf(' }'),library).map(m=>m.resolution),['true || false','false || false','true','false','x != 3 || false','x == 0 || false','x == 3 && false','x == 3 || true']);
const unicode='package p\n// 😀\nfunc f() bool { return true }\n',start=Buffer.byteLength(unicode.slice(0,unicode.indexOf('true')));
assert.equal(mutations(unicode,start,start+4,library)[0].resolution,'false');
const condition='package p\nfunc f() { if allowed() { act() } }\n',at=condition.indexOf('allowed()');
assert.deepEqual(mutations(condition,at,at+9,library).map(m=>m.resolution),['true','false','!(allowed())']);
console.log('Exact Git extraction, Go mutation scope, comments, operators and UTF-8 checks passed');
