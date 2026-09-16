"""Admission preflight for five-fold CV; invalid controls stop before training."""
import argparse
import collections
import json
import math
from pathlib import Path

from runtime import ROOT, HERE, read, save, digest

SEED = 20260916
PROTOCOL = ROOT/'docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-cross-validation-2026-09-16.md'
PUBLIC = ROOT/'evidence/h0/ornith-9b-cross-validation-2026-09-16'
STORAGE = Path('/mnt/mrgr/ornith-lora')
TRAINING = STORAGE/'runs/9b-training-2026-09-15'
PREPARED = STORAGE/'runs/9b-selector-2026-09-14-r2'
SOURCE = ROOT/'evidence/h0/v3-candidate-repair-2026-09-07/run/cases.json'
TRAIN_KEYS = {'model','revision','rank','alpha','dropout','learning_rate','gradient_accumulation','target_modules','max_training_tokens','epochs','warmup_ratio','allow_model_cpu_offload','seed'}
CONFIG_KEYS = TRAIN_KEYS | {'storage','service','served_model','execution_path','oneapi_device_selector','ocl_icd_vendors','sampler','wall_seconds','cleanup_seconds','training_available_bytes','training_memory_bytes','inference_memory_bytes','folds','repeats'}


def configuration():
    old = read(HERE/'config.json')
    c = {k:old[k] for k in TRAIN_KEYS | {'storage','service','served_model','execution_path','oneapi_device_selector','ocl_icd_vendors'}}
    c.update(seed=SEED, sampler=read(STORAGE/'runs/9b-revision-2026-09-15/revision.json')['sampler'],wall_seconds=86400,cleanup_seconds=300,training_available_bytes=24*1024**3,training_memory_bytes=48*1024**3,inference_memory_bytes=16*1024**3,folds=5,repeats=3)
    return c


def validate_config(c):
    assert set(c)==CONFIG_KEYS, 'unknown or missing configuration keys'
    assert c['wall_seconds']==86400 and c['cleanup_seconds']==300
    assert c['folds']==5 and c['repeats']==3 and c['seed']==SEED
    assert not c['allow_model_cpu_offload']
    assert (c['rank'],c['alpha'],c['epochs'],c['gradient_accumulation'])==(8,16,3,4)
    assert c['sampler']['top_k']==40 and c['sampler']['max_tokens']==4096


def partition(cases):
    """Connected components, then seeded largest-first greedy bin packing."""
    parent={c['id']:c['id'] for c in cases}
    def find(x):
        while parent[x]!=x:
            parent[x]=parent[parent[x]];x=parent[x]
        return x
    seen={}
    for c in cases:
        provenance=c['repository_provenance']['body'];origin=provenance.get('source',provenance)
        assert origin['full_name'].lower()==c['cluster_id'].lower(), 'lineage provenance mismatch'
        triple=[c[k].replace('\r\n','\n') for k in ['base','ours','theirs']]
        keys=[('lineage',c['cluster_id']),('repository',origin['id']),('content',digest(json.dumps(triple))),*[('parent',c['git'][side]) for side in ['ours','theirs']]]
        for key in keys:
            if key in seen:parent[find(c['id'])]=find(seen[key])
            seen[key]=c['id']
    groups=collections.defaultdict(list)
    for c in cases:groups[find(c['id'])].append(c['id'])
    components=[sorted(v) for v in groups.values()]
    components.sort(key=lambda ids:(-len(ids),digest(str(SEED)+':'+':'.join(ids))))
    assert len(components)>=5,'fewer than five disjoint groups'
    folds=[[] for _ in range(5)];counts=[0]*5;mapping={}
    for ids in components:
        f=min(range(5),key=lambda i:(counts[i],len(folds[i]),i));folds[f].append(ids);counts[f]+=len(ids)
        group=digest(':'.join(ids))
        for id in ids:mapping[id]={'fold':f,'group':group}
    assert set(mapping)==set(parent)
    return mapping


def audit(run):
    assert not run.exists(), 'new audit directory required'
    c=configuration();validate_config(c)
    tokens=read(TRAINING/'tokenized.json');prepared=read(PREPARED/'prepared.json')
    assert tokens['prepared_sha256']==digest(PREPARED/'prepared.json')
    ids={x['id'] for x in tokens['examples']};assert len(ids)==57
    examples=[x for x in prepared['examples'] if x['id'] in ids]
    cases=[x for x in read(SOURCE) if x['id'] in ids]
    assert len(examples)==len(cases)==57
    assert len({(x['repo'],x['event']) for x in cases})==57, 'duplicate event'
    by_id={x['id']:x for x in cases}
    files=[SOURCE,TRAINING/'tokenized.json',PREPARED/'prepared.json',TRAINING/'checkpoint.json']
    candidate_counts=collections.Counter();per_cell=collections.defaultdict(collections.Counter)
    rows=[]
    for e in examples:
        case=by_id[e['id']];receipt=PREPARED/'oracle'/f"{e['id']}.json";v=read(receipt);files.append(receipt)
        row={'id':e['id'],'lineage':e['lineage'],'event':e['event'],'cell':e['cell'],'receipt_sha256':digest(receipt),'status':'verified','issues':[]}
        rows.append(row)
        try:
            assert digest(receipt)==e['receipt_sha256'], 'receipt drift'
            assert v['source_archive_sha256']==digest(SOURCE), 'source archive drift'
            assert v['status']=='admitted' and v['oracle']['valid'], 'prior admission absent'
            assert len(v['oracle']['reference'])==3 and all(x['pass'] for x in v['oracle']['reference']), 'reference controls'
            controls=control_audit(v['oracle']['mutations'])
            row.update(controls)
            if controls['verified_rejections']<2:row['issues'].append('fewer than two verified compiling test-rejected mutations')
            labels={x['id']:x['evaluation']['pass'] for x in v['candidates']}
            assert labels==e['candidate_labels'] and all(type(x) is bool for x in labels.values()), 'label mismatch'
            payload=json.loads(e['messages'][1]['content'])
            assert {x['id']:x['text'] for x in payload['candidates']}=={x['id']:x['text'] for x in v['candidates']}, 'candidate payload mismatch'
            for item in v['candidates']:
                ev=item['evaluation'];assert item['id']=='cand-'+digest(item['text']), 'candidate hash mismatch'
                assert ev['category'] in ['behavioral-pass','build-failure','test-failure'] and ev.get('reason') not in ['test-timeout','test-completion-contract'], 'unresolved candidate label'
            target=next((x['id'] for x in payload['candidates'] if labels[x['id']]),'halt')
            assert e['target']=={'choice':target}, 'target mismatch'
            assert case['era']['version']=='historical-root-build-era/1' and e['cell']==case['cell'], 'historical stratum mismatch'
            candidate_counts[sum(labels.values())]+=1;per_cell[e['cell']]['cases']+=1;per_cell[e['cell']]['available']+=any(labels.values())
        except (AssertionError,KeyError,ValueError) as error:row['issues'].append(str(error))
        if row['issues']:row['status']='incomplete-admission'
    mapping=partition(cases)
    provisional=[]
    for f in range(5):
        held=[e for e in examples if mapping[e['id']]['fold']==f]
        training=[e for e in examples if mapping[e['id']]['fold']!=f]
        assert not {e['lineage'] for e in held}&{e['lineage'] for e in training}
        provisional.append({'fold':f,'train_cases':len(training),'test_cases':len(held),'test_lineages':len({e['lineage'] for e in held}),'planned_steps':3*math.ceil(len(training)/4),'cells':dict(collections.Counter(e['cell'] for e in held))})
    problems=[row for row in rows if row['issues']]
    summary={'version':'ornith-lineage-cv-audit/1','finding':'INCOMPLETE (admission audit)' if problems else 'AUDIT PASSED; execution not implemented', 'cases':57,'lineages':len({e['lineage'] for e in examples}),'groups':len({m['group'] for m in mapping.values()}),'candidate_pass_counts':dict(candidate_counts),'cells':dict(per_cell),'historical_exclusions':tokens['excluded'],'provisional_folds':provisional,'rows':rows,'training_runs':0,'model_requests':0,'terminal':bool(problems),'next':'Stop; no case removal, replacement, revalidation or training under this protocol.' if problems else 'Implement and validate coordinator before any execution.'}
    run.mkdir(parents=True)
    save(run/'config.json',c);save(run/'audit.json',summary)
    save(run/'inputs.json',{str(p):digest(p) for p in files})
    save(PUBLIC/'audit.json',summary)
    save(PUBLIC/'inputs.json',{'files':[{'name':str(p).replace(str(ROOT),'$REPOSITORY').replace(str(STORAGE),'$PILOT_STORAGE'),'sha256':digest(p)} for p in files]})
    print(json.dumps({'finding':summary['finding'],'cases':57,'problems':len(problems),'training_runs':0,'model_requests':0}))
    return summary


def control_audit(mutations):
    records=[]
    for m in mutations:
        stages=m.get('stages',[])
        clean=lambda s:s.get('status')==0 and not s.get('error') and not s.get('signal')
        rejected=(m.get('category')=='test-failure' and m.get('reason') not in ['test-timeout','test-completion-contract'] and len(stages)==2 and clean(stages[0]) and [s.get('stage') for s in stages]==['build','test'] and type(stages[1].get('status')) is int and stages[1]['status']!=0 and not stages[1].get('error') and not stages[1].get('signal'))
        records.append({'name':m.get('name'),'category':m.get('category'),'reason':m.get('reason'),'candidate_sha256':m.get('candidate_sha256'),'verified_rejection':rejected,'stages':[{'stage':s.get('stage'),'status':s.get('status'),'signal':s.get('signal'),'error':s.get('error')} for s in stages]})
    return {'verified_rejections':sum(r['verified_rejection'] for r in records),'controls':records}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['audit']);parser.add_argument('run',type=Path)
    args=parser.parse_args();audit(args.run)
