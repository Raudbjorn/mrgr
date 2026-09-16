"""Regression checks for the actual repair and evaluation functions (no model calls)."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from runtime import ROOT,CELLS,save,digest
from heldout import exposure_records
from evaluate import classify,schedule,summarize
from revision import allocate

spec=importlib.util.spec_from_file_location('locked',ROOT/'evidence/h0/go-locked-deps.py')
locked=importlib.util.module_from_spec(spec);spec.loader.exec_module(locked)

class RevisionTest(unittest.TestCase):
    def test_exposure_requires_case_record(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);p=root/'cases.json';save(p,[{'repo':'a/b','event':'a'*40,'cluster_id':'a/b'}]);q=root/'frame.json';save(q,{'known_remotes':['c/d']})
            ledger={'files':[{'path':x.name,'sha256':digest(x)} for x in [p,q]]}
            with patch('heldout.ROOT',root):rows=exposure_records(ledger)
            self.assertEqual([r['repo'] for r in rows],['a/b'])
    def test_pinned_dependencies(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'Godeps').mkdir()
            save(root/'Godeps/Godeps.json',{'Deps':[{'ImportPath':'github.com/a/b/sub','Rev':'a'*40}]})
            self.assertEqual(locked.pins(root),('Godeps/Godeps.json',[('github.com/a/b/sub','a'*40)]))
            self.assertEqual(locked.source('github.com/a/b/sub'),('github.com/a/b','https://github.com/a/b.git'))
            with self.assertRaises(AssertionError):locked.source('github.com/a/../b')
            save(root/'Godeps/Godeps.json',{'Deps':[{'ImportPath':'github.com/a/b','Rev':'master'}]})
            with self.assertRaisesRegex(AssertionError,'immutable'):locked.acquire(root,root/'out')
            self.assertFalse(json.loads((root/'out/dependencies.json').read_text())['complete'])
    def test_cells_and_lineages(self):
        rows=[]
        for cell in CELLS:
            for i in range(8):
                name=f'{cell}-{i}'
                rows.append({'case':{'repo':name,'event':name,'cluster_id':name,'cell':cell,'git':{'ours':name+'a','theirs':name+'b'},'base':name,'ours':'a','theirs':'b'}})
        selected,counts=allocate(rows,{'seed':1})
        self.assertEqual(len(selected),24);self.assertTrue(all(n==6 for n in counts.values()))
        self.assertEqual(allocate(rows[:4],{'seed':1})[1][CELLS[1]],0)
    def test_diagnostics_do_not_emit_inference_or_single_repeat_flip_rates(self):
        examples=[{'id':'a','lineage':'a/b','cell':CELLS[0]}]
        rows=[r|{'success':True,'outcome':'success'} for r in schedule(examples,1,1)]
        result=summarize(rows,examples,1,1,'IN-SAMPLE; NOT EFFICACY')
        self.assertNotIn('paired_delta',result)
        self.assertEqual(result['per_case'][0]['flip_rates'],{'base':None,'adapter':None})
        self.assertIn('paired_delta',summarize(rows,examples,1,1,'fresh-heldout'))
    def test_real_decoder_and_missingness(self):
        body={'choices':[{'finish_reason':'stop','message':{'content':'{"choice":"x"}'}}],'usage':{'prompt_tokens':4,'completion_tokens':3}}
        self.assertTrue(classify(body,{'x':True})['success'])
        body['choices'][0]['message']['content']='{"choice":"x","choice":"y"}'
        self.assertEqual(classify(body,{'x':True})['outcome'],'format-failure')
        body['choices'][0]['finish_reason']='length'
        self.assertEqual(classify(body,{'x':True})['reason'],'truncated')
        examples=[{'id':'a','lineage':'a/b','cell':CELLS[0]}]
        plan=schedule(examples,3,1)
        for i in range(0,6,2):self.assertEqual(plan[i]['seed'],plan[i+1]['seed'])
        results=[r|{'success':None,'outcome':'infrastructure-missing'} for r in plan]
        self.assertFalse(summarize(results,examples,3,1)['complete'])
        self.assertEqual(summarize(results,examples,3,1)['success_bounds']['base'],{'lower':0,'upper':1})

if __name__=='__main__':unittest.main()
