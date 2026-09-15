import unittest
from q8_secondary import fidelity_reading

class FidelityTest(unittest.TestCase):
    def test_registered_thresholds_and_missingness(self):
        self.assertEqual(fidelity_reading(1,6),'quantization mismatch supported')
        self.assertEqual(fidelity_reading(6,6),'inconclusive')
        self.assertEqual(fidelity_reading(1,2),'deployment fidelity not established')
        self.assertEqual(fidelity_reading(1,4),'inconclusive')
        self.assertEqual(fidelity_reading(1,0,False),'INCOMPLETE (fidelity instrument)')

if __name__=='__main__':unittest.main()

class LaunchTest(unittest.TestCase):
    def test_deadline_is_bounded_and_exhaustion_rejected(self):
        from q8_secondary import diagnostic_limit
        self.assertEqual(diagnostic_limit(250000),7200)
        self.assertEqual(diagnostic_limit(123),123)
        with self.assertRaises(ValueError):diagnostic_limit(0)
    def test_busy_service_rejected(self):
        from unittest.mock import patch
        from q8_secondary import idle_service
        with patch('q8_secondary.api',side_effect=[{'status':'ok'},[{'is_processing':True}]]):
            with self.assertRaisesRegex(AssertionError,'busy'):idle_service()
    def test_restore_requires_health(self):
        from unittest.mock import patch
        from q8_secondary import restore
        with patch('q8_secondary.subprocess.run') as command,patch('q8_secondary.api',return_value={'status':'ok'}):
            restore({'service':'fixture.service'})
            self.assertIn('systemctl start fixture.service',command.call_args.args[0])
    def test_finish_restores_after_failed_worker(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from runtime import save,read
        from q8_secondary import finish
        with tempfile.TemporaryDirectory() as directory:
            r=Path(directory);save(r/'execution.json',{'started':0});save(r/'gpu-lease.json',{})
            with patch.dict('os.environ',{'SERVICE_RESULT':'timeout'}),patch('q8_secondary.restore') as restore,patch('q8_secondary.subprocess.run'):
                finish(r);restore.assert_called_once()
            self.assertEqual(read(r/'execution.json')['status'],'failed')
