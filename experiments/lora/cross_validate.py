"""Admission preflight for five-fold CV; invalid controls stop before training."""
import argparse
import collections
import json
import math
import subprocess
import sys
from pilot import messages, target
from pathlib import Path
from runtime import ROOT, HERE, read, save, digest
SEED = 20260916
COHORT_SIZE = 57
FOLDS = 5
CONFIG_SHA256 = 'd0c88d07ef506c655a157f1a11dc37fbd57f77fe1a57e4ac6105c17fc6827793'
PROTOCOL = ROOT / 'docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-cross-validation-2026-09-16.md'
STORAGE = Path('/mnt/mrgr/ornith-lora')
TRAINING = STORAGE / 'runs/9b-training-2026-09-15'
PREPARED = STORAGE / 'runs/9b-selector-2026-09-14-r2'
SOURCE = ROOT / 'evidence/h0/v3-candidate-repair-2026-09-07/run/cases.json'
TRAIN_KEYS = {'model', 'revision', 'rank', 'alpha', 'dropout', 'learning_rate', 'gradient_accumulation', 'target_modules', 'max_training_tokens', 'epochs', 'warmup_ratio', 'allow_model_cpu_offload', 'seed'}
CONFIG_KEYS = TRAIN_KEYS | {'storage', 'service', 'served_model', 'execution_path', 'oneapi_device_selector', 'ocl_icd_vendors', 'sampler', 'wall_seconds', 'cleanup_seconds', 'training_available_bytes', 'training_memory_bytes', 'inference_memory_bytes', 'folds', 'repeats'}

def require(condition, message='admission invariant failed'):
    if not condition:
        raise ValueError(message)

def configuration():
    require(digest(HERE / 'cv-config.json') == CONFIG_SHA256, 'registered configuration file drift')
    return read(HERE / 'cv-config.json')

def validate_config(c):
    require(set(c) == CONFIG_KEYS, 'unknown or missing configuration keys')
    require(c == configuration(), 'configuration differs from the complete registered CV profile')

def partition(cases):
    """Connected components, then seeded largest-first greedy bin packing."""
    parent = {c['id']: c['id'] for c in cases}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    seen = {}
    for c in cases:
        provenance = c['repository_provenance']['body']
        origin = provenance.get('source') or provenance
        require(origin['full_name'].lower() == c['cluster_id'].lower(), 'lineage provenance mismatch')
        triple = [c[k].replace('\r\n', '\n') for k in ['base', 'ours', 'theirs']]
        keys = [('lineage', c['cluster_id']), ('repository', origin['id']), ('content', digest(json.dumps(triple))), *[('parent', c['git'][side]) for side in ['ours', 'theirs']]]
        for key in keys:
            if key in seen:
                parent[find(c['id'])] = find(seen[key])
            seen[key] = c['id']
    groups = collections.defaultdict(list)
    for c in cases:
        groups[find(c['id'])].append(c['id'])
    components = [sorted(v) for v in groups.values()]
    components.sort(key=lambda ids: (-len(ids), digest(str(SEED) + ':' + ':'.join(ids))))
    require(len(components) >= FOLDS, 'fewer than five disjoint groups')
    folds = [[] for _ in range(FOLDS)]
    counts = [0] * FOLDS
    mapping = {}
    for ids in components:
        f = min(range(FOLDS), key=lambda i: (counts[i], len(folds[i]), i))
        folds[f].append(ids)
        counts[f] += len(ids)
        group = digest(':'.join(ids))
        for id in ids:
            mapping[id] = {'fold': f, 'group': group}
    require(set(mapping) == set(parent))
    return mapping

def _audit(run):
    c = configuration()
    validate_config(c)
    tokens = read(TRAINING / 'tokenized.json')
    prepared = read(PREPARED / 'prepared.json')
    training_protocol = read(TRAINING / 'training-protocol.json')
    require(training_protocol['tokenized_sha256'] == digest(TRAINING / 'tokenized.json'), 'tokenized input drift')
    checkpoint = read(TRAINING / 'checkpoint.json')
    require(checkpoint['revision'] == c['revision'], 'checkpoint revision drift')
    require(tokens['prepared_sha256'] == digest(PREPARED / 'prepared.json'))
    ids = {x['id'] for x in tokens['examples']}
    require(len(ids) == COHORT_SIZE)
    examples = [x for x in prepared['examples'] if x['id'] in ids]
    cases = [x for x in read(SOURCE) if x['id'] in ids]
    require(len(examples) == len(cases) == COHORT_SIZE)
    require({e['id'] for e in examples} == {c['id'] for c in cases} == ids, 'cohort membership mismatch')
    require(len({(x['repo'], x['event']) for x in cases}) == COHORT_SIZE, 'duplicate event')
    by_id = {x['id']: x for x in cases}
    files = [SOURCE, TRAINING / 'tokenized.json', PREPARED / 'prepared.json', TRAINING / 'checkpoint.json', TRAINING / 'training-protocol.json', HERE / 'config.json', HERE / 'cv-config.json', STORAGE / 'runs/9b-revision-2026-09-15/revision.json']
    require(read(STORAGE / 'runs/9b-revision-2026-09-15/revision.json')['sampler']==c['sampler'], 'historical sampler drift')
    original=read(HERE/'config.json')
    require(all(original[k]==c[k] for k in TRAIN_KEYS-{'seed'}), 'historical training config drift')
    source_sha = digest(SOURCE)
    candidate_counts = collections.Counter()
    per_cell = collections.defaultdict(collections.Counter)
    rows = []
    for e in examples:
        case = by_id[e['id']]
        receipt = PREPARED / 'oracle' / f"{e['id']}.json"
        files.append(receipt)
        row = {'id': e['id'], 'lineage': e.get('lineage'), 'event': e.get('event'), 'cell': e.get('cell'), 'status': 'verified', 'issues': []}
        rows.append(row)
        try:
            v = read(receipt)
            row['receipt_sha256'] = digest(receipt)
            require(digest(receipt) == e['receipt_sha256'], 'receipt drift')
            require(v['source_archive_sha256'] == source_sha, 'source archive drift')
            require(v['status'] == 'admitted' and v['oracle']['valid'], 'prior admission absent')
            require(len(v['oracle']['reference']) == 3 and all((x['pass'] for x in v['oracle']['reference'])), 'reference controls')
            controls = control_audit(v['oracle']['mutations'])
            row.update(controls)
            if controls['verified_rejections'] < 2:
                row['issues'].append('fewer than two verified compiling test-rejected mutations')
            labels = {x['id']: x['evaluation']['pass'] for x in v['candidates']}
            require(labels == e['candidate_labels'] and all((type(x) is bool for x in labels.values())), 'label mismatch')
            payload = json.loads(e['messages'][1]['content'])
            require(e['messages'] == messages(case, v['candidates'], 20260908), 'ordered prompt mismatch')
            for item in v['candidates']:
                ev = item['evaluation']
                require(item['id'] == 'cand-' + digest(item['text']), 'candidate hash mismatch')
                require(ev['category'] in ['behavioral-pass', 'build-failure', 'test-failure'] and ev.get('reason') not in ['test-timeout', 'test-completion-contract'], 'unresolved candidate label')
            require(e['target'] == target(v['candidates'], [x['id'] for x in payload['candidates']]), 'target mismatch')
            require(case['era']['version'] == 'historical-root-build-era/1' and e['cell'] == case['cell'], 'historical stratum mismatch')
            candidate_counts[sum(labels.values())] += 1
            per_cell[e['cell']]['cases'] += 1
            per_cell[e['cell']]['available'] += any(labels.values())
        except (AssertionError, KeyError, ValueError, TypeError, AttributeError, IndexError, OSError, subprocess.SubprocessError) as error:
            row['issues'].append(str(error))
        if row['issues']:
            row['status'] = 'incomplete-admission'
    grouping_issues = []
    try:
        mapping = partition(cases)
    except (KeyError, ValueError, TypeError, AttributeError, IndexError) as error:
        mapping = {}
        grouping_issues.append(str(error))
    provisional = []
    for f in range(c['folds']) if mapping else []:
        held = [e for e in examples if mapping[e['id']]['fold'] == f]
        training = [e for e in examples if mapping[e['id']]['fold'] != f]
        require(not {e['lineage'] for e in held} & {e['lineage'] for e in training})
        provisional.append({'fold': f, 'train_cases': len(training), 'test_cases': len(held), 'test_lineages': len({e['lineage'] for e in held}), 'planned_steps': c['epochs'] * math.ceil(len(training) / c['gradient_accumulation']), 'cells': dict(collections.Counter((e['cell'] for e in held)))})
    problems = [row for row in rows if row['issues']]
    summary = {'version': 'ornith-lineage-cv-audit/2', 'finding': 'INCOMPLETE (admission audit)' if problems or grouping_issues else 'AUDIT PASSED; execution not implemented', 'cases': COHORT_SIZE, 'lineages': len({e.get('lineage') for e in examples}), 'groups': len({m['group'] for m in mapping.values()}), 'candidate_pass_counts': dict(candidate_counts), 'cells': dict(per_cell), 'grouping_issues': grouping_issues, 'historical_exclusions': tokens['excluded'], 'provisional_folds': provisional, 'rows': rows, 'training_runs': 0, 'model_requests': 0, 'terminal': True, 'execution_authorized': False, 'next': 'Stop; no case removal, replacement, revalidation or training under this protocol.' if problems or grouping_issues else 'Closed protocol; new protocol required before execution.'}
    save(run / 'config.json', c)
    save(run / 'audit.json', summary)
    save(run / 'inputs.json', {str(p): digest(p) if p.is_file() else None for p in files})
    print(json.dumps({'finding': summary['finding'], 'cases': COHORT_SIZE, 'problems': len(problems), 'training_runs': 0, 'model_requests': 0}))
    return summary

def control_audit(mutations):
    result = subprocess.run(['node', str(ROOT / 'evidence/h0/mutant-disposition.mjs')], input=json.dumps(mutations), text=True, capture_output=True, check=True, timeout=30)
    return json.loads(result.stdout)

def audit(run):
    run.mkdir(parents=True, exist_ok=False)
    try:
        return _audit(run)
    except Exception as error:
        summary = {'finding': 'INCOMPLETE (audit instrument)', 'error': str(error), 'terminal': True, 'training_runs': 0, 'model_requests': 0}
        save(run / 'audit.json', summary)
        return summary
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['audit'])
    parser.add_argument('run', type=Path)
    args = parser.parse_args()
    result = audit(args.run)
    print(json.dumps({'finding': result['finding'], 'execution_authorized': False}))
    sys.exit(1)
