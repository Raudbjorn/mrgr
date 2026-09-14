import json,pathlib,urllib.request,subprocess,time,hashlib
p=pathlib.Path(__file__).resolve().parent;base='http://127.0.0.1:8089';opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(path):return json.load(opener.open(base+path,timeout=10))
def post(path,r):return json.load(opener.open(urllib.request.Request(base+path,data=json.dumps(r).encode(),headers={'Content-Type':'application/json'}),timeout=1800))
smoke=json.loads((p/'smoke.json').read_text());r=smoke['request'];out={'original':smoke,'after_unrelated':{'request':r,'response':post('/v1/chat/completions',r)}}
(p/'replay.json').write_text(json.dumps(out,indent=2)+'\n')
assert not any(s['is_processing'] for s in get('/slots'))
subprocess.run(['sudo','-n','systemctl','restart','llama-gpu@gpt-oss-20b-Q4_K_M.gguf.service'],check=True)
for _ in range(180):
 try:
  if get('/health')['status']=='ok':break
 except Exception:pass
 time.sleep(1)
else:raise RuntimeError('restart failed')
# Prompt byte identity across restart, all 120 conditions.
requests=json.loads((p.parent/'v3-mercury-final-2026-09-07/run/requests.json').read_text());params=json.loads((p/'request-parameters.json').read_text())
for a in json.loads((p/'prompt-capacity.json').read_text()):
 prompt=post('/apply-template',{**requests[a['key']],**params,'model':r['model']})['prompt']
 assert hashlib.sha256(prompt.encode()).hexdigest()==a['prompt_sha256']
out['after_restart']={'request':r,'response':post('/v1/chat/completions',r)}
content=lambda b:b['choices'][0]['message']['content']
for name in ['after_unrelated','after_restart']:
 assert out[name]['response']['usage']['prompt_tokens']==smoke['prompt_tokens_expected']
 out[name]['same_content_as_original']=content(out[name]['response'])==content(smoke['response'])
out['all_120_prompts_identical_after_restart']=True
(p/'replay.json').write_text(json.dumps(out,indent=2)+'\n')
ready=json.loads((p/'server-ready.json').read_text());ready.update(props=get('/props'),health=get('/health'),models=get('/v1/models'),slots=get('/slots'));(p/'server-ready.json').write_text(json.dumps(ready,indent=2)+'\n')
print('PASS: restart, 120 prompt hashes, replay usage; content equality:',[out[n]['same_content_as_original'] for n in ['after_unrelated','after_restart']],flush=True)
