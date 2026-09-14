import pathlib,subprocess,json,hashlib,platform,datetime
p=pathlib.Path(__file__).resolve().parent
unit='llama-gpu@gpt-oss-20b-Q4_K_M.gguf.service'
def cmd(*args):return subprocess.check_output(args,text=True).strip()
def digest(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(8*1024*1024),b''):h.update(b)
 return h.hexdigest()
pid=cmd('systemctl','show',unit,'-p','MainPID','--value')
maps=cmd('sudo','-n','cat',f'/proc/{pid}/maps')
paths=sorted(set(line.split()[-1] for line in maps.splitlines() if '/' in line and '.so' in line.split()[-1]))
model='/mnt/ssd1/models/gpt-oss-20b-Q4_K_M.gguf';binary='/opt/llama.cpp-vulkan/llama-server'
manifest={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':pid,'platform':platform.uname()._asdict(),'cpu':cmd('lscpu'),'memory':pathlib.Path('/proc/meminfo').read_text(),'service':cmd('systemctl','cat',unit),'binary_sha256':digest(binary),'model_sha256':digest(model),'template_sha256':digest(p/'frozen.jinja'),'mapped_library_sha256':{x:digest(x) for x in paths},'source_commit_verified':False,'source_note':'Installed executable reports b1-1717187; no verified source-to-binary checkout/build flags available. Binary and mapped libraries are pinned.','gpu':cmd('sudo','-n','lspci','-vv','-s','03:00.0'),'driver':cmd('modinfo','i915'),'environment':cmd('systemctl','show',unit,'-p','Environment'),'stress_allocation_snapshot_sha256':digest(p/'gpu-during-stress.txt'),'stress_allocation_snapshot_pid':3058130,'stress_allocation_snapshot_timestamp':datetime.datetime.fromtimestamp((p/'gpu-during-stress.txt').stat().st_mtime,datetime.timezone.utc).isoformat()}
(p/'runtime-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Runtime manifest saved; source provenance explicitly unresolved')
