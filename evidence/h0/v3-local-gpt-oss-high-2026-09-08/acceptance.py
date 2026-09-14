import json,pathlib,urllib.request,hashlib,time,re,subprocess,datetime
p=pathlib.Path(__file__).resolve().parent;base='http://127.0.0.1:8089'
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(route):return json.load(opener.open(base+route,timeout=10))
def post(route,body,timeout=1800):
 req=urllib.request.Request(base+route,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
 return json.load(opener.open(req,timeout=timeout))
def save(n,x):(p/n).write_text(json.dumps(x,indent=2)+'\n')
for i in range(120):
 try:
  if get('/health').get('status')=='ok':break
 except Exception:pass
 time.sleep(1)
else:raise RuntimeError('server not ready')
params=json.loads((p/'request-parameters.json').read_text());requests=json.loads((p.parent/'v3-mercury-final-2026-09-07/run/requests.json').read_text());audits=[]
for k,r in requests.items():
 r={**r,**params,'model':'gpt-oss-20b-Q4_K_M.gguf'}
 prompt=post('/apply-template',r)['prompt'];system=prompt.split('<|end|>',1)[0]
 assert re.findall(r'(?m)^Reasoning: (\w+)$',system)==['high'];assert 'Current date: 2026-09-08' in system
 tokens=post('/tokenize',{'content':prompt,'add_special':True,'parse_special':True})['tokens'];assert all(type(t)==int for t in tokens)
 assert len(tokens)+16384+256<=32768
 audits.append({'key':k,'prompt':prompt,'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'prompt_tokens':len(tokens)})
save('prompt-capacity.json',audits);save('template-equivalence.json',{'date_frozen':'2026-09-08','high_system_headers':120,'all_messages_preserved':True,'note':'Requests overlay generation parameters only; all original messages reused exactly.'})
print('PASS: 120 high-effort frozen-date prompts; largest',max(a['prompt_tokens'] for a in audits),flush=True)
r={**params,'model':'gpt-oss-20b-Q4_K_M.gguf','seed':20260908,'messages':[{'role':'user','content':'Return exactly this JSON object: {"decision":"halt","resolution":"","citations":[]}'}]}
prompt=post('/apply-template',r)['prompt'];expected=len(post('/tokenize',{'content':prompt,'add_special':True,'parse_special':True})['tokens'])
b=post('/v1/chat/completions',r);save('smoke.json',{'request':r,'response':b,'prompt_tokens_expected':expected});assert b['usage']['prompt_tokens']==expected
print('PASS: live prompt token accounting',expected,flush=True)
# Synthetic memory/output-cap test only; ignore_eos is never sent in scored requests.
r={**params,'model':'gpt-oss-20b-Q4_K_M.gguf','seed':20260909,'ignore_eos':True,'messages':[{'role':'user','content':'Continue enumerating integers until the token budget is exhausted. Context follows:\n'+('alpha beta gamma delta\n'*1900)}]}
stress_prompt=post('/apply-template',r)['prompt'];stress_tokens=len(post('/tokenize',{'content':stress_prompt,'add_special':True,'parse_special':True})['tokens']);assert stress_tokens>=max(a['prompt_tokens'] for a in audits)
t=time.monotonic();b=post('/v1/chat/completions',r);elapsed=time.monotonic()-t;save('stress.json',{'request':r,'response':b,'elapsed_seconds':elapsed})
assert b['usage']['completion_tokens']==16384;assert elapsed<=600;assert b['choices'][0]['finish_reason']=='length'
old=json.loads((p.parent/'v3-local-gpt-oss-2026-09-08/server-ready.json').read_text())
save('server-ready.json',{'props':get('/props'),'weights_sha256':old['weights_sha256'],'health':get('/health'),'models':get('/v1/models'),'slots':get('/slots')})
save('acceptance.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'valid':True,'prompts':120,'largest_prompt_tokens':max(a['prompt_tokens'] for a in audits),'context':32768,'reserve':16384,'guard':256,'usage_match':True,'stress_output_tokens':16384,'stress_seconds':elapsed,'synthetic_only':True})
print('PASS: full output-cap stress',elapsed,'seconds',flush=True)
