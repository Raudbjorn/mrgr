"""Post-failure fidelity diagnostic; failed secondary and primary remain terminal."""
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
    save(r/'status.json',{'stage':record['status'],'finding':read(r/'result.json')['finding'] if valid else 'INCOMPLETE (diagnostic execution)','at':time.time()})
    if (r/'gpu-lease.json').exists():
        restore(read(HERE/'config.json'))
    subprocess.run(['logger','-t','mrgr-lora','Q8 secondary '+record['status']+': '+str(r)],timeout=10)


def diagnostic_limit(remaining):
    if remaining < 1:raise ValueError('cumulative compute budget exhausted')
    return min(7200,int(remaining))


def idle_service():
    assert api('/health')['status']=='ok','ordinary service not healthy'
    assert all(not x['is_processing'] for x in api('/slots')),'ordinary service busy'


def diagnostic(r,c):
    protocol=read(r/'protocol.json');primary=Path(protocol['primary'])
    for path,sha in protocol['inputs'].items():assert digest(Path(path))==sha,'diagnostic input drift: '+path
    with (Path(c['storage'])/'training.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        idle_service()
        save(r/'gpu-lease.json',{'acquired':time.time()})
        subprocess.run(['ssh','vinbonesjr','systemctl stop '+shlex.quote(c['service'])],check=True,timeout=120)
        try:
            examples=read(primary/'in-sample-cases.json');assert len(examples)==8
            adapter=primary/'final-adapter.gguf';fidelity={}
            for label,path in protocol['bases'].items():
                save(r/'status.json',{'stage':'diagnostic','base':label,'at':time.time()})
                destination=r/('fidelity-'+label)
                summary=evaluate(destination,examples,protocol['sampler'],Path(path),adapter,1,c['seed'],'POST-FAILURE IN-SAMPLE GREEDY FIDELITY; NOT EFFICACY')
                exact={arm:0 for arm in ['base','adapter']}
                for row in read(destination/'schedule.json'):
                    result=read(destination/'attempts'/row['id']/'result.json')
                    target=next(e['target']['choice'] for e in examples if e['id']==row['case'])
                    exact[row['condition']]+=result.get('choice')==target
                fidelity[label]={'complete':summary['complete'],'target_matches':exact,'counts':summary['counts'],'missing':summary['missing']}
                save(r/'fidelity.json',fidelity)
            reading=fidelity_reading(fidelity['Q4_K_M']['target_matches']['adapter'],fidelity['Q8_0']['target_matches']['adapter'],all(x['complete'] for x in fidelity.values()))
            save(r/'result.json',{'finding':reading,'fidelity':fidelity,'scored_requests':32,'scope':'Post-failure in-sample deployment-precision diagnostic; no causal identification of NF4 mismatch, no generalization or efficacy claim.','primary':'INCOMPLETE','secondary':'INCOMPLETE (secondary execution)','heldout_requests':0,'terminal':True})
        finally:restore(c)


def restore(c):
    subprocess.run(['ssh','vinbonesjr','systemctl start '+shlex.quote(c['service'])],check=True,timeout=120)
    deadline=time.monotonic()+120
    while True:
        try:
            if api('/health')['status']=='ok':return
        except OSError:pass
        if time.monotonic()>=deadline:raise TimeoutError('ordinary service restoration failed readiness')
        time.sleep(2)


def main():
    mode=sys.argv[1];r=Path(sys.argv[2]);c=read(HERE/'config.json')
    if mode=='finish':finish(r);return
    if mode=='diagnostic-worker':diagnostic(r,c);return
    assert mode=='diagnostic-start','The failed secondary remains terminal; only the amended diagnostic can run.'
    assert not r.exists(),'refuse rescheduling or overwriting a diagnostic'
    primary=Path(c['storage'])/'runs/9b-revision-2026-09-15';secondary=primary.parent/'9b-q8-secondary-2026-09-15';training=primary.parent/'9b-training-2026-09-15'
    assert read(primary/'execution.json')['status']=='complete'
    assert read(secondary/'execution.json')['status']=='failed'
    remaining=read(primary/'revision.json')['remaining_seconds']-read(primary/'execution.json')['elapsed']-read(secondary/'execution.json')['elapsed']
    limit=diagnostic_limit(remaining)
    idle_service()
    available=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    assert available>=c['min_host_available_bytes'],'insufficient available RAM; do not flush swap'
    bases={'Q4_K_M':str(training/'base-Q4_K_M.gguf'),'Q8_0':str(secondary/'base-Q8_0.gguf')}
    expected=read(primary/'revision.json')['inputs'];assert digest(Path(bases['Q4_K_M']))==expected[bases['Q4_K_M']]
    assert digest(Path(bases['Q8_0']))==read(secondary/'conversion.json')['output_sha256']
    assert digest(primary/'final-adapter.gguf')==read(primary/'conversion.json')['output_sha256']
    amendment=ROOT/'docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-fidelity-closeout-amendment-2026-09-15.md'
    inputs=[amendment,primary/'revision.json',primary/'in-sample-cases.json',primary/'final-adapter.gguf',*[Path(x) for x in bases.values()],Path(__file__),HERE/'evaluate.py',HERE/'runtime.py',HERE/'pilot.py',HERE/'config.json',Path('/usr/bin/llama-server')]
    r.mkdir(parents=True)
    save(r/'protocol.json',{'version':'ornith-post-failure-fidelity/1','at':time.time(),'primary':str(primary),'bases':bases,'original_amendment_commit':COMMIT,'implementation_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,timeout=10).strip(),'amendment_sha256':digest(amendment),'inputs':{str(p):digest(p) for p in inputs},'sampler':read(primary/'revision.json')['sampler']|{'temperature':0,'top_k':1},'deadline_seconds':limit,'remaining_budget_seconds':remaining,'scope':'One diagnostic only, 32 scored requests plus deployment probes; no acquisition/retrain/heldout/relaunch.'})
    unit='mrgr-lora-9b-fidelity-closeout-20260915'
    save(r/'execution.json',{'unit':unit,'started':time.time(),'status':'started','limit_seconds':limit})
    args=['systemd-run','--unit='+unit,'--property=User=svnbjrn','--property=WorkingDirectory='+str(ROOT),'--property=MemoryMax='+str(c['host_memory_bytes']),'--property=MemorySwapMax=0','--property=OOMPolicy=stop','--property=KillMode=control-group','--property=RuntimeMaxSec='+str(limit),'--property=ExecStopPost=/usr/bin/python3 '+str(HERE/'q8_secondary.py')+' finish '+str(r),'--property=StandardOutput=append:'+str(r/'execution.log'),'--property=StandardError=append:'+str(r/'execution.log'),*['--setenv='+k+'='+v for k,v in stage_environment(c).items()],'/usr/bin/python3','-u',str(HERE/'q8_secondary.py'),'diagnostic-worker',str(r)]
    result=subprocess.run(['ssh','vinbonesjr',shlex.join(args)],capture_output=True,text=True,timeout=60);save(r/'launch.json',{'args':args,'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr});assert result.returncode==0,result.stderr
    print(result.stdout+result.stderr)

if __name__=='__main__':main()
