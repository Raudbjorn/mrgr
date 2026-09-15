"""Durable training unit with immutable input pins and crash-safe terminal receipts."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
from runtime import HERE,read,save,digest,stage_environment,api

mode=sys.argv[1];r=Path(sys.argv[2]);c=read(HERE/'config.json')
if mode=='finish':
    record=read(r/'training.execution.json')
    result=os.environ.get('SERVICE_RESULT','unknown')
    valid=(r/'training-result.json').exists() and read(r/'training-result.json').get('valid')
    record.update(status='complete' if result=='success' and valid else 'failed',service_result=result,exit_code=os.environ.get('EXIT_STATUS'),finished=time.time(),elapsed=time.time()-record['started'])
    save(r/'training.execution.json',record)
    if record['status']=='failed':save(r/'train-status.json',{'stage':'failed','service_result':result,'at':time.time()})
    subprocess.run(['/usr/bin/logger','-t','mrgr-lora','Training '+record['status']+': '+str(r)],timeout=10,check=False)
    import shutil
    if shutil.which('notify-send'):
        try:
            subprocess.run(['notify-send','LoRA training '+record['status'],str(r)],env=os.environ | {'DBUS_SESSION_BUS_ADDRESS':'unix:path=/run/user/'+str(os.getuid())+'/bus'},timeout=10,check=False)
        except subprocess.TimeoutExpired:pass
elif mode=='worker':
    manifest=read(r/'training.execution.json')
    assert manifest['config']==c
    for path,sha in manifest['inputs'].items():assert digest(Path(path))==sha, 'training input drift: '+path
    os.execv(c['storage']+'/venv/bin/python',[c['storage']+'/venv/bin/python','-u',str(HERE/'train.py'),'train',str(r)])
elif mode=='start':
    assert not (r/'training.execution.json').exists(),'refuse duplicate training launch'
    assert read(r/'full-model-check.json')['valid'] and read(r/'export-readiness.json')['valid']
    assert api(c,'/health')['status']=='ok'
    assert c['served_model'] in [m['id'] for m in api(c,'/v1/models')['data']]
    assert all(not slot['is_processing'] for slot in api(c,'/slots'))
    available=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    assert available>=c['min_host_available_bytes']
    inputs=[*HERE.glob('*.py'),HERE/'config.json',HERE/'uv.lock',r/'tokenized.json',r/'checkpoint.json',r/'full-model-check.json',r/'export-readiness.json']
    spent=3000+sum(read(p).get('elapsed',c['compute_seconds']) for p in r.glob('*.execution.json'))
    limit=min(7200,int(c['compute_seconds']-spent));assert limit>=3600,'insufficient remaining compute budget'
    unit='mrgr-lora-9b-training-20260915';env=stage_environment(c)
    record={'unit':unit,'started':time.time(),'status':'started','config':c,'environment':env,'inputs':{str(p):digest(p) for p in inputs},'prior_compute_seconds_conservative':spent,'limit_seconds':limit}
    save(r/'training.execution.json',record)
    args=['systemd-run','--unit='+unit,'--property=User=svnbjrn','--property=WorkingDirectory='+str(HERE.parents[1]),'--property=MemoryMax='+str(c['host_memory_bytes']),'--property=MemorySwapMax=0','--property=OOMPolicy=stop','--property=KillMode=control-group','--property=RuntimeMaxSec='+str(limit),'--property=ExecStartPre=+/usr/bin/systemctl stop '+c['service'],'--property=ExecStopPost=/usr/bin/python3 '+str(HERE/'launch_training.py')+' finish '+str(r),'--property=ExecStopPost=+/usr/bin/systemctl start '+c['service'],'--property=StandardOutput=append:'+str(r/'training.log'),'--property=StandardError=append:'+str(r/'training.log'),*['--setenv='+k+'='+v for k,v in env.items()],'/usr/bin/flock','-n',c['storage']+'/training.lock','/usr/bin/python3',str(HERE/'launch_training.py'),'worker',str(r)]
    p=subprocess.run(['ssh','vinbonesjr',shlex.join(args)],capture_output=True,text=True,timeout=60)
    save(r/'training-launch.json',{'command':args,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
    assert p.returncode==0,p.stderr
    print(p.stdout+p.stderr)
else:raise ValueError('expected start, worker or finish')
