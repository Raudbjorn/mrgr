"""One frozen repair round, supervised by systemd through terminal receipts."""
import collections
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
from runtime import ROOT,HERE,CELLS,read,save,digest,stage_environment
from pilot import messages,target
from heldout import freeze,acquire
from evaluate import evaluate,api
from export_check import CONVERTER


def correct(r,c):
    old=Path(c['storage'])/'runs/9b-heldout-2026-09-15'
    rows=[]
    reasons={'59eb51':'INCOMPLETE: missing GOPATH dependencies; no behavioral reference failure established','7f94f4':'INCOMPLETE: missing GOPATH dependencies; no behavioral reference failure established','38511c':'INELIGIBLE: no executable package tests','256c4c':'EXCLUDED: private dependency unavailable','108751':'INELIGIBLE: generated source; localization discrepancy not causally resolved'}
    for path in sorted(old.glob('*/*-screen/*/receipt.json')):
        record=read(path);event=record['event']
        match=next((v for k,v in reasons.items() if event.startswith(k)),None)
        if match:rows.append({'event':event,'receipt':str(path),'sha256':digest(path),'original_reason':record.get('reason'),'corrected_classification':match})
    assert len(rows)==5,'expected five original receipts'
    save(r/'prior-round-correction.json',{'finding':'INCOMPLETE (instrument)','quality_null':False,'model_requests':0,'original_acquisition_sha256':digest(old/'acquisition.json'),'receipts':rows,'training':{'source_cases':60,'trained_cases':57,'length_exclusions':3,'steps':45},'deployment':'Earlier export smoke used feasibility-adapter, not final trained adapter.','no_supply_absence_claim':True})


def profile(c):
    params=api('/props')['default_generation_settings']['params']
    names=['temperature','dynatemp_range','dynatemp_exponent','top_k','top_p','min_p','top_n_sigma','xtc_probability','xtc_threshold','typical_p','repeat_last_n','repeat_penalty','presence_penalty','frequency_penalty','dry_multiplier','dry_base','dry_allowed_length','dry_penalty_last_n','mirostat','mirostat_tau','mirostat_eta','adaptive_target','adaptive_decay','min_keep','samplers']
    assert params['top_k']==40,'9B sampler differs from reviewed profile'
    return {k:params[k] for k in names}|{'temperature':0.6,'top_p':0.95,'min_p':0.05,'max_tokens':4096}


def allocate(rows,c):
    selected=[];counts=collections.Counter();lineages=set();parents=set();contents=set()
    for row in sorted(rows,key=lambda x:digest(f'{c["seed"]}:{x["case"]["repo"]}:{x["case"]["event"]}')):
        case=row['case'];lineage=case['cluster_id'];cell=case['cell'];ps={case['git']['ours'],case['git']['theirs']};content=digest(json.dumps([case[k] for k in ['base','ours','theirs']]))
        if lineage in lineages or ps&parents or content in contents or counts[cell]>=6:continue
        selected.append(row);counts[cell]+=1;lineages.add(lineage);parents|=ps;contents.add(content)
    return selected,{cell:counts[cell] for cell in CELLS}


def worker(r,c):
    manifest=read(r/'revision.json')
    for path,sha in manifest['inputs'].items():assert digest(Path(path))==sha,'instrument/input drift: '+path
    training=Path(c['storage'])/'runs/9b-training-2026-09-15';base=training/'base-Q4_K_M.gguf';adapter=r/'final-adapter.gguf'
    command=[c['storage']+'/venv/bin/python',str(CONVERTER/'convert_lora_to_gguf.py'),'--base',read(training/'checkpoint.json')['snapshot'],'--outfile',str(adapter),'--outtype','f16',str(training/'adapter')]
    with (r/'conversion.log').open('wb') as log:
        started=time.monotonic();p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=600)
    save(r/'conversion.json',{'command':command,'exit_code':p.returncode,'elapsed':time.monotonic()-started,'source_adapter_sha256':digest(training/'adapter/adapter_model.safetensors'),'output_sha256':digest(adapter) if adapter.exists() else None});assert p.returncode==0
    prepared=read(Path(c['storage'])/'runs/9b-selector-2026-09-14-r2/prepared.json')['examples']
    trained={x['id'] for x in read(training/'tokenized.json')['examples']}
    smoke=[]
    for cell in CELLS:
        smoke.extend(sorted([x for x in prepared if x['cell']==cell and x['id'] in trained],key=lambda x:digest(x['id']))[:2])
    assert len(smoke)==8
    save(r/'in-sample-cases.json',smoke)
    def gpu(examples,directory,repeats,scope):
        assert all(not x['is_processing'] for x in api('/slots')),'ordinary server busy'
        subprocess.run(['ssh','vinbonesjr','systemctl stop '+shlex.quote(c['service'])],check=True,timeout=120)
        try:return evaluate(directory,examples,manifest['sampler'],base,adapter,repeats,c['seed'],scope)
        finally:
            subprocess.run(['ssh','vinbonesjr','systemctl start '+shlex.quote(c['service'])],check=True,timeout=120)
            deadline=time.monotonic()+300
            while True:
                try:
                    if api('/health')['status']=='ok':break
                except OSError:pass
                assert time.monotonic()<deadline,'ordinary server failed readiness'
                time.sleep(2)
    save(r/'status.json',{'stage':'in-sample-pipeline-check','at':time.time()})
    smoke_result=gpu(smoke,r/'in-sample',1,'IN-SAMPLE PIPELINE ONLY; NOT EFFICACY')
    assert smoke_result['complete'],'pipeline incomplete'
    # Model quality is not a readiness criterion; malformed answers are retained outcomes.
    acquire(r/'acquisition',c)
    admissions=[]
    for p in sorted((r/'acquisition').glob('*/*-admission/admission.json')):
        for row in read(p):
            if row['status']=='admitted':admissions.append(row|{'receipt':str(p),'receipt_sha256':digest(p)})
    failures=[]
    for path in sorted((r/'acquisition').glob('*/*-screen/frame.json')):
        failures.extend({'source':str(path),'event':x['event'],'path':x['path'],'reason':x['reason']} for x in read(path)['rows'] if x['reason'])
    for path in sorted((r/'acquisition').glob('*/*-screen/*/receipt.json')):
        row=read(path)
        if row.get('reason'):failures.append({'source':str(path),'event':row['event'],'reason':row['reason']})
    for path in sorted((r/'acquisition').glob('*/*-admission/admission.json')):
        failures.extend({'source':str(path),'event':x['event'],'reason':x['reason']} for x in read(path) if x.get('reason'))
    reason_counts=dict(collections.Counter(x['reason'] for x in failures))
    save(r/'screen-outcomes.json',{'rows':failures,'reason_counts':reason_counts,'note':'pre-screen hunk exclusions and attempted event screens have different denominators; counts are not independent cases'})
    selected,counts=allocate(admissions,c)
    save(r/'allocation.json',{'counts':counts,'admitted':len(admissions),'selected':selected,'complete':all(n==6 for n in counts.values()),'rule':'Frozen seeded order, one per lineage; parents/content deduplicated; equal cells, no reweighting'})
    if not all(n==6 for n in counts.values()):
        save(r/'result.json',{'finding':'INCOMPLETE','reason':'bounded revision lacks required admitted fresh cells; not a quality null or proof of supply absence','counts':counts,'screen_reason_counts':reason_counts,'fresh_model_requests':0,'in_sample_pipeline_only':smoke_result,'next':'terminal; no further acquisition authorized by this protocol'})
        return
    examples=[]
    for row in selected:
        case=row['case'];prompt=messages(case,row['candidates'],c['seed']);ids=[x['id'] for x in json.loads(prompt[1]['content'])['candidates']]
        examples.append({'id':case['id'],'lineage':case['cluster_id'],'cell':case['cell'],'messages':prompt,'target':target(row['candidates'],ids),'candidate_labels':{x['id']:x['evaluation']['pass'] for x in row['candidates']},'receipt_sha256':row['receipt_sha256']})
    save(r/'fresh-cases.json',examples)
    result=gpu(examples,r/'fresh-evaluation',3,'fresh compact-repository convenience frame; exploratory 9B selector')
    save(r/'result.json',result)


def main():
    mode=sys.argv[1];r=Path(sys.argv[2]);c=read(HERE/'config.json')
    if mode=='finish':
        execution=read(r/'execution.json');ok=os.environ.get('SERVICE_RESULT')=='success' and (r/'result.json').exists()
        execution.update(status='complete' if ok else 'failed',service_result=os.environ.get('SERVICE_RESULT'),exit_status=os.environ.get('EXIT_STATUS'),elapsed=time.time()-execution['started'],finished=time.time());save(r/'execution.json',execution)
        save(r/'status.json',{'stage':execution['status'],'finding':read(r/'result.json').get('finding') if ok else 'INCOMPLETE (execution)','at':time.time()})
        subprocess.run(['logger','-t','mrgr-lora','Revision '+execution['status']+': '+str(r)],timeout=10)
        return
    if mode=='worker':worker(r,c);return
    assert mode=='start' and not r.exists(),'new revision directory required'
    assert api('/health')['status']=='ok' and c['served_model'] in [x['id'] for x in api('/v1/models')['data']]
    r.mkdir(parents=True);correct(r,c);sampler=profile(c)
    (r/'acquisition').mkdir();freeze(r/'acquisition',c)
    prior=[]
    for path in (Path(c['storage'])/'runs').glob('*/*.execution.json'):
        value=read(path);prior.append({'path':str(path),'sha256':digest(path),'elapsed':value.get('elapsed',0)})
    # Also count the first acquisition's subprocess time; it had no enclosing execution receipt.
    old=Path(c['storage'])/'runs/9b-heldout-2026-09-15'
    old_seconds=sum(read(p).get('elapsed',0) for p in old.glob('*/*.receipt.json'))
    prior_seconds=sum(x['elapsed'] for x in prior)+old_seconds
    limit=int(c['compute_seconds']-prior_seconds);assert limit>3600,'remaining cumulative budget too short'
    training=Path(c['storage'])/'runs/9b-training-2026-09-15'
    inputs=[*HERE.glob('*.py'),*HERE.glob('*.mjs'),HERE/'config.json',HERE/'uv.lock',ROOT/'evidence/h0/v3-screen-go.mjs',ROOT/'evidence/h0/go-locked-deps.py',ROOT/'evidence/h0/v3.mjs',ROOT/'evidence/h0/v3-data.mjs',r/'acquisition/frame.json',r/'acquisition/exposure-ledger.json',training/'adapter/adapter_model.safetensors',training/'adapter/adapter_config.json',training/'base-Q4_K_M.gguf',CONVERTER/'convert_lora_to_gguf.py',Path('/usr/bin/llama-server')]
    inputs.extend(p for folder in [ROOT/'packages/core/dist/evaluation',ROOT/'packages/mechanisms/dist',ROOT/'evidence/h0/v3-contrast-review-2026-09-07',ROOT/'evidence/h0/v3-candidate-repair-2026-09-07'] for p in folder.glob('*') if p.suffix in ['.js','.mjs'])
    inputs.extend((ROOT/'evidence/h0').glob('v3-*.mjs'));inputs.append(ROOT/'evidence/h0/v2.mjs')
    save(r/'revision.json',{'version':'ornith-repair-round/1','frozen_at':time.time(),'config':c,'sampler':sampler,'prior_executions':prior,'prior_acquisition_seconds':old_seconds,'remaining_seconds':limit,'inputs':{str(p):digest(p) for p in inputs},'stop':'One 100-repository/1000-replay revision only; per-cell shortfall is INCOMPLETE; no model-quality stopping/tuning; no CV.'})
    unit='mrgr-lora-9b-revision-20260915';save(r/'execution.json',{'unit':unit,'started':time.time(),'status':'started','limit_seconds':limit})
    args=['systemd-run','--unit='+unit,'--property=User=svnbjrn','--property=WorkingDirectory='+str(ROOT),'--property=MemoryMax='+str(c['host_memory_bytes']),'--property=MemorySwapMax=0','--property=OOMPolicy=stop','--property=KillMode=control-group','--property=RuntimeMaxSec='+str(limit),'--property=ExecStopPost=/usr/bin/python3 '+str(HERE/'revision.py')+' finish '+str(r),'--property=ExecStopPost=+/usr/bin/systemctl start '+c['service'],'--property=StandardOutput=append:'+str(r/'execution.log'),'--property=StandardError=append:'+str(r/'execution.log'),*['--setenv='+k+'='+v for k,v in stage_environment(c).items()],'/usr/bin/flock','-n',c['storage']+'/training.lock','/usr/bin/python3','-u',str(HERE/'revision.py'),'worker',str(r)]
    p=subprocess.run(['ssh','vinbonesjr',shlex.join(args)],capture_output=True,text=True,timeout=60);save(r/'launch.json',{'args':args,'status':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
    print(str(r));print(p.stdout+p.stderr)

if __name__=='__main__':main()
