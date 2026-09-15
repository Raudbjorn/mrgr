"""Export portable receipt derivatives while retaining original and exported hashes."""
import json
from pathlib import Path
from runtime import ROOT,read,save,digest

OUT=ROOT/'evidence/h0/ornith-9b-closeout-2026-09-15'
RUNS=Path('/mnt/mrgr/ornith-lora/runs')
REPLACEMENTS=[(str(ROOT),'$REPOSITORY'),('/mnt/mrgr/ornith-lora','$PILOT_STORAGE'),('/mnt/nvme1/llama-package-c83464b8','$LLAMA_SOURCE'),('/home/svnbjrn','$HOME')]


def portable(value):
    if isinstance(value,str):
        for old,new in REPLACEMENTS:value=value.replace(old,new)
        return value
    if isinstance(value,list):return [portable(x) for x in value]
    if isinstance(value,dict):return {portable(k):portable(v) for k,v in value.items()}
    return value


def main():
    files=[]
    primary=RUNS/'9b-revision-2026-09-15';secondary=RUNS/'9b-q8-secondary-2026-09-15';diagnostic=RUNS/'9b-fidelity-closeout-2026-09-15';training=RUNS/'9b-training-2026-09-15'
    for r,names in [(primary,['revision.json','execution.json','result.json','prior-round-correction.json','allocation.json','screen-outcomes.json','conversion.json','acquisition/frame.json','acquisition/acquisition.json','in-sample/evaluation-summary.json']), (secondary,['protocol.json','execution.json','status.json','budget.json','conversion.json','resource-transition.json','execution.log']), (diagnostic,['protocol.json','execution.json','status.json','result.json','fidelity.json','execution.log']), (training,['training-result.json','export-readiness.json','full-model-check.json'])]:
        files.extend(r/n for n in names if (r/n).exists())
    files.extend(primary.glob('acquisition/*/*-screen/*/receipt.json'))
    files.extend(diagnostic.glob('service-receipts/*.json'))
    files.extend(diagnostic.glob('fidelity-*/*.json'))
    files.extend(diagnostic.glob('fidelity-*/attempts/*/*.json'))
    manifest=[]
    for source in sorted(set(files)):
        relative=source.relative_to(RUNS);dest=OUT/'receipts'/relative;dest.parent.mkdir(parents=True,exist_ok=True)
        value=portable(read(source)) if source.suffix=='.json' else portable(source.read_text())
        if source.suffix=='.json':save(dest,value)
        else:dest.write_text(value)
        manifest.append({'source':'$RUNS/'+str(relative),'export':str(dest.relative_to(OUT)),'original_sha256':digest(source),'export_sha256':digest(dest),'transformation':'Replace declared local path prefixes; JSON reserialized. Source bytes retained privately.'})
    save(OUT/'receipt-manifest.json',{'version':'ornith-closeout-exports/1','path_tokens':['$REPOSITORY','$PILOT_STORAGE','$LLAMA_SOURCE','$HOME','$RUNS'],'files':manifest,'historical_instrument_commit':'3b503d56f','originals_modified':False})
    verify=[]
    for row in read(OUT/'executed-instrument.json')['rows']:
        assert digest(OUT/row['snapshot'])==row['sha256'],row['snapshot']
        verify.append({'source':row['source'],'protocol':row['protocol'],'sha256':row['sha256'],'snapshot_match':True})
    save(OUT/'instrument-verification.json',{'historical_commit':'3b503d56f','rows':verify,'scope':'Exact executed repository sources/compiled JS; repaired launcher intentionally differs at branch HEAD.'})
    print({'exported_receipts':len(manifest),'verified_instrument_entries':len(verify)})

if __name__=='__main__':main()
