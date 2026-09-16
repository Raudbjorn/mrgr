"""No-model checks for CV admission controls and deterministic lineage grouping."""
import unittest
from cross_validate import control_audit, partition, configuration, validate_config


def case(i):
    return {'id':str(i),'cluster_id':f'org/repo-{i}','repository_provenance':{'body':{'id':i,'full_name':f'org/repo-{i}'}},'base':f'base-{i}','ours':f'ours-{i}','theirs':f'theirs-{i}','git':{'ours':f'parent-{i}-a','theirs':f'parent-{i}-b'}}


def mutant(reason=None,status=1,error=None):
    return {'name':'wrong-value','category':'test-failure','reason':reason,'stages':[{'stage':'build','status':0},{'stage':'test','status':status,'error':error}]}


class CrossValidationTest(unittest.TestCase):
    def test_timeout_does_not_complete_two_mutant_gate(self):
        result=control_audit([mutant(),mutant('test-timeout',None,'ETIMEDOUT')])
        self.assertEqual(result['verified_rejections'],1)
        self.assertFalse(result['controls'][1]['verified_rejection'])

    def test_real_failures_count_but_completion_and_infrastructure_do_not(self):
        self.assertEqual(control_audit([mutant(),mutant()])['verified_rejections'],2)
        self.assertEqual(control_audit([mutant('test-completion-contract',0),mutant(None,None,'bwrap failed')])['verified_rejections'],0)

    def test_parent_and_content_groups_cannot_cross_folds(self):
        cases=[case(i) for i in range(9)]
        cases[1]['git']['ours']=cases[0]['git']['ours']
        for k in ['base','ours','theirs']:cases[3][k]=cases[2][k]
        result=partition(cases)
        for a,b in [('0','1'),('2','3')]:
            self.assertEqual(result[a],result[b])
        self.assertEqual(result,partition(list(reversed(cases))))
        self.assertEqual(len({v['fold'] for v in result.values()}),5)

    def test_repository_lineage_and_normalized_content_are_grouped(self):
        cases=[case(i) for i in range(9)]
        cases[1]['cluster_id']=cases[0]['cluster_id'];cases[1]['repository_provenance']=cases[0]['repository_provenance']
        for k in ['base','ours','theirs']:
            cases[2][k]='x\r\n'+k;cases[3][k]='x\n'+k
        result=partition(cases)
        self.assertEqual(result['0'],result['1']);self.assertEqual(result['2'],result['3'])

    def test_too_few_groups_and_bad_provenance_stop(self):
        with self.assertRaisesRegex(AssertionError,'fewer than five'):partition([case(1)])
        cases=[case(i) for i in range(5)];cases[0]['cluster_id']='different/repo'
        with self.assertRaisesRegex(AssertionError,'provenance'):partition(cases)

    def test_unknown_config_and_changed_budget_rejected(self):
        # configuration() only reads the prior frozen sampler; no server request.
        from unittest.mock import patch
        from runtime import read,HERE
        old=read(HERE/'config.json')
        with patch('cross_validate.read',side_effect=[old,{'sampler':{'top_k':40,'max_tokens':4096}}]):c=configuration()
        validate_config(c)
        with self.assertRaisesRegex(AssertionError,'configuration'):validate_config(c|{'unused':1})
        with self.assertRaises(AssertionError):validate_config(c|{'wall_seconds':259200})

if __name__=='__main__':unittest.main()
