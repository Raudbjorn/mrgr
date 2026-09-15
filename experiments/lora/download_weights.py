"""Download only pinned checkpoint shards, keeping all cache writes off /home."""
from pathlib import Path
import sys
from huggingface_hub import snapshot_download
from runtime import HERE, read, save, digest
run=Path(sys.argv[1]); c=read(HERE/'config.json')
assert read(run/'preflight.json')['valid']
snapshot=Path(snapshot_download(c['model'],revision=c['revision'],allow_patterns=['*.safetensors'],max_workers=2))
save(run/'checkpoint.json',{'revision':c['revision'],'snapshot':str(snapshot),'files':{p.name:{'bytes':p.stat().st_size,'sha256':digest(p)} for p in snapshot.glob('*.safetensors')}})
