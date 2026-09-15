"""Bounded subprocess execution with durable accounting and systemd GPU restoration."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CELLS = ['side-verbatim/module', 'blend/module', 'side-verbatim/GOPATH', 'blend/GOPATH']

def digest(value):
    if isinstance(value, Path):
        h = hashlib.sha256()
        with value.open('rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):
                h.update(block)
        return h.hexdigest()
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode()).hexdigest()

def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.tmp')
    with temp.open('w') as f:
        json.dump(value, f, indent=2)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    temp.replace(path)

def read(path):
    return json.loads(Path(path).read_text())

def api(config, path):
    with urlopen(config['endpoint'] + path, timeout=10) as response:
        return json.load(response)

def stage_environment(config):
    return {
        'PATH': config['execution_path'],
        'HF_HOME': config['storage'] + '/hf',
        'TMPDIR': config['storage'] + '/tmp',
        'TOKENIZERS_PARALLELISM': 'false',
        'ONEAPI_DEVICE_SELECTOR': config['oneapi_device_selector'],
        'OCL_ICD_VENDORS': config['ocl_icd_vendors'],
    }


def guarded(run, name, command, config, gpu=False, timeout=None):
    run = Path(run)
    run.mkdir(parents=True, exist_ok=True)
    with (run / 'execution.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = run / (name + '.execution.json')
        identity = digest(json.dumps({'command': command, 'config': config}, sort_keys=True))
        if state.exists():
            previous = read(state)
            if previous['identity'] != identity:
                raise RuntimeError('configuration drift on resume')
            if previous['status'] != 'complete':
                raise RuntimeError('interrupted/failed stage requires a separately recorded attempt')
            return previous
        spent = sum(read(p).get('elapsed', config['compute_seconds']) for p in run.glob('*.execution.json'))
        remaining = config['compute_seconds'] - spent
        if remaining <= 0:
            raise RuntimeError('compute budget exhausted')
        limit = min(remaining, timeout or remaining)
        record = {'identity': identity, 'command': command, 'started': time.time(), 'status': 'started', 'environment': stage_environment(config)}
        executable = command
        if gpu:
            available = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))) * 1024
            assert available >= config.get('min_host_available_bytes', 0), 'insufficient available host RAM'
            assert api(config, '/health')['status'] == 'ok'
            assert config['served_model'] in [m['id'] for m in api(config, '/v1/models')['data']], 'unexpected served model'
            assert all(not s['is_processing'] for s in api(config, '/slots')), 'server busy'
            save(run / (name + '.server-before.json'), api(config, '/props'))
            unit = 'mrgr-lora-' + name + '-' + str(os.getpid())
            service = config['service']
            record['environment'] = stage_environment(config)
            args = ['systemd-run', '--wait', '--pipe', '--collect', '--unit=' + unit,
                    '--property=User=' + os.environ.get('USER', 'svnbjrn'),
                    '--property=WorkingDirectory=' + str(ROOT),
                    '--property=MemoryMax=' + str(config['host_memory_bytes']),
                    '--property=MemorySwapMax=0', '--property=KillMode=control-group',
                    '--property=RuntimeMaxSec=' + str(int(limit)),
                    '--property=ExecStartPre=+/usr/bin/systemctl stop ' + service,
                    '--property=ExecStopPost=+/usr/bin/systemctl start ' + service,
                    *['--setenv=' + k + '=' + v for k, v in record['environment'].items()], *command]
            executable = ['ssh', 'vinbonesjr', shlex.join(args)]
            record['unit'] = unit
        save(state, record)
        start = time.monotonic()
        with (run / (name + '.log')).open('wb') as log:
            process = subprocess.Popen(executable, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True, env=os.environ | record['environment'])
            try:
                while process.poll() is None:
                    elapsed = time.monotonic() - start
                    save(run / 'heartbeat.json', {'stage': name, 'pid': process.pid, 'at': time.time(), 'elapsed': elapsed})
                    if elapsed > limit + (120 if gpu else 0):
                        raise TimeoutError('stage exceeded budget')
                    time.sleep(min(5, max(0.1, limit - elapsed)))
                record.update(status='complete' if process.returncode == 0 else 'failed', exit_code=process.returncode)
            except BaseException as error:
                if gpu:
                    subprocess.run(['ssh', 'vinbonesjr', 'systemctl stop ' + shlex.quote(record['unit'])], timeout=120, check=False)
                else:
                    import signal
                    os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=120)
                record.update(status='failed', error=str(error))
                raise
            finally:
                record.update(elapsed=time.monotonic() - start, finished=time.time())
                save(state, record)
                if record['status'] != 'complete':
                    subprocess.run(['logger', '-t', 'mrgr-lora', f'{name} FAILED: {state}'], check=False, timeout=10)
        if record['status'] != 'complete':
            raise RuntimeError(f'{name} failed; see {run / (name + ".log")}')
        return record
