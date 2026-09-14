import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const here=import.meta.dirname,unit='mrgr-gpt-oss-high-transport-benchmark.service';
let state;try{state=JSON.parse(fs.readFileSync(here+'/run/state.json'));}catch{try{state=JSON.parse(fs.readFileSync(here+'/PREPARING.json'));}catch{}}
if(state?.stage==='finished'||state?.stage==='drained')process.exit(0);
const status=execFileSync('systemctl',['--user','show',unit,'-p','ActiveState','--value'],{encoding:'utf8'}).trim();
const stale=state&&Date.now()-Date.parse(state.at)>2400000;
if(status==='active'&&!stale)process.exit(0);
const file=here+'/FAILURE.json';
if(!fs.existsSync(file)){fs.writeFileSync(file+'.tmp',JSON.stringify({at:new Date().toISOString(),complete:false,error:stale?'watchdog: no progress for 40 minutes':`watchdog: service ${status}`,state},null,2));fs.renameSync(file+'.tmp',file);}
if(stale&&status==='active')execFileSync('systemctl',['--user','stop','--no-block',unit]);
console.error('Benchmark stopped or stalled; inspect '+file);process.exitCode=1;
