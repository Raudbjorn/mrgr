"""Run with python3 -m unittest discover -s experiments/lora -p 'test_*.py'."""
import unittest
from runtime import HERE, read, stage_environment


class EnvironmentTest(unittest.TestCase):
    def test_pinned_gpu_environment(self):
        config = read(HERE / 'config.json')
        env = stage_environment(config)
        self.assertEqual(env['ONEAPI_DEVICE_SELECTOR'], 'level_zero:0')
        self.assertEqual(env['OCL_ICD_VENDORS'], config['ocl_icd_vendors'])
        self.assertTrue(env['HF_HOME'].startswith(config['storage'] + '/'))
        changed = dict(config, oneapi_device_selector='level_zero:1')
        self.assertEqual(stage_environment(changed)['ONEAPI_DEVICE_SELECTOR'], 'level_zero:1')

    def test_failed_worker_stops_coordinator(self):
        import tempfile
        import sys
        from pathlib import Path
        from runtime import guarded
        with tempfile.TemporaryDirectory() as directory:
            config = read(HERE / 'config.json')
            with self.assertRaisesRegex(RuntimeError, 'failed; see'):
                guarded(Path(directory), 'bad-worker', [sys.executable, '-c', 'raise SystemExit(7)'], config, timeout=10)
            record = read(Path(directory) / 'bad-worker.execution.json')
            self.assertEqual(record['exit_code'], 7)
            self.assertEqual(record['environment']['PATH'], config['execution_path'])
