import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {packageCwd} from '../v3-screen-go.mjs';
const d=mkdtempSync(join(tmpdir(),'mrgr-gopath-check-')),work=join(d,'work'),gopath=join(d,'gopath'),canonical='example.org/project';
try{
 const files={'internal/helper/helper.go':'package helper\nfunc Value() int { return 7 }\n','vendor/example.org/dependency/dependency.go':'package dependency\nfunc Value() int { return 3 }\n','target/target.go':'package target\nimport "example.org/project/internal/helper"\nimport "example.org/dependency"\nfunc Value() int { return helper.Value()+dependency.Value() }\n','target/target_test.go':'package target\nimport "testing"\nfunc TestValue(t *testing.T) { if Value()!=10 { t.Fatal(Value()) } }\n'};
 for(const [path,text]of Object.entries(files)){mkdirSync(dirname(join(work,path)),{recursive:true});writeFileSync(join(work,path),text);}
 const link=join(gopath,'src',canonical);mkdirSync(dirname(link),{recursive:true});symlinkSync(work,link);
 const run=legacy=>spawnSync('/bin/sh',['-c',packageCwd('target/target.go',legacy?canonical:null).replace('/tmp/gopath',gopath).replace('/work',work)+'exec go test -vet=off -count=1'],{encoding:'utf8',timeout:120000,env:{PATH:process.env.PATH,HOME:d,GOPATH:gopath,GO111MODULE:'off',GOTOOLCHAIN:'local',GOPROXY:'off',GOSUMDB:'off',GOCACHE:join(d,'cache')}});
 const before=run(false),after=run(true);assert.notEqual(before.status,0);assert.match(before.stderr,/cannot find package "example.org\/dependency"/);assert.equal(after.status,0,after.stderr);assert.match(after.stdout,/ok\s+example.org\/project\/target/);
 assert.equal(packageCwd('nested/file.go'),"cd '/work/nested'\n");assert.throws(()=>packageCwd('file.go','../escape'));
 console.log(JSON.stringify({pass:true,before:{status:before.status,stdout:before.stdout,stderr:before.stderr},after:{status:after.status,stdout:after.stdout,stderr:after.stderr},module_cwd_unchanged:true,network:false}));
}finally{rmSync(d,{recursive:true,force:true});}
