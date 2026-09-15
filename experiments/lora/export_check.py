"""Convert the pinned base and tested adapter; smoke-test deployment in a GPU lease."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import Request,urlopen
from runtime import HERE,read,save,digest

CONVERTER=Path('/mnt/nvme1/llama-package-c83464b8/build/llama.cpp-sycl-f16-git/src/llama.cpp')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['convert','serve']);parser.add_argument('run',type=Path);args=parser.parse_args()
    r=args.run;c=read(HERE/'config.json');checkpoint=read(r/'checkpoint.json');base=r/'base-Q4_K_M.gguf';adapter=r/'feasibility-adapter.gguf'
    assert read(r/'full-model-check.json')['valid']
    if args.mode=='convert':
        import sys
        commands=[
            [sys.executable,str(CONVERTER/'convert_hf_to_gguf.py'),checkpoint['snapshot'],'--outfile',str(r/'base-bf16.gguf'),'--outtype','bf16'],
            ['/usr/bin/llama-quantize',str(r/'base-bf16.gguf'),str(base),'Q4_K_M','12'],
            [sys.executable,str(CONVERTER/'convert_lora_to_gguf.py'),'--base',checkpoint['snapshot'],'--outfile',str(adapter),'--outtype','f16',str(r/'feasibility-adapter')],
        ]
        receipts=[]
        for i,command in enumerate(commands):
            with (r/f'conversion-{i}.log').open('wb') as log:
                started=time.monotonic();p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=3600)
            receipts.append({'command':command,'exit_code':p.returncode,'elapsed':time.monotonic()-started});save(r/'conversion.json',{'receipts':receipts,'valid':False})
            assert p.returncode==0, f'conversion failed; see conversion-{i}.log'
        official=Path('/mnt/mrgr/models/ornith-1.5-9b/Ornith-1.5-9B-Q4_K_M.gguf')
        save(r/'conversion.json',{'receipts':receipts,'valid':True,'files':{str(p):digest(p) for p in [base,adapter,CONVERTER/'convert_hf_to_gguf.py',CONVERTER/'convert_lora_to_gguf.py',Path('/usr/bin/llama-server'),Path('/usr/bin/llama-quantize')]},'official_sha256':digest(official),'official_identical':digest(base)==digest(official)})
        return
    assert read(r/'conversion.json')['valid']
    command=['/usr/bin/llama-server','--model',str(base),'--lora',str(adapter),'--alias','ornith-9b-lora-feasibility','--ctx-size','32768','--parallel','1','--fit','on','--fit-target','1024','--flash-attn','off','--threads','12','--threads-batch','12','--jinja','--temp','0.6','--top-p','0.95','--metrics','--host','127.0.0.1','--port','8089']
    def api(path,data=None):
        request=Request('http://127.0.0.1:8089'+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'})
        with urlopen(request,timeout=180) as response:return json.load(response)
    with (r/'deployment.log').open('wb') as log:
        server=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
        try:
            deadline=time.monotonic()+300
            while True:
                assert server.poll() is None,'server exited during load'
                try:
                    if api('/health')['status']=='ok':break
                except OSError:pass
                assert time.monotonic()<deadline,'server readiness timeout'
                time.sleep(2)
            save(r/'deployment-props.json',api('/props'))
            listed=api('/lora-adapters');assert len(listed)==1
            responses=[]
            for scale in [0,1,0]:
                api('/lora-adapters',[{'id':0,'scale':scale}])
                payload={'prompt':'The sum of two and two is','n_predict':16,'temperature':0,'top_k':1,'top_p':1,'min_p':0,'seed':20260908,'cache_prompt':False}
                result=api('/completion',payload);assert isinstance(result.get('content'),str) and result['tokens_predicted']>0
                responses.append({'scale':scale,'request':payload,'response':result});save(r/'deployment-responses.json',responses)
            assert responses[0]['response']['content']==responses[2]['response']['content'],'disabled adapter replay differs'
            save(r/'export-readiness.json',{'valid':True,'command':command,'base_sha256':digest(base),'adapter_sha256':digest(adapter),'loaded_adapters':listed,'zero_scale_replay_equal':True,'scope':'adapter loads and executes; same converted base for both later conditions; no efficacy claim'})
        finally:
            server.terminate()
            try:server.wait(timeout=60)
            except subprocess.TimeoutExpired:server.kill();server.wait(timeout=30)

if __name__=='__main__':main()
