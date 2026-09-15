"""Pre-declared Q8 secondary: separate artifacts, primary protocol untouched."""
import fcntl
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import time
from runtime import ROOT,HERE,read,save,digest,stage_environment
from evaluate import evaluate,api,schedule

COMMIT='6f830274c56f0beb2fc6be4229769171e1570ae9'
AMENDMENT='docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-q8-secondary-amendment-2026-09-15.md'
AMENDMENT_SHA='274393fa3df16175ecc74bf7244ce0167438cffb9fb5946c71f9f1226a833f5a'
UNIT='mrgr-lora-9b-q8-secondary-20260915'


def fidelity_reading(q4,q8,complete=True):
    if not complete:return 'INCOMPLETE (fidelity instrument)'
    return 'quantization mismatch supported' if q8>=6 and q8>q4 else 'deployment fidelity not established' if q8<=2 else 'inconclusive'


def finish(r):
    record=read(r/'execution.json');valid=(r/'result.json').exists()
    record.update(status='complete' if os.environ.get('SERVICE_RESULT')=='success' and valid else 'failed',service_result=os.environ.get('SERVICE_RESULT'),finished=time.time(),elapsed=time.time()-record['started'])
    save(r/'execution.json',record)
    if record['status']=='failed':save(r/'status.json',{'stage':'failed','finding':'INCOMPLETE (secondary execution)','at':time.time()})
    if (r/'gpu-lease.json').exists():
        service=read(HERE/'config.json')['service']
        subprocess.run(['ssh','vinbonesjr','systemctl start '+shlex.quote(service)],timeout=120,check=False)
    subprocess.run(['logger','-t','mrgr-lora','Q8 secondary '+record['status']+': '+str(r)],timeout=10)


def worker(r,c):
    protocol=read(r/'protocol.json');primary=Path(protocol['primary']);training=primary.parent/'9b-training-2026-09-15';output=r/'base-Q8_0.gguf';partial=r/'base-Q8_0.partial.gguf'
    for path,sha in protocol['inputs'].items():assert digest(Path(path))==sha,'secondary input drift: '+path
    start=time.monotonic()
    command=['/usr/bin/llama-quantize',str(training/'base-bf16.gguf'),str(partial),'Q8_0','2']
    save(r/'status.json',{'stage':'CPU Q8 conversion','gpu_requests':0,'at':time.time()})
    with (r/'conversion.log').open('wb') as log:
        p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=3600)
    receipt={'command':command,'status':p.returncode,'elapsed':time.monotonic()-start,'input_sha256':protocol['inputs'][str(training/'base-bf16.gguf')],'binary_sha256':protocol['inputs']['/usr/bin/llama-quantize']}
    save(r/'conversion.json',receipt);assert p.returncode==0,'Q8 conversion failed'
    partial.rename(output);receipt.update(output_sha256=digest(output),output_bytes=output.stat().st_size);save(r/'conversion.json',receipt)
    while subprocess.check_output(['systemctl','show','mrgr-lora-9b-revision-20260915','-p','ActiveState','--value'],text=True,timeout=20).strip() in ['active','activating','deactivating','reloading']:
        save(r/'status.json',{'stage':'waiting for primary exit; no GPU requests','at':time.time()});time.sleep(30)
    # Do not read any primary model outcome when deciding whether the secondary runs.
    with (Path(c['storage'])/'training.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            save(r/'result.json',{'finding':'INCOMPLETE','reason':'GPU lease unavailable after primary exit; not rescheduled'});return
        prior=read(primary/'revision.json');execution=read(primary/'execution.json')
        assert execution['status'] in ['complete','failed'],'primary terminal receipt missing'
        remaining=prior['remaining_seconds']-execution['elapsed']-receipt['elapsed']
        save(r/'budget.json',{'remaining_seconds':remaining,'primary_execution_sha256':digest(primary/'execution.json'),'conversion_seconds':receipt['elapsed'],'waiting_charged_to_primary_only':True})
        if remaining<1:
            save(r/'result.json',{'finding':'INCOMPLETE','reason':'cumulative 72-hour compute budget exhausted; not rescheduled'});return
        # Tighten the native unit deadline to the actual remaining active-work allowance.
        deadline=int(time.time()-read(r/'execution.json')['started']+remaining)
        subprocess.run(['ssh','vinbonesjr','systemctl set-property --runtime '+UNIT+' RuntimeMaxSec='+str(deadline)],check=True,timeout=30)
        assert api('/health')['status']=='ok' and all(not x['is_processing'] for x in api('/slots')),'ordinary service not ready/idle'
        save(r/'gpu-lease.json',{'acquired':time.time(),'primary_terminal_receipt_sha256':digest(primary/'execution.json')})
        subprocess.run(['ssh','vinbonesjr','systemctl stop '+shlex.quote(c['service'])],check=True,timeout=120)
        try:
            examples=read(primary/'in-sample-cases.json');sampler=prior['sampler'];greedy=sampler|{'temperature':0,'top_k':1}
            adapter=primary/'final-adapter.gguf';fidelity={}
            for label,base in [('Q4_K_M',training/'base-Q4_K_M.gguf'),('Q8_0',output)]:
                destination=r/('fidelity-'+label)
                summary=evaluate(destination,examples,greedy,base,adapter,1,c['seed'],'IN-SAMPLE GREEDY TARGET FIDELITY ONLY')
                exact={arm:0 for arm in ['base','adapter']}
                for row in read(destination/'schedule.json'):
                    result=read(destination/'attempts'/row['id']/'result.json')
                    target=next(e['target']['choice'] for e in examples if e['id']==row['case'])
                    exact[row['condition']]+=result.get('choice')==target
                fidelity[label]={'complete':summary['complete'],'target_matches':exact}
                save(r/'fidelity.json',fidelity)
            q8=fidelity['Q8_0']['target_matches']['adapter'];q4=fidelity['Q4_K_M']['target_matches']['adapter']
            reading=fidelity_reading(q4,q8,all(x['complete'] for x in fidelity.values()))
            save(r/'fidelity-reading.json',{'reading':reading,'Q8_adapter_matches':q8,'Q4_adapter_matches':q4,'denominator':8,'scope':'registered in-sample diagnostic; does not identify NF4 as ground truth or rewrite primary estimates'})
            fresh=primary/'fresh-cases.json';primary_schedule=primary/'fresh-evaluation/schedule.json'
            if not fresh.exists() or not primary_schedule.exists():
                save(r/'result.json',{'finding':'INCOMPLETE','reason':'identical primary heldout cases/schedule unavailable; no new acquisition or rescheduling','fidelity':reading,'secondary_model_requests':0});return
            examples=read(fresh);assert schedule(examples,3,c['seed'])==read(primary_schedule),'secondary schedule differs from primary'
            save(r/'heldout-inputs.json',{'cases_sha256':digest(fresh),'primary_schedule_sha256':digest(primary_schedule),'sampler':sampler,'primary_protocol_sha256':digest(primary/'revision.json'),'amendment_commit':COMMIT})
            result=evaluate(r/'heldout',examples,sampler,output,adapter,3,c['seed'],'PRE-DECLARED Q8_0 SECONDARY; EXPLORATORY; NEVER POOLED')
            save(r/'result.json',{'finding':'INCOMPLETE (adapter fidelity)' if reading=='deployment fidelity not established' else result['finding'],'fidelity':reading,'secondary':result,'primary_unchanged':True,'pilot_fidelity_status':'INCOMPLETE (adapter fidelity)' if reading=='deployment fidelity not established' else reading})
        finally:subprocess.run(['ssh','vinbonesjr','systemctl start '+shlex.quote(c['service'])],check=True,timeout=120)


def main():
    mode=sys.argv[1];r=Path(sys.argv[2]);c=read(HERE/'config.json')
    if mode=='finish':finish(r);return
    if mode=='worker':worker(r,c);return
    assert mode=='start' and not r.exists(),'new secondary directory required'
    assert digest(ROOT/AMENDMENT)==AMENDMENT_SHA
    committed=subprocess.check_output(['git','show',COMMIT+':'+AMENDMENT],cwd=ROOT,timeout=30);assert digest(committed)==AMENDMENT_SHA
    primary=Path(c['storage'])/'runs/9b-revision-2026-09-15';training=primary.parent/'9b-training-2026-09-15'
    assert not (primary/'fresh-evaluation/attempts').exists(),'secondary implementation freeze must precede heldout requests'
    assert shutil.disk_usage(c['storage']).free>24*1024**3,'insufficient disk headroom'
    r.mkdir(parents=True)
    inputs=[ROOT/AMENDMENT,primary/'revision.json',training/'base-bf16.gguf',training/'base-Q4_K_M.gguf',primary/'final-adapter.gguf',primary/'in-sample-cases.json',Path('/usr/bin/llama-quantize'),Path('/usr/bin/llama-server'),Path(__file__),HERE/'evaluate.py',HERE/'runtime.py',HERE/'pilot.py',HERE/'config.json']
    save(r/'protocol.json',{'version':'ornith-q8-secondary/1','at':time.time(),'amendment_commit':COMMIT,'amendment_path':AMENDMENT,'amendment_sha256':AMENDMENT_SHA,'primary':str(primary),'primary_state_at_registration':read(primary/'acquisition/status.json'),'fresh_model_requests_at_registration':0,'inputs':{str(p):digest(p) for p in inputs},'rules':'CPU conversion only while primary active. GPU work requires primary exit and lock. Same cases/schedule/sampler; independent of outcome. Same cumulative budget. No pooling/retraining/extra acquisition. Optional HF diagnostic omitted.'})
    save(r/'execution.json',{'unit':UNIT,'started':time.time(),'status':'started'})
    # Only conversion is CPU-heavy while primary runs; two threads, low scheduling/I/O priority.
    args=['systemd-run','--unit='+UNIT,'--property=User=svnbjrn','--property=WorkingDirectory='+str(ROOT),'--property=Nice=10','--property=IOWeight=10','--property=CPUWeight=10','--property=MemoryMax=32G','--property=MemorySwapMax=0','--property=OOMPolicy=stop','--property=KillMode=control-group','--property=RuntimeMaxSec=259200','--property=ExecStopPost=/usr/bin/python3 '+str(HERE/'q8_secondary.py')+' finish '+str(r),'--property=StandardOutput=append:'+str(r/'execution.log'),'--property=StandardError=append:'+str(r/'execution.log'),*['--setenv='+k+'='+v for k,v in stage_environment(c).items()],'/usr/bin/python3','-u',str(HERE/'q8_secondary.py'),'worker',str(r)]
    result=subprocess.run(['ssh','vinbonesjr',shlex.join(args)],capture_output=True,text=True,timeout=60);save(r/'launch.json',{'args':args,'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr});assert result.returncode==0,result.stderr
    print(result.stdout+result.stderr)

if __name__=='__main__':main()
