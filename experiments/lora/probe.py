"""Small, real XPU/backward and NF4 controls; never loads the full model."""
import json
import os
from pathlib import Path
import sys
import time

out = Path(sys.argv[1])
result = {"started": time.time(), "stage": "imports", "valid": False, "environment": {k: os.environ.get(k) for k in ["ONEAPI_DEVICE_SELECTOR", "OCL_ICD_VENDORS"]}}

def save():
    temporary = out.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2) + '\n')
    temporary.replace(out)

try:
    save()
    import torch
    result['stage'] = 'bitsandbytes import'
    save()
    import bitsandbytes as bnb
    result.update(torch=torch.__version__, bitsandbytes=bnb.__version__)
    result['stage'] = 'XPU discovery'
    save()
    assert torch.xpu.is_available(), 'XPU unavailable'
    devices = [torch.xpu.get_device_name(i) for i in range(torch.xpu.device_count())]
    result['devices'] = devices
    selected = [i for i, name in enumerate(devices) if 'A770' in name]
    assert len(selected) == 1, 'A770 not uniquely identified'
    device = f'xpu:{selected[0]}'
    result['device'] = device
    result['stage'] = 'BF16 backward and AdamW'
    save()
    torch.manual_seed(20260908)
    layer = torch.nn.Linear(32, 16, device=device, dtype=torch.bfloat16)
    optimizer = torch.optim.AdamW(layer.parameters(), lr=1e-4)
    before = layer.weight.detach().clone()
    for _ in range(3):
        optimizer.zero_grad()
        loss = layer(torch.randn(4, 32, device=device, dtype=torch.bfloat16)).float().square().mean()
        loss.backward()
        assert torch.isfinite(layer.weight.grad).all()
        optimizer.step()
    assert not torch.equal(before, layer.weight)
    result['bf16_pass'] = True
    result['stage'] = 'NF4 frozen base with BF16 low-rank backward'
    save()
    base = bnb.nn.Linear4bit(32, 16, bias=False, compute_dtype=torch.bfloat16,
                            quant_type='nf4', compress_statistics=True).to(device)
    base.requires_grad_(False)
    a = torch.nn.Linear(32, 8, bias=False, device=device, dtype=torch.bfloat16)
    b = torch.nn.Linear(8, 16, bias=False, device=device, dtype=torch.bfloat16)
    torch.nn.init.zeros_(b.weight)
    original = base.weight.detach().clone()
    before = b.weight.detach().clone()
    optimizer = torch.optim.AdamW([*a.parameters(), *b.parameters()], lr=1e-4)
    for _ in range(3):
        optimizer.zero_grad()
        x = torch.randn(4, 32, device=device, dtype=torch.bfloat16)
        loss = (base(x) + 2 * b(a(x))).float().square().mean()
        loss.backward()
        assert torch.isfinite(b.weight.grad).all()
        optimizer.step()
    assert not torch.equal(before, b.weight)
    assert torch.equal(original, base.weight)
    torch.xpu.synchronize()
    result.update(valid=True, nf4_pass=True, stage='complete',
                  peak_allocated=torch.xpu.max_memory_allocated(selected[0]))
except Exception as error:
    result['error'] = f'{type(error).__name__}: {error}'
finally:
    result['finished'] = time.time()
    save()
sys.exit(0 if result['valid'] else 1)
