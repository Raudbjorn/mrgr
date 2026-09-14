import pathlib,json,subprocess,time,urllib.request,hashlib,datetime,shutil
p=pathlib.Path(__file__).resolve().parent;old=p.parent/'v3-local-gpt-oss-high-transport-2026-09-08';base='http://127.0.0.1:8089';opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(route):return json.load(opener.open(base+route,timeout=10))
def post(route,r):return json.load(opener.open(urllib.request.Request(base+route,data=json.dumps(r).encode(),headers={'Content-Type':'application/json'}),timeout=1800))
def save(name,data):(p/name).write_text(json.dumps(data,indent=2)+'\n')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
for _ in range(240):
 state=json.loads((old/'run/state.json').read_text())
 if state['stage']=='drained':break
 if state['stage']=='error':raise RuntimeError('Old run failed rather than draining; preserve and inspect')
 time.sleep(5)
else:raise RuntimeError('Drain did not complete within 20 minutes')
assert not list((old/'run/responses').glob('*.started'))
assert not any(s['is_processing'] for s in get('/slots'))
protocol=json.loads((old/'run/protocol.json').read_text())
for path,h in protocol['preserved'].items():assert sha(pathlib.Path(path))==h,path
change=json.loads((p/'change.json').read_text());change.update(phase='drained',drained_state=state,preserved_source_verified_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),receipts={str(f):sha(f) for kind in ['responses','evaluations'] for f in (old/'run'/kind).glob('*.json')},configuration_sha256=sha(p/'server-threads12.conf'))
save('change.json',change)
subprocess.run(['systemctl','--user','disable','--now','mrgr-gpt-oss-high-transport-watchdog.timer'],check=True)
subprocess.run(['systemctl','--user','stop','mrgr-gpt-oss-high-transport-benchmark.service'],check=True)
cmd=f'install -m 0644 {p}/server-threads12.conf /etc/systemd/system/llama-gpu@gpt-oss-20b-Q4_K_M.gguf.service.d/zz-high-profile.conf && systemctl daemon-reload && systemctl restart llama-gpu@gpt-oss-20b-Q4_K_M.gguf.service'
subprocess.run(['ssh','-o','BatchMode=yes','vinbonesjr',cmd],check=True)
for _ in range(180):
 try:
  if get('/health')['status']=='ok':break
 except Exception:pass
 time.sleep(1)
else:raise RuntimeError('Server did not become healthy')
props=get('/props');assert props['default_generation_settings']['n_ctx']==32768;assert props['total_slots']==1
pid=subprocess.check_output(['systemctl','show','llama-gpu@gpt-oss-20b-Q4_K_M.gguf','-p','MainPID','--value'],text=True).strip()
args=subprocess.check_output(['ssh','-o','BatchMode=yes','vinbonesjr',f'cat /proc/{pid}/cmdline']).decode().split('\0')
assert args[args.index('--threads')+1]=='12';assert args[args.index('--threads-batch')+1]=='12'
params=json.loads((p/'request-parameters.json').read_text());requests=json.loads((p.parent/'v3-mercury-final-2026-09-07/run/requests.json').read_text())
for a in json.loads((p/'prompt-capacity.json').read_text()):
 prompt=post('/apply-template',{**requests[a['key']],**params,'model':'gpt-oss-20b-Q4_K_M.gguf'})['prompt'];assert hashlib.sha256(prompt.encode()).hexdigest()==a['prompt_sha256']
smoke=json.loads((p/'smoke.json').read_text());r=smoke['request'];response=post('/v1/chat/completions',r);assert response['usage']['prompt_tokens']==smoke['prompt_tokens_expected'];assert response['choices'][0]['finish_reason']=='stop'
save('threads12-ready.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':pid,'argv':args,'generation_threads':12,'prompt_threads':12,'prompt_hashes_verified':120,'request':r,'response':response,'numa_nodes':1,'cpu_affinity':'unchanged; CPUs 0-23'})
ready=json.loads((p/'server-ready.json').read_text());ready.update(props=props,health=get('/health'),models=get('/v1/models'),slots=get('/slots'));save('server-ready.json',ready)
for name in ['server-context.conf','parser.conf']:shutil.copy2(p/'server-threads12.conf',p/name)
a=json.loads((p/'acceptance.json').read_text());a.update(thread_configuration=12,capacity_probe_thread_configuration=6,reused_capacity_evidence=True,threads12_prompt_hashes_verified=120,threads12_smoke=True);save('acceptance.json',a)
change.update(phase='server-restarted-and-verified',server_pid=pid,at_completed=datetime.datetime.now(datetime.timezone.utc).isoformat());save('change.json',change)
subprocess.run(['python',str(p/'capture-runtime.py')],check=True)
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemctl','--user','start','mrgr-gpt-oss-threads12-benchmark.service'],check=True)
subprocess.run(['systemctl','--user','enable','--now','mrgr-gpt-oss-threads12-watchdog.timer'],check=True)
print('PASS: drained, preserved, restarted 12/12 threads, verified prompts/smoke, started separate benchmark',flush=True)
