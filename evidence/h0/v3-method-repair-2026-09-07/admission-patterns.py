"""Exploratory historical screen yield, using Git features and held-out repositories."""
import hashlib
import json
import os
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

out = Path(__file__).parent
raw = (out / 'screen-inventory.json').read_bytes()
audit = json.loads(raw)
sha = lambda b: hashlib.sha256(b).hexdigest()
configs = {}
for source in audit['inputs']:
    freeze = json.loads(Path(source['freeze']).read_text())
    configs[source['screening']] = (freeze['config'], freeze.get('created_at', ''))
rows, missing = [], []
for case in audit['cases']:
    eligible = [audit['attempts'][i] for i in case['attempt_indices'] if audit['attempts'][i]['reference_category']]
    if not eligible:
        continue
    # First observed oracle attempt per case; later retries cannot revise its label.
    first = min(eligible, key=lambda r: (configs[r['screening']][1], r['screening']))
    config, timestamp = configs[first['screening']]
    command = ['git', '-C', config['repository'], 'ls-tree', case['event'], '--', 'go.mod', 'vendor']
    r = subprocess.run(command, capture_output=True, text=True, timeout=30, env={**os.environ, 'GIT_NO_LAZY_FETCH': '1'})
    if r.returncode:
        missing.append({'repo': case['repo'], 'event': case['event'], 'path': case['path'], 'reason': 'Git feature unavailable', 'returncode': r.returncode})
        continue
    entries = {line.split('\t', 1)[1]: line.split()[1] for line in r.stdout.splitlines()}
    module = entries.get('go.mod') == 'blob'
    vendor = entries.get('vendor') == 'tree'
    rows.append({'repo': case['repo'], 'event': case['event'], 'path': case['path'], 'first_screening': first['screening'], 'timestamp': timestamp, 'module': module, 'committed_vendor': vendor, 'cell': f'{"module" if module else "gopath"}/{"vendor" if vendor else "no-vendor"}', 'screen_passed': first['status'] == 'screen-passed-not-yet-admitted', 'reference_category': first['reference_category'], 'git_feature_stdout_sha256': sha(r.stdout.encode())})
assert len(rows) == len({(r['repo'], r['event'], r['path']) for r in rows})
sizes = Counter(r['repo'] for r in rows)
def rate(train, cell=None):
    selected = [r for r in train if cell is None or r['cell'] == cell]
    # Equal total weight per training repository, and Beta(1,1) regularization.
    return (1 + sum(r['screen_passed'] / sizes[r['repo']] for r in selected)) / (2 + sum(1 / sizes[r['repo']] for r in selected))
for repo in sizes:
    train = [r for r in rows if r['repo'] != repo]
    assert train and all(r['repo'] != repo for r in train)
    for row in (r for r in rows if r['repo'] == repo):
        row['held_out_prediction'] = rate(train, row['cell'])
        row['held_out_constant'] = rate(train)
def brier(key):
    return sum((r[key] - r['screen_passed']) ** 2 / sizes[r['repo']] for r in rows) / len(sizes)
cells = {}
for cell in sorted({r['cell'] for r in rows}):
    rs = [r for r in rows if r['cell'] == cell]
    cells[cell] = {'cases': len(rs), 'repositories': len({r['repo'] for r in rs}), 'first_screen_passes': sum(r['screen_passed'] for r in rs), 'raw_case_rate': sum(r['screen_passed'] for r in rs) / len(rs), 'smoothed_repository_weighted_prediction': rate(rows, cell)}
summary = {'cases_with_features': len(rows), 'repositories': len(sizes), 'missing_features': len(missing), 'first_screen_passes': sum(r['screen_passed'] for r in rows), 'cells': cells, 'held_out_repository_equal_weight_brier': {'four_cell': brier('held_out_prediction'), 'constant': brier('held_out_constant')}}
result = {'at': datetime.now(timezone.utc).isoformat(), 'source_sha256': sha(Path(__file__).read_bytes()), 'inventory_sha256': sha(raw), 'summary': summary, 'rows': rows, 'missing': missing, 'target': 'First oracle-screen success among historical oracle-evaluated cases, with equal repository weighting; not final admission or deployment prevalence.', 'limits': ['Post-bug historical labels; predictive transport after the GOPATH repair is unverified.', 'Git features precede dependency acquisition; generated vendor directories are not predictors.', 'Within-repository cases remain dependent; leave-one-repository-out evaluation does not remove acquisition-frame selection.', 'No outcome-driven threshold or acquisition reorder is adopted from this exploration.']}
(out / 'admission-patterns.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(summary, indent=2))
