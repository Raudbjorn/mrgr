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
