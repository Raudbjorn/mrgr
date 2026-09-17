"""No-model checks for CV admission controls and deterministic lineage grouping."""
import unittest
from cross_validate import control_audit, partition, configuration, validate_config


def case(i):
    return {'id':str(i),'cluster_id':f'org/repo-{i}','repository_provenance':{'body':{'id':i,'full_name':f'org/repo-{i}'}},'base':f'base-{i}','ours':f'ours-{i}','theirs':f'theirs-{i}','git':{'ours':f'parent-{i}-a','theirs':f'parent-{i}-b'}}


def mutant(reason=None,status=1,error=None):
    return {'name':'wrong-value','candidate_sha256':'a'*64,'category':'test-failure','reason':reason,'stages':[{'stage':'build','status':0},{'stage':'test','status':status,'error':error,'stdout':'--- FAIL: TestWrong (0.00s)'}]}


class CrossValidationTest(unittest.TestCase):
    def test_timeout_does_not_complete_two_mutant_gate(self):
        result=control_audit([mutant(),mutant('test-timeout',124)])
        self.assertEqual(result['verified_rejections'],1)
        self.assertFalse(result['controls'][1]['verified_rejection'])

    def test_real_failures_count_but_completion_and_infrastructure_do_not(self):
        self.assertEqual(control_audit([mutant(),mutant()])['verified_rejections'],1)
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
        with self.assertRaisesRegex(ValueError,'fewer than five'):partition([case(1)])
        cases=[case(i) for i in range(5)];cases[0]['cluster_id']='different/repo'
        with self.assertRaisesRegex(ValueError,'provenance'):partition(cases)

    def test_unknown_config_and_changed_budget_rejected(self):
        c=configuration()
        validate_config(c)
        for changes in [{'unused':1},{'wall_seconds':259200},{'learning_rate':.001},{'dropout':0},{'target_modules':'.*'},{'max_training_tokens':128},{'model':'other'},{'revision':'other'},{'sampler':{'top_k':40,'max_tokens':4096}}]:
            with self.subTest(changes=changes),self.assertRaisesRegex(ValueError,'configuration'):validate_config(c|changes)

    def test_each_rejection_guard_independently(self):
        import copy
        good=mutant()
        self.assertEqual(control_audit([good])['verified_rejections'],1)
        variants=[good|{'reason':'test-timeout'},good|{'reason':'test-completion-contract'},good|{'category':'environment-error'},good|{'name':None},good|{'candidate_sha256':None}]
        for key,value in [('status',2),('status',137),('signal','SIGTERM'),('error','ETIMEDOUT'),('stdout','panic: init failed')]:
            m=copy.deepcopy(good);m['stages'][1][key]=value;variants.append(m)
        for m in variants:
            with self.subTest(m=m):self.assertEqual(control_audit([m])['verified_rejections'],0)

    def test_audit_preserves_terminal_and_never_overwrites(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from cross_validate import audit
        with tempfile.TemporaryDirectory() as d:
            run=Path(d)/'audit'
            with patch('cross_validate._audit',side_effect=FileNotFoundError('missing receipt')):
                self.assertTrue(audit(run)['terminal'])
            before=(run/'audit.json').read_bytes()
            with self.assertRaises(FileExistsError):audit(run)
            self.assertEqual(before,(run/'audit.json').read_bytes())

    def test_complete_audit_fixture_and_bad_receipt(self):
        import tempfile,json
        from pathlib import Path
        from unittest.mock import patch
        import cross_validate as cv
        from runtime import save,digest
        from pilot import messages,target
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);training=root/'training';prepared=root/'prepared';source=root/'cases.json'
            training.mkdir();(prepared/'oracle').mkdir(parents=True)
            cases=[];examples=[]
            for i in range(cv.COHORT_SIZE):
                c=case(i)|{'repo':f'org/repo-{i}','event':str(i),'language':'go','path':'x.go','cell':'blend/module','era':{'version':'historical-root-build-era/1'},'boundary':dict.fromkeys(['prefix','suffix','automatic_prefix','automatic_suffix'],'')}
                candidates=[{'id':'cand-'+digest('replacement'),'text':'replacement','evaluation':{'pass':True,'category':'behavioral-pass'}}]
                cases.append(c)
                prompt=messages(c,candidates,20260908)
                examples.append({'id':c['id'],'lineage':c['cluster_id'],'event':c['event'],'cell':c['cell'],'messages':prompt,'target':target(candidates,[candidates[0]['id']]),'candidate_labels':{candidates[0]['id']:True}})
            save(source,cases)
            for e in examples:
                receipt=prepared/'oracle'/(e['id']+'.json')
                save(receipt,{'source_archive_sha256':digest(source),'status':'admitted','oracle':{'valid':True,'reference':[{'pass':True}]*3,'mutations':[mutant(),mutant()|{'name':'other','candidate_sha256':'b'*64}]},'candidates':candidates})
                e['receipt_sha256']=digest(receipt)
            save(prepared/'prepared.json',{'examples':examples})
            save(training/'tokenized.json',{'prepared_sha256':digest(prepared/'prepared.json'),'examples':[{'id':e['id']} for e in examples],'excluded':[]})
            save(training/'training-protocol.json',{'tokenized_sha256':digest(training/'tokenized.json')})
            save(training/'checkpoint.json',{'revision':cv.configuration()['revision']})
            revision=root/'runs/9b-revision-2026-09-15';revision.mkdir(parents=True)
            save(revision/'revision.json',{'sampler':cv.configuration()['sampler']})
            with patch.multiple(cv,SOURCE=source,TRAINING=training,PREPARED=prepared,STORAGE=root):
                good=cv.audit(root/'good')
                self.assertEqual(good['finding'],'AUDIT PASSED; execution not implemented')
                self.assertFalse(good['execution_authorized'])
                (prepared/'oracle/0.json').unlink()
                bad=cv.audit(root/'bad')
                self.assertEqual(len([r for r in bad['rows'] if r['issues']]),1)
                self.assertTrue(bad['terminal'])

    def test_optimized_cli_fails_closed(self):
        import tempfile,subprocess,sys
        from pathlib import Path
        with tempfile.TemporaryDirectory() as d:
            # Existing directory is rejected even with asserts disabled.
            r=subprocess.run([sys.executable,'-O',str(Path(__file__).with_name('cross_validate.py')),'audit',d],capture_output=True)
            self.assertNotEqual(r.returncode,0)

if __name__=='__main__':unittest.main()
