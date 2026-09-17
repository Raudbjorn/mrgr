"""Export an offline audit correction without replacing either terminal audit."""
import argparse
from pathlib import Path
from runtime import ROOT, read, save, digest
from export_closeout import portable


def export(run, destination):
    destination.mkdir(parents=True, exist_ok=False)
    files=[]
    for name in ['audit.json', 'inputs.json', 'config.json']:
        source=run/name
        save(destination/name,portable(read(source)))
        files.append({'name':name,'source_sha256':digest(source),'export_sha256':digest(destination/name)})
    old=ROOT/'evidence/h0/ornith-9b-cross-validation-2026-09-16'
    save(destination/'manifest.json',{
        'version':'cv-review-correction/1',
        'transformation':'Local path redaction using export_closeout.portable; JSON reserialization. No observations rerun.',
        'files':files,
        'historical_files':{str(p.relative_to(ROOT)):digest(p) for p in [old/'audit.json',old/'inputs.json']},
        'implementation':{str(p.relative_to(ROOT)):digest(p) for p in [Path(__file__),Path(__file__).with_name('cross_validate.py'),ROOT/'evidence/h0/mutant-disposition.mjs']},
        'controls_run':0,'model_requests':0,'execution_authorized':False})


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args();export(args.run,args.destination)
