"""Materialize event-pinned GOPATH dependencies; never resolve versions by date/latest."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib


def pins(root):
    root=Path(root)
    if (root/'Gopkg.lock').exists():
        return 'Gopkg.lock',[(x['name'],x.get('revision','')) for x in tomllib.loads((root/'Gopkg.lock').read_text()).get('projects',[])]
    if (root/'Godeps/Godeps.json').exists():
        return 'Godeps/Godeps.json',[(x['ImportPath'],x.get('Rev','')) for x in json.loads((root/'Godeps/Godeps.json').read_text()).get('Deps',[])]
    if (root/'glide.lock').exists():
        import yaml
        data=yaml.safe_load((root/'glide.lock').read_text())
        return 'glide.lock',[(x['name'],x.get('version','')) for x in data.get('imports',[])+data.get('testImports',[])]
    return None,[]


def source(name):
    assert re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+',name) and '..' not in name.split('/'),'unsafe import'
    parts=name.split('/')
    if parts[0]=='github.com' and len(parts)>=3:return '/'.join(parts[:3]),'https://github.com/'+'/'.join(parts[1:3])+'.git'
    if parts[:2]==['golang.org','x'] and len(parts)>=3:return '/'.join(parts[:3]),'https://github.com/golang/'+parts[2]+'.git'
    if parts[0]=='gopkg.in':
        match=re.fullmatch(r'([A-Za-z0-9_-]+)\.v[0-9]+',parts[1])
        if match:return '/'.join(parts[:2]),'https://github.com/go-'+match[1]+'/'+match[1]+'.git'
    raise ValueError('unmapped historical import origin: '+name)


def acquire(root,out):
    root=Path(root);out=Path(out);lock,items=pins(root)
    result={'lock':lock,'attempts':[],'complete':False}
    out.mkdir(parents=True,exist_ok=False)
    receipt=out/'dependencies.json'
    try:
        planned={}
        for name,revision in items:
            assert re.fullmatch(r'[0-9a-fA-F]{40}',revision),'dependency is not a full immutable Git revision'
            canonical,url=source(name)
            assert canonical not in planned or planned[canonical]==(url,revision),'conflicting dependency pins'
            planned[canonical]=(url,revision)
        env={k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
        env.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_TERMINAL_PROMPT='0')
        for name,(url,revision) in sorted(planned.items()):
            dest=out/'src'/name;dest.mkdir(parents=True)
            row={'import':name,'url':url,'revision':revision,'commands':[]};result['attempts'].append(row)
            for args in [['git','init',str(dest)],['git','-C',str(dest),'fetch','--depth=1',url,revision],['git','-C',str(dest),'checkout','--detach','FETCH_HEAD']]:
                p=subprocess.run(args,env=env,capture_output=True,text=True,timeout=120)
                row['commands'].append({'args':args,'status':p.returncode,'stdout':p.stdout,'stderr':p.stderr});receipt.write_text(json.dumps(result,indent=2)+'\n')
                assert p.returncode==0,'pinned dependency acquisition failed'
            actual=subprocess.check_output(['git','-C',str(dest),'rev-parse','HEAD'],env=env,text=True,timeout=30).strip()
            assert actual.lower()==revision.lower(),'dependency revision mismatch'
            # No Git metadata is needed by the offline oracle.
            import shutil
            shutil.rmtree(dest/'.git')
        result['complete']=True
    except Exception as error:
        result['error']=str(error)
        raise
    finally:receipt.write_text(json.dumps(result,indent=2)+'\n')

if __name__=='__main__':acquire(*sys.argv[1:])
