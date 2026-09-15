"""Paired selector evaluation; immutable requests and one infrastructure retry."""
import collections
import json
from pathlib import Path
import random
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request,urlopen
from runtime import read,save,digest
from pilot import decode

URL='http://127.0.0.1:8089'
ALIAS='ornith-9b-selector'


def api(path,data=None,timeout=30):
    req=Request(URL+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'})
    with urlopen(req,timeout=timeout) as response:return json.load(response)


def schedule(examples,repeats,seed):
    order_index={x['id']:i for i,x in enumerate(sorted(examples,key=lambda x:x['id']))}
    pairs=[(x,i) for x in examples for i in range(repeats)]
    random.Random(seed).shuffle(pairs)
    rows=[]
    for example,repeat in pairs:
        order=['base','adapter']
        if (repeat+order_index[example['id']])%2:order.reverse()
        paired_seed=int(digest(f'{seed}:{example["id"]}:{repeat}')[:8],16)
        for condition in order:rows.append({'id':f'{example["id"]}-{repeat}-{condition}','case':example['id'],'repeat':repeat,'condition':condition,'seed':paired_seed})
    return rows


def classify(body,labels):
    assert len(body['choices'])==1,'choice count'
    usage=body['usage']
    assert all(isinstance(usage.get(k),int) and usage[k]>=0 for k in ['prompt_tokens','completion_tokens']),'missing token accounting'
    choice=body['choices'][0];reason=choice.get('finish_reason')
    result={'finish_reason':reason,'usage':usage,'success':False}
    if reason=='length':return result|{'outcome':'format-failure','reason':'truncated'}
    if reason!='stop':return result|{'outcome':'format-failure','reason':'unfinished'}
    try:selected=decode(choice['message']['content'],labels)
    except (ValueError,AssertionError,TypeError,KeyError):return result|{'outcome':'format-failure','reason':'invalid-selector-json'}
    if selected=='halt':return result|{'outcome':'abstention','choice':selected,'correct_selection':not any(labels.values())}
    return result|{'outcome':'success' if labels[selected] else 'incorrect-selection','choice':selected,'success':labels[selected],'correct_selection':labels[selected]}


class Server:
    def __init__(self,r,base,adapter):self.r=r;self.base=base;self.adapter=adapter;self.process=None;self.launches=0
    def stop(self):
        if self.process is not None:
            self.process.terminate()
            try:self.process.wait(timeout=60)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait(timeout=30)
            self.log.close();self.process=None
    def start(self,with_adapter=True):
        self.stop();self.launches+=1
        args=['/usr/bin/llama-server','--model',str(self.base),'--alias',ALIAS,'--ctx-size','32768','--parallel','1','--fit','on','--fit-target','1024','--flash-attn','off','--threads','12','--threads-batch','12','--jinja','--chat-template-kwargs','{"enable_thinking":false}','--no-context-shift','--metrics','--host','127.0.0.1','--port','8089','--timeout','7500']
        if with_adapter:args+=['--lora',str(self.adapter),'--lora-init-without-apply']
        self.log=(self.r/f'server-{self.launches}.log').open('ab')
        self.process=subprocess.Popen(args,stdout=self.log,stderr=subprocess.STDOUT)
        deadline=time.monotonic()+300
        while True:
            assert self.process.poll() is None,'server exited during load'
            try:
                if api('/health')['status']=='ok':break
            except OSError:pass
            assert time.monotonic()<deadline,'server readiness timeout'
            time.sleep(2)
        props=api('/props');save(self.r/f'server-{self.launches}.json',{'args':args,'props':props,'models':api('/v1/models'),'slots':api('/slots'),'adapters':api('/lora-adapters')})
        assert ALIAS in [m['id'] for m in api('/v1/models')['data']]
        assert props['default_generation_settings']['n_ctx']==32768
        assert len(api('/slots'))==1
        if with_adapter:assert len(api('/lora-adapters'))==1
    def scale(self,value):api('/lora-adapters',[{'id':0,'scale':value}])


def payload(example,row,profile):
    return profile|{'model':ALIAS,'messages':example['messages'],'seed':row['seed'],'chat_template_kwargs':{'enable_thinking':False},'cache_prompt':False,'stream':False}


def evaluate(run,examples,profile,base,adapter,repeats=3,seed=20260908,scope='fresh-heldout'):
    run=Path(run);run.mkdir(parents=True,exist_ok=True)
    identity={'examples_sha256':digest(json.dumps(examples,sort_keys=True)),'profile':profile,'base_sha256':digest(base),'adapter_sha256':digest(adapter),'server_sha256':digest(Path('/usr/bin/llama-server')),'scope':scope}
    if (run/'identity.json').exists():assert read(run/'identity.json')==identity,'evaluation identity drift'
    else:save(run/'identity.json',identity)
    plan=schedule(examples,repeats,seed)
    if (run/'schedule.json').exists():assert read(run/'schedule.json')==plan
    else:save(run/'schedule.json',plan)
    by_id={x['id']:x for x in examples};server=Server(run,base,adapter)
    try:
        # Actual base-only versus zero-scale test, with final trained adapter.
        probe={'prompt':'The sum of two and two is','n_predict':16,'temperature':0,'top_k':1,'top_p':1,'min_p':0,'seed':seed,'cache_prompt':False}
        server.start(False);plain=api('/completion',probe,180)
        server.start(True);server.scale(0);zero=api('/completion',probe,180)
        save(run/'zero-scale.json',{'request':probe,'base_only':plain,'zero_scale':zero,'equal':plain['content']==zero['content']})
        assert plain['content']==zero['content'],'zero-scale differs from base-only'
        # Audit every distinct prompt before scoring; no reference or labels enter API payloads.
        audits={}
        for example in examples:
            rendered=api('/apply-template',{'messages':example['messages'],'chat_template_kwargs':{'enable_thinking':False}})['prompt']
            assert '<think>\n\n</think>' in rendered,'no-thinking template mismatch'
            tokens=api('/tokenize',{'content':rendered,'add_special':True,'parse_special':True})['tokens']
            assert len(tokens)+profile['max_tokens']+256<=32768,'prompt exceeds frozen context allowance'
            audits[example['id']]={'rendered':rendered,'tokens':len(tokens)}
        save(run/'prompt-audits.json',audits)
        for i,row in enumerate(plan):
            path=run/'attempts'/row['id'];path.mkdir(parents=True,exist_ok=True)
            example=by_id[row['case']];request=payload(example,row,profile)
            if (path/'result.json').exists():
                assert read(path/'request.json')==request,'request drift on resume';continue
            save(path/'request.json',request)
            for attempt in range(2):
                exchange=path/f'exchange-{attempt}.json'
                if exchange.exists():
                    old=read(exchange)
                    if old.get('body') is not None:break
                    if old.get('finished'):continue
                    # Unknown delivery is retained as missing, never overwritten/reselected.
                    save(path/f'interrupted-{attempt}.json',{'reason':'prior exchange interrupted','original_sha256':digest(exchange)})
                    continue
                if attempt:server.start(True)
                server.scale(1 if row['condition']=='adapter' else 0)
                save(run/'status.json',{'stage':'evaluating','completed':i,'planned':len(plan),'attempt':row['id'],'at':time.time()})
                record={'started':time.time(),'request_sha256':digest(path/'request.json')};save(exchange,record)
                start=time.monotonic()
                try:
                    req=Request(URL+'/v1/chat/completions',data=json.dumps(request).encode(),headers={'Content-Type':'application/json'})
                    with urlopen(req,timeout=7200) as response:
                        raw=response.read();record.update(http_status=response.status,headers=dict(response.headers))
                    (path/f'body-{attempt}.json').write_bytes(raw)
                    record['body']=json.loads(raw)
                except HTTPError as error:
                    raw=error.read();(path/f'body-{attempt}.json').write_bytes(raw);record.update(http_status=error.code,error=str(error))
                    if 400<=error.code<500:raise RuntimeError('request/protocol error: '+str(error)) from error
                except (OSError,ValueError) as error:record['error']=repr(error)
                finally:
                    record.update(finished=time.time(),elapsed=time.monotonic()-start);save(exchange,record)
                if record.get('body') is not None:break
            exchanges=[read(p) for p in sorted(path.glob('exchange-*.json'))]
            complete=[x for x in exchanges if x.get('body') is not None]
            if complete:
                result=classify(complete[0]['body'],example['candidate_labels'])
                assert result['usage']['prompt_tokens']==audits[row['case']]['tokens'],'token audit disagrees with actual request'
            else:result={'outcome':'infrastructure-missing','success':None}
            save(path/'result.json',row|result)
        results=[read(run/'attempts'/x['id']/'result.json') for x in plan]
        summary=summarize(results,examples,repeats,seed)|{'scope':scope}
        save(run/'evaluation-summary.json',summary);save(run/'status.json',{'stage':'complete','summary':summary,'at':time.time()})
        return summary
    finally:server.stop()


def summarize(results,examples,repeats,seed):
    counts={arm:dict(collections.Counter(x['outcome'] for x in results if x['condition']==arm)) for arm in ['base','adapter']}
    per=[]
    for example in examples:
        arms={arm:[x['success'] for x in results if x['case']==example['id'] and x['condition']==arm] for arm in ['base','adapter']}
        rates={arm:sum(v is True for v in values)/repeats for arm,values in arms.items()}
        per.append({'case':example['id'],'lineage':example['lineage'],'cell':example['cell'],'rates_lower':rates,'flip_rates':{arm:(sum(a!=b for i,a in enumerate(values) for b in values[i+1:])/max(1,len(values)*(len(values)-1)/2)) for arm,values in arms.items()},'delta_lower_assumption':rates['adapter']-rates['base'],'complete':all(len(v)==repeats and None not in v for v in arms.values())})
    complete=all(x['complete'] for x in per)
    output={'complete':complete,'finding':'EXPLORATORY COMPLETE' if complete else 'INCOMPLETE','counts':counts,'per_case':per,'planned':len(examples)*repeats*2,'recorded':len(results),'missing':sum(x['success'] is None for x in results)}
    output['success_bounds']={arm:{'lower':sum(x['condition']==arm and x['success'] is True for x in results)/(len(examples)*repeats),'upper':sum(x['condition']==arm and x['success'] is not False for x in results)/(len(examples)*repeats)} for arm in ['base','adapter']}
    if complete:
        groups=collections.defaultdict(list)
        for x in per:groups[x['lineage']].append(x['delta_lower_assumption'])
        rng=random.Random(seed);keys=list(groups)
        boot=[]
        for _ in range(10000):
            values=[v for key in rng.choices(keys,k=len(keys)) for v in groups[key]];boot.append(sum(values)/len(values))
        boot.sort();output['paired_delta']={'estimate':sum(x['delta_lower_assumption'] for x in per)/len(per),'ci95':[boot[249],boot[9749]],'independent_lineages':len(groups),'bootstrap_resamples':10000}
    return output
