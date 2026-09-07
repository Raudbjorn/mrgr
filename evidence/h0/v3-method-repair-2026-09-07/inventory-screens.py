"""Audit archived screens; preserve attempts, deduplicate cases, never infer recovery."""
import hashlib
import json
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

out = Path(__file__).parent
files = subprocess.check_output(['rg', '--files', 'evidence/h0', '.do-not-commit', '-g', 'freeze.json'], text=True).splitlines()
sha = lambda b: hashlib.sha256(b).hexdigest()
inputs, attempts, screens, missing = [], [], [], []
seen_screens = set()
for name in sorted(files):
    path = Path(name)
    raw = path.read_bytes()
    freeze = json.loads(raw)
    config = freeze.get('config', {})
    if not all(k in config for k in ('repo', 'output', 'repository', 'triples')):
        continue
    receipt = path.with_name('screening.json')
    if not receipt.exists():
        missing.append({'freeze': name, 'reason': 'no-archived-screening-record'})
        continue
    data = receipt.read_bytes()
    key = (str(Path(config['output']).resolve()), freeze.get('source_sha256'), freeze.get('script_sha256'), sha(data))
    if key in seen_screens:
        continue
    seen_screens.add(key)
    inputs.append({'freeze': name, 'freeze_sha256': sha(raw), 'screening': str(receipt), 'screening_sha256': sha(data)})
    rows = json.loads(data)
    screens.append({'repo': config['repo'].lower(), 'output': config['output'], 'rows': len(rows), 'freeze': name})
    for row in rows:
        ref = row.get('reference', {})
        stderr = '\n'.join(s.get('stderr', '') for s in ref.get('stages', []))
        directory = Path(config['output']) / row['event']
        scaffold, oracle = directory / 'scaffold', directory / 'oracle'
        retained = (scaffold / row['path']).is_file() and (oracle / 'build.sh').is_file()
        script = (oracle / 'build.sh').read_text() if retained else ''
        imports = sorted(set(re.findall(r'cannot find package "([^"]+)"', stderr)))
        attempts.append({'repo': config['repo'].lower(), 'event': row['event'], 'path': row['path'], 'ordinal': row.get('ordinal'), 'screening': str(receipt), 'directory': str(directory), 'reference_category': ref.get('category'), 'status': row.get('status'), 'reason': row.get('reason'), 'reference_sha256': row.get('git_validation', {}).get('reference_sha256'), 'work_label': bool(re.search(r'^# _/work', stderr, re.M)), 'missing_packages': imports, 'internal_import_rejected': 'use of internal package' in stderr, 'retained': retained, 'legacy_script': 'GO111MODULE=off' in script if retained else None, 'has_go_mod': (scaffold / 'go.mod').is_file() if retained else None, 'has_vendor': (scaffold / 'vendor').is_dir() if retained else None, 'missing_already_vendored': [p for p in imports if (scaffold / 'vendor' / p).is_dir()] if retained else None})
case_groups = {}
for i, a in enumerate(attempts):
    case_groups.setdefault((a['repo'], a['event'], a['path']), []).append(i)
cases = []
for (repo, event, path), indices in sorted(case_groups.items()):
    rs = [attempts[i] for i in indices]
    passing = any(r['status'] == 'screen-passed-not-yet-admitted' for r in rs)
    failures = [i for i in indices if attempts[i]['work_label'] and attempts[i]['reference_category'] == 'build-failure']
    available = [i for i in failures if attempts[i]['retained'] and attempts[i]['legacy_script']]
    cases.append({'repo': repo, 'event': event, 'path': path, 'attempt_indices': indices, 'ever_screen_passed': passing, 'work_label_build_failure_attempts': failures, 'recoverable_input_attempts': available, 'recheck_candidate': bool(available) and not passing})
assert len(cases) == len({(r['repo'], r['event'], r['path']) for r in cases})
assert sum(len(c['attempt_indices']) for c in cases) == len(attempts)
summary = {'screen_records': len(screens), 'repositories_with_screen_records': len({r['repo'] for r in screens}), 'attempts': len(attempts), 'unique_event_path_cases': len(cases), 'reference_categories': dict(Counter(a['reference_category'] or 'not-evaluated' for a in attempts)), 'work_label_build_failure_attempts': sum(a['work_label'] and a['reference_category'] == 'build-failure' for a in attempts), 'unique_work_label_build_failure_cases': sum(bool(c['work_label_build_failure_attempts']) for c in cases), 'affected_repositories': len({c['repo'] for c in cases if c['work_label_build_failure_attempts']}), 'retained_unpassed_recheck_cases': sum(c['recheck_candidate'] for c in cases), 'retained_unpassed_recheck_repositories': len({c['repo'] for c in cases if c['recheck_candidate']}), 'missing_screening_records': len(missing)}
result = {'at': datetime.now(timezone.utc).isoformat(), 'source_sha256': sha(Path(__file__).read_bytes()), 'summary': summary, 'inputs': inputs, 'screens': screens, 'attempts': attempts, 'cases': cases, 'missing': missing, 'limits': 'Existing evidence/h0 and .do-not-commit freeze+screening pairs only. Attempts are not independent cases. Recheck eligibility means retained failed inputs, not recoverable behavior or admission. No estimate of repaired yield. Case keys still require global parent/content/exposure checks before admission.'}
(out / 'screen-inventory.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(summary, indent=2))
