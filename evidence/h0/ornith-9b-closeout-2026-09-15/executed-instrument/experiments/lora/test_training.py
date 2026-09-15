import unittest

class MaskTest(unittest.TestCase):
    def test_selected_logits_equal_masked_full_loss(self):
        import torch
        from types import SimpleNamespace
        from train import supervised_loss
        torch.manual_seed(1)
        logits=torch.randn(1,7,11,requires_grad=True)
        ids=torch.tensor([[1,2,3,4,5,6,7]])
        class Model:
            def __call__(self,input_ids,logits_to_keep,use_cache):
                return SimpleNamespace(logits=logits[:,logits_to_keep,:])
        selected=supervised_loss(Model(),ids,4)
        labels=ids[:,1:].clone();labels[:,:3]=-100
        full=torch.nn.functional.cross_entropy(logits[:,:-1,:].reshape(-1,11),labels.flatten())
        self.assertTrue(torch.equal(selected,full))
        selected.backward();self.assertTrue(torch.equal(logits.grad[:,:3],torch.zeros_like(logits.grad[:,:3])))
