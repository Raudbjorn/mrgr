"""Bounded acquisition of fresh lineages; never calls an inference endpoint."""
import collections
import csv
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from runtime import ROOT,HERE,read,save,digest,stage_environment


def exposure_records(ledger):
    """Case-bearing archives establish inspection; names in discovery lists do not."""
    records=[]
    def visit(value,path,category):
        if isinstance(value,dict):
            repo=value.get('repo');event=value.get('event',value.get('merge_sha'))
            if isinstance(repo,str) and re.fullmatch(r'[\w.-]+/[\w.-]+',repo) and isinstance(event,str):
                meta=value.get('repository_provenance',{}).get('body',{})
                records.append({'repo':repo.lower(),'lineage':str(value.get('cluster_id',repo)).lower(),'event':event,'category':category,'source':path,'repository_id':meta.get('source',meta).get('id')})
            for child in value.values():
                if isinstance(child,(dict,list)):visit(child,path,category)
        elif isinstance(value,list):
            for child in value:visit(child,path,category)
    for record in ledger['files']:
        p=ROOT/record['path']
        if p.name not in ['cases.json','inputs.jsonl']:continue
        assert digest(p)==record['sha256'],'archive changed: '+str(p)
        raw=p.read_text();values=[json.loads(x) for x in raw.splitlines() if x.strip()] if p.suffix=='.jsonl' else json.loads(raw)
        category='development-inspected'
        if any((p.parent/name).exists() for name in ['mercury','minimax','local','results.jsonl']):category='model-evaluated'
        visit(values,record['path'],category)
    return records


def freeze(r,c):
    assert not (r/'frame.json').exists()
    original=Path(c['storage'])/'runs/9b-selector-2026-09-14-r2/inventory.json'
    records=exposure_records(read(original))
    for case in read(ROOT/c['source_cases']):
        records.append({'repo':case['repo'],'lineage':case['cluster_id'],'event':case['event'],'category':'training-source','source':c['source_cases']})
    old=Path(c['storage'])/'runs/9b-heldout-2026-09-15/acquisition.json'
    for row in read(old)['rows']:
        records.append({'repo':row['repo'],'lineage':row.get('lineage',row['repo']),'category':'acquisition-only','source':str(old),'instrument':'ornith-heldout-acquisition/1','events':row.get('selected_events',[])})
    names={x[k].lower() for x in records if x['category']!='acquisition-only' for k in ['repo','lineage']}
    save(r/'exposure-ledger.json',{'records':records,'policy':'Acquisition-only does not establish model exposure; training-source and development/model-inspected lineages excluded.'})
    source=ROOT/'evidence/h0/v3-round2-2026-09-06/repos-go.csv'
    rows=list(csv.DictReader(source.open()))
    banned=['awesome','interview','learn','book','example','tutorial','patterns','thealgorithms']
    eligible=[x for x in rows if x['repository'].lower() not in names and x['archived']=='False' and x['disabled']=='False' and x['created_at']<'2018' and int(x['size'])<20000 and not any(t in x['repository'].lower() for t in banned)]
    eligible.sort(key=lambda x:(-int(x['stars']),x['repository'].lower()))
    save(r/'frame.json',{'version':'ornith-heldout-acquisition/2','at':time.time(),'exposure_source_sha256':digest(original),'exposure_ledger_sha256':digest(r/'exposure-ledger.json'),'source_sha256':digest(source),'names':sorted(names),'repository_ids':sorted({x['repository_id'] for x in records if isinstance(x.get('repository_id'),int)}),'repositories':eligible[:100],'max_events':1000,'events_per_repository':10,'rule':'One revision only. Pinned compact pre-2018 Go convenience frame, size below 20000 KiB, recorded star/name order; up to 100 repositories and 1000 seeded merge replays, at most ten per repository. Acquisition-only reuse allowed; no population-representativeness claim. Six per cell, one per lineage, no reweighting.','script_sha256':digest(Path(__file__))})
    print({'selected_repositories':len(eligible[:100]),'excluded_lineages':len(names)})


def acquire(r,c):
    frame=read(r/'frame.json');assert digest(Path(__file__))==frame['script_sha256']
    assert not (r/'acquisition.json').exists(),'resume requires resolving prior attempt records explicitly'
    env=os.environ|stage_environment(c)
    token=subprocess.check_output(['/home/svnbjrn/.local/bin/gh-token-painframe'],text=True,timeout=30).strip()
    gh_env=env|{'GH_TOKEN':token}
    records=[];events=0
    def command(args,where,timeout=600,github=False):
        start=time.monotonic();p=subprocess.Popen(args,cwd=ROOT,env=gh_env if github else env,stdout=(where.with_suffix('.stdout')).open('wb'),stderr=(where.with_suffix('.stderr')).open('wb'),start_new_session=True)
        while p.poll() is None:
            save(r/'status.json',{'stage':'acquiring','repositories':len(records),'events':events,'command':args[:4],'heartbeat':time.time(),'elapsed':time.monotonic()-start})
            if time.monotonic()-start>timeout:os.killpg(p.pid,signal.SIGKILL);p.wait();break
            time.sleep(2)
        save(where.with_suffix('.receipt.json'),{'command':args,'exit_code':p.returncode,'elapsed':time.monotonic()-start})
        assert p.returncode==0,'command failed: '+str(where)
        return where.with_suffix('.stdout').read_text()
    try:
        for row in frame['repositories']:
            if events>=frame['max_events']:break
            assert __import__('shutil').disk_usage(c['storage']).free>12*1024**3,'disk floor reached'
            repo=row['repository'].lower();d=r/repo.replace('/','--');d.mkdir()
            record={'repo':repo,'status':'started'};records.append(record);save(r/'acquisition.json',{'complete':False,'events':events,'rows':records})
            try:
                meta=json.loads(command(['gh','api','repos/'+repo],d/'metadata',github=True));root=meta.get('source',meta)
                lineage=root['full_name'].lower();record.update(lineage=lineage,repository_id=root['id'])
                assert not meta['private'] and not meta.get('archived') and not meta.get('disabled')
                assert lineage not in frame['names'] and root['id'] not in frame['repository_ids'],'exposed fork/rename lineage'
                assert not any(x.get('lineage')==lineage for x in records[:-1]),'duplicate fresh lineage'
                assert meta.get('license') and meta['license'].get('spdx_id') not in [None,'NOASSERTION'],'missing identifiable license'
                mirror=d/'mirror.git'
                command(['git','clone','--bare','--single-branch','--filter=blob:none','https://github.com/'+repo+'.git',str(mirror)],d/'clone')
                raw=command(['git','--git-dir='+str(mirror),'rev-list','--min-parents=2','--max-parents=2','HEAD'],d/'merge-list')
                commits=sorted(raw.split(),key=lambda sha:digest(str(c['seed'])+':'+repo+':'+sha))[:frame['events_per_repository']]
                record['selected_events']=commits
                for sha in commits:
                    if events>=frame['max_events']:break
                    events+=1;save(r/'acquisition.json',{'complete':False,'events':events,'rows':records})
                    corpus=d/(sha+'.scan.jsonl');triples=d/(sha+'.triples.jsonl')
                    command(['node','packages/core/bin/mrgr-wp0.mjs','scan-local',str(mirror),'--rev',sha+'^!','--out',str(corpus),'--jobs','1','--conflict-style','diff3'],d/(sha+'-scan'))
                    command(['node','packages/core/bin/mrgr-wp0.mjs','materialize',str(corpus),'--out',str(triples)],d/(sha+'-materialize'))
                    if not triples.read_text().strip():continue
                    config={'repo':repo,'repository':str(mirror),'triples':str(triples),'output':str(d/(sha+'-screen')),'limit':1,'exclude_events':[]}
                    cfg=d/(sha+'-screen-config.json');save(cfg,config)
                    command(['node','evidence/h0/v3-screen-go.mjs',str(cfg)],d/(sha+'-screen-command'),1800)
                    found=read(Path(config['output'])/'candidates.json') if (Path(config['output'])/'candidates.json').exists() else []
                    if found:command(['node',str(HERE/'admit.mjs'),str(Path(config['output'])/'candidates.json'),str((d/'metadata').with_suffix('.stdout')),str(d/(sha+'-admission'))],d/(sha+'-admit-command'),1800)
                record['status']='screened'
            except Exception as e:record.update(status='excluded-or-incomplete',reason=str(e))
            save(r/'acquisition.json',{'complete':False,'events':events,'rows':records})
        save(r/'acquisition.json',{'complete':True,'operational_complete':True,'finding':'INCOMPLETE pending full admission','events':events,'rows':records})
        save(r/'status.json',{'stage':'acquisition-complete','repositories':len(records),'events':events,'model_requests':0,'next':'full oracle admission and frozen four-cell allocation before scoring'})
    except BaseException as e:
        save(r/'status.json',{'stage':'failed','error':repr(e),'events':events});raise

if __name__=='__main__':
    c=read(HERE/'config.json');r=Path(sys.argv[2]);r.mkdir(parents=True,exist_ok=True)
    {'freeze':freeze,'acquire':acquire}[sys.argv[1]](r,c)
