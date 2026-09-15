"""Full-size XPU feasibility or frozen rank-8 training, without model CPU offload."""
import argparse
import hashlib
import json
import math
import random
import time
from pathlib import Path
from runtime import HERE, read, save, digest


def supervised_loss(model, ids, start):
    import torch
    assert 0 < start < ids.shape[1]
    positions = torch.arange(start-1, ids.shape[1]-1, device=ids.device)
    logits = model(input_ids=ids, logits_to_keep=positions, use_cache=False).logits
    assert logits.shape[1] == ids.shape[1]-start
    return torch.nn.functional.cross_entropy(logits.float().flatten(0,1), ids[:,start:].flatten())


def weight_hashes(model, frozen):
    import torch
    result={}
    for name,p in model.named_parameters():
        if p.requires_grad != frozen:
            raw=p.detach().contiguous().view(torch.uint8).cpu().numpy()
            result[name]=hashlib.sha256(raw).hexdigest()
    return result


def main():
    import torch
    from transformers import Qwen3_5ForCausalLM, Qwen3_5TextConfig, BitsAndBytesConfig
    from peft import LoraConfig, get_peft_model, PeftModel
    parser=argparse.ArgumentParser(); parser.add_argument('mode',choices=['check','train']);parser.add_argument('run',type=Path)
    args=parser.parse_args();r=args.run;c=read(HERE/'config.json'); started=time.monotonic()
    status=r/(args.mode+'-status.json')
    def progress(stage,**values):save(status,{'stage':stage,'elapsed':time.monotonic()-started,**values})
    progress('loading')
    assert not c['allow_model_cpu_offload']
    if args.mode=='train':
        assert read(r/'full-model-check.json')['valid']
        assert read(r/'export-readiness.json')['valid']
    checkpoint=read(r/'checkpoint.json');snapshot=Path(checkpoint['snapshot'])
    assert checkpoint['revision']==c['revision']
    for filename,record in checkpoint['files'].items():assert digest(snapshot/filename)==record['sha256']
    torch.manual_seed(c['seed']);torch.set_num_threads(12)
    assert torch.xpu.device_count()==1 and 'A770' in torch.xpu.get_device_name(0)
    torch.xpu.reset_peak_memory_stats()
    config=Qwen3_5TextConfig.from_dict(read(snapshot/'config.json')['text_config'])
    quantization=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_use_double_quant=True,bnb_4bit_compute_dtype=torch.bfloat16)
    from unittest.mock import patch
    # Loading optimization only: A770 rejects the optional single 7 GiB warmup allocation.
    # Actual NF4 tensor allocations remain unchanged and must still fit on-device.
    save(r/(args.mode+'-allocator.json'),{'warmup':'disabled','reason':'single allocation rejected before weight loading; per-tensor allocation unchanged'})
    with patch('transformers.modeling_utils.caching_allocator_warmup', return_value=None):
        model,loading=Qwen3_5ForCausalLM.from_pretrained(snapshot,config=config,dtype=torch.bfloat16,quantization_config=quantization,device_map={'':'xpu:0'},key_mapping={r'^model.language_model\.':'model.'},output_loading_info=True,attn_implementation='sdpa')
    loading=json.loads(json.dumps(loading,default=lambda value:sorted(value) if isinstance(value,set) else str(value)))
    save(r/(args.mode+'-loading.json'),loading)
    assert not loading.get('missing_keys') and not loading.get('mismatched_keys') and not loading.get('error_msgs')
    assert all(k.startswith(('mtp.','model.visual.')) for k in loading.get('unexpected_keys',[]))
    assert all(p.device.type=='xpu' for p in model.parameters()), 'model weights offloaded'
    model.requires_grad_(False)
    # Preserve BF16 frozen non-quantized weights; generic k-bit prep would upcast them to FP32.
    lora=LoraConfig(r=c['rank'],lora_alpha=c['alpha'],lora_dropout=c['dropout'],target_modules=c['target_modules'],task_type='CAUSAL_LM',base_model_name_or_path=c['model'])
    tiny=torch.tensor([[100,101,102,103]],device='xpu')
    model.eval()
    import sys
    calls={}
    def trace(frame,event,arg):
        if event=='call' and frame.f_code.co_filename.endswith('modeling_qwen3_5.py') and any(k in frame.f_code.co_name for k in ['conv1d','gated_delta']):
            key=frame.f_code.co_name;calls[key]=calls.get(key,0)+1
    sys.setprofile(trace)
    try:
        with torch.profiler.profile(activities=[torch.profiler.ProfilerActivity.CPU]) as profile:
            with torch.no_grad(): baseline=model(input_ids=tiny,logits_to_keep=1,use_cache=False).logits.clone()
    finally:sys.setprofile(None)
    save(r/(args.mode+'-kernel-calls.json'),{'python_fallback_calls':calls,'attention_ops':[x.key for x in profile.key_averages() if 'attention' in x.key or 'scaled_dot' in x.key]})
    model=get_peft_model(model,lora,autocast_adapter_dtype=False)
    assert sum(hasattr(m,'lora_A') for m in model.modules())==16
    for p in model.parameters():
        if p.requires_grad:p.data=p.data.to(torch.bfloat16)
    model.eval()
    with torch.no_grad(),model.disable_adapter(): disabled=model(input_ids=tiny,logits_to_keep=1,use_cache=False).logits
    assert torch.equal(baseline,disabled), 'disabled adapter changed base'
    with torch.no_grad():initial=model(input_ids=tiny,logits_to_keep=1,use_cache=False).logits
    assert torch.equal(baseline,initial), 'zero adapter changed base'
    model.enable_input_require_grads();model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={'use_reentrant':False})
    before=weight_hashes(model,True);before_adapter=weight_hashes(model,False)
    from transformers.models.qwen3_5 import modeling_qwen3_5 as implementation
    import inspect
    kernels={}
    for module_name,module in model.named_modules():
        if 'linear_attn' in module_name:
            for name in ['causal_conv1d_fn','causal_conv1d_update','chunk_gated_delta_rule','fused_recurrent_gated_delta_rule']:
                fn=getattr(module,name,None)
                if fn is not None:
                    try: source=inspect.getfile(fn)
                    except TypeError: source=None
                    kernels[module_name+'.'+name]={'module':getattr(fn,'__module__',None),'name':getattr(fn,'__qualname__',str(fn)),'source':source}
    save(r/(args.mode+'-runtime.json'),{'torch':torch.__version__,'device':torch.xpu.get_device_name(0),'attention':config._attn_implementation,'kernels':kernels,'implementation_sha256':digest(Path(inspect.getfile(implementation))),'trainable_parameters':sum(p.numel() for p in model.parameters() if p.requires_grad)})
    data=read(r/'tokenized.json')['examples'];assert data
    optimizer=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=c['learning_rate'])
    model.train();steps=0;losses=[]
    if args.mode=='check':
        longest=max(data,key=lambda x:len(x['input_ids']))
        batches=[{'input_ids':[100]*n,'target_start':n-8,'id':'synthetic-'+str(n)} for n in [512,2048]]+[longest]
        groups=[[x] for x in batches]
    else:
        groups=[]
        for epoch in range(c['epochs']):
            order=list(data);random.Random(c['seed']+epoch).shuffle(order)
            groups.extend([order[i:i+c['gradient_accumulation']] for i in range(0,len(order),c['gradient_accumulation'])])
    warmup=max(1,math.ceil(len(groups)*c['warmup_ratio']))
    for group in groups:
        optimizer.zero_grad(set_to_none=True)
        for example in group:
            progress('backward',step=steps,case=example['id'],tokens=len(example['input_ids']))
            ids=torch.tensor([example['input_ids']],device='xpu')
            loss=supervised_loss(model,ids,example['target_start'])
            assert torch.isfinite(loss)
            (loss/len(group)).backward();losses.append(float(loss.detach()))
        assert all(torch.isfinite(p.grad).all() for p in model.parameters() if p.requires_grad and p.grad is not None)
        torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad],1.0)
        for group_parameters in optimizer.param_groups:group_parameters['lr']=c['learning_rate']*min(1,(steps+1)/warmup)
        optimizer.step();steps+=1;torch.xpu.synchronize()
        progress('updated',step=steps,total_steps=len(groups),loss=losses[-1],peak_allocated=torch.xpu.max_memory_allocated())
        if args.mode=='train':
            directory=r/('checkpoint-'+str(steps));model.save_pretrained(directory,safe_serialization=True)
            torch.save({'optimizer':optimizer.state_dict(),'step':steps,'rng':torch.get_rng_state(),'xpu_rng':torch.xpu.get_rng_state()},directory/'optimizer.pt')
    assert before==weight_hashes(model,True), 'frozen base changed'
    assert before_adapter!=weight_hashes(model,False), 'adapter did not update'
    model.eval()
    with torch.no_grad():expected=model(input_ids=tiny,logits_to_keep=1,use_cache=False).logits.cpu()
    adapter=r/('feasibility-adapter' if args.mode=='check' else 'adapter');model.save_pretrained(adapter,safe_serialization=True)
    base=model.unload();reloaded=PeftModel.from_pretrained(base,adapter,autocast_adapter_dtype=False);reloaded.eval()
    with torch.no_grad():actual=reloaded(input_ids=tiny,logits_to_keep=1,use_cache=False).logits.cpu()
    assert torch.allclose(expected,actual,rtol=0,atol=0), 'reload changed logits'
    result={'valid':True,'steps':steps,'losses':losses,'peak_allocated':torch.xpu.max_memory_allocated(),'elapsed':time.monotonic()-started,'frozen_weights_unchanged':True,'reload_equal':True,'adapter':str(adapter),'adapter_sha256':digest(adapter/'adapter_model.safetensors')}
    save(r/('full-model-check.json' if args.mode=='check' else 'training-result.json'),result);progress('complete',**result)

if __name__=='__main__':main()
