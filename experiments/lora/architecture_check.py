"""Metadata-only quantization coverage audit. No checkpoint weights or GPU execution."""
import json
from pathlib import Path
import sys
from urllib.request import urlopen

from runtime import HERE, digest, read, save

out = Path(sys.argv[1])
config = read(HERE / 'config.json')
url = f"https://huggingface.co/{config['model']}/resolve/{config['revision']}/config.json"
with urlopen(url, timeout=30) as response:
    raw = response.read()
metadata = json.loads(raw)
save(out / 'ornith-config.json', metadata)
result = {'version': 'ornith-quantization-coverage/1', 'source_url': url,
          'config_sha256': digest(raw), 'valid': False, 'stage': 'imports',
          'checkpoint_weights_downloaded': False, 'gpu_execution': False}
save(out / 'architecture.json', result)
try:
    import torch
    import bitsandbytes as bnb
    from transformers import Qwen3_5TextConfig, Qwen3_5ForCausalLM, BitsAndBytesConfig
    from transformers.integrations.bitsandbytes import replace_with_bnb_linear
    from transformers.quantizers.quantizer_bnb_4bit import Bnb4BitHfQuantizer
    from transformers.models.qwen3_5 import modeling_qwen3_5
    import inspect
    with torch.device('meta'):
        model = Qwen3_5ForCausalLM(Qwen3_5TextConfig.from_dict(metadata['text_config']))
    params = dict(model.named_parameters())
    experts = {k: p.numel() for k, p in params.items() if '.experts.' in k}
    attention = [k for k, m in model.named_modules() if isinstance(m, torch.nn.Linear) and k.endswith(('.q_proj', '.v_proj'))]
    quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_compute_dtype=torch.bfloat16)
    model = replace_with_bnb_linear(model, quantization_config=quantization)
    quantizer = Bnb4BitHfQuantizer(quantization)
    coverage = {name: quantizer.param_needs_quantization(model, name) for name in experts}
    result.update(stage='complete', valid=True,
                  checkpoint_architecture=metadata['architectures'], has_vision_tower='vision_config' in metadata,
                  total_parameters=sum(p.numel() for p in params.values()),
                  bf16_weight_bytes=2 * sum(p.numel() for p in params.values()),
                  expert_parameters=sum(experts.values()), expert_bf16_bytes=2 * sum(experts.values()),
                  fused_expert_tensors=len(experts), quantized_expert_tensors=sum(coverage.values()),
                  attention_targets=attention,
                  nf4_modules=sum(isinstance(m, bnb.nn.Linear4bit) for m in model.modules()),
                  recipe_ready=False,
                  metadata_coverage_pass=not experts and len(attention) == 16,
                  instantiated_class=type(model).__name__,
                  reason='Metadata audit only; loading, XPU training and export remain runtime gates.',
                  sources={str(Path(inspect.getfile(x))): digest(Path(inspect.getfile(x))) for x in [modeling_qwen3_5, Bnb4BitHfQuantizer, replace_with_bnb_linear]})
except Exception as error:
    result.update(stage='failed', error=f'{type(error).__name__}: {error}')
save(out / 'architecture.json', result)
print(json.dumps(result, indent=2))
sys.exit(0 if result['valid'] else 1)
