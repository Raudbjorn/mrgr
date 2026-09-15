"""Pinned 9B metadata, tokenizer and export preflight; weights are a separate stage."""
import json
import re
import sys
from pathlib import Path
from runtime import HERE, read, save, digest

run = Path(sys.argv[1]); run.mkdir(parents=True, exist_ok=True)
c = read(HERE / 'config.json')
import torch
from huggingface_hub import snapshot_download
from transformers import AutoTokenizer, Qwen3_5TextConfig, Qwen3_5ForCausalLM, BitsAndBytesConfig
from transformers.quantizers.quantizer_bnb_4bit import Bnb4BitHfQuantizer
from peft import LoraConfig
from safetensors.torch import save_file

snapshot = Path(snapshot_download(c['model'], revision=c['revision'], allow_patterns=['*.json','*.jinja'], max_workers=2))
metadata = read(snapshot/'config.json')
tokenizer = AutoTokenizer.from_pretrained(snapshot)
with torch.device('meta'):
    model = Qwen3_5ForCausalLM(Qwen3_5TextConfig.from_dict(metadata['text_config']))
parameters = dict(model.named_parameters())
shapes = {k:list(p.shape) for k,p in parameters.items()}
quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16)
quantizer = Bnb4BitHfQuantizer(quantization)
quantizer._process_model_before_weight_loading(model, device_map={'':'xpu:0'})
quantized = {k:p.numel() for k,p in parameters.items() if quantizer.param_needs_quantization(model,k)}
remaining = {k:p.numel() for k,p in parameters.items() if k not in quantized}
# Conservative 0.6 bytes/quantized weight covers packed values and double-quant scales.
projected = sum(quantized.values())*.6 + sum(remaining.values())*2
assert projected < 15*1024**3, 'base weight projection exceeds device budget'
targets = {name:(m.in_features,m.out_features) for name,m in model.named_modules() if re.fullmatch(c['target_modules'],name)}
assert len(targets)==16 and all('.self_attn.' in name for name in targets)
index = read(snapshot/'model.safetensors.index.json')['weight_map']
# Explicit checkpoint mapping, avoiding hidden uninitialized text weights.
mapped = {k.replace('model.language_model.', 'model.'):k for k in index if not k.startswith(('mtp.','model.visual.'))}
assert set(mapped)==set(shapes), {'missing':list(set(shapes)-set(mapped)),'unexpected':list(set(mapped)-set(shapes))}
save(run/'metadata.json', {'valid':True,'snapshot':str(snapshot),'revision':c['revision'],'files':{p.name:digest(p) for p in snapshot.iterdir() if p.is_file()},'base_projected_bytes':projected,'quantized_parameters':sum(quantized.values()),'bf16_parameters':sum(remaining.values()),'skip_modules':quantizer.modules_to_not_convert,'targets':targets,'checkpoint_key_map':mapped,'ignored_checkpoint_keys':[k for k in index if k not in mapped.values()]})
prepared = read(Path(c['storage'])/'runs/9b-selector-2026-09-14-r2/prepared.json')
assert prepared['complete']
examples=[]; excluded=[]
for example in prepared['examples']:
    prompt = tokenizer.apply_chat_template(example['messages'],tokenize=False,add_generation_prompt=True,enable_thinking=False)
    answer = json.dumps(example['target'],separators=(',',':'))
    full = tokenizer.apply_chat_template([*example['messages'],{'role':'assistant','content':answer}],tokenize=False,enable_thinking=False)
    assert full.startswith(prompt), 'train/inference template mismatch'
    ids = tokenizer(full,add_special_tokens=False)['input_ids']; prefix=tokenizer(prompt,add_special_tokens=False)['input_ids']
    assert ids[:len(prefix)]==prefix and len(ids)>len(prefix), 'token boundary mismatch'
    row={'id':example['id'],'input_ids':ids,'target_start':len(prefix),'lineage':example['lineage'],'cell':example['cell']}
    if len(ids)>c['max_training_tokens']:
        excluded.append({'id':example['id'],'tokens':len(ids),'reason':'exceeds frozen training length; no truncation'})
    else: examples.append(row)
save(run/'tokenized.json',{'examples':examples,'excluded':excluded,'prepared_sha256':digest(Path(c['storage'])/'runs/9b-selector-2026-09-14-r2/prepared.json')})
assert examples, 'no usable training examples'
# Export uses real model names/shapes and deterministic nonzero matrices; no base weights needed.
adapter=run/'export-fixture';adapter.mkdir(exist_ok=True)
config=LoraConfig(r=c['rank'],lora_alpha=c['alpha'],target_modules=c['target_modules'],lora_dropout=c['dropout'],task_type='CAUSAL_LM',base_model_name_or_path=c['model'])
config.save_pretrained(adapter)
torch.manual_seed(c['seed']); tensors={}
for name,(in_features,out_features) in targets.items():
    tensors['base_model.model.'+name+'.lora_A.weight']=torch.randn(c['rank'],in_features)*.001
    tensors['base_model.model.'+name+'.lora_B.weight']=torch.randn(out_features,c['rank'])*.001
save_file(tensors,adapter/'adapter_model.safetensors')
save(run/'preflight.json',{'valid':True,'weight_loading_verified':False,'training_verified':False,'export_loading_verified':False,'admitted':len(examples),'length_excluded':len(excluded),'max_tokens':max(len(x['input_ids']) for x in examples),'projected_weight_gib':projected/1024**3})
print(read(run/'preflight.json'))
