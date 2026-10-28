#!/usr/bin/env python3
"""Build a pinned PSCat checkout with only Printshop's vector ABI patch.

Pass --source /path/to/clean/pscat to reuse a checkout at the exact pin.
The default disposable checkout is .engine-source (never the app repository).
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PIN = 'e8d6cf29a3e9ae62390a834961df2fdb58c7d78e'

def run(args, cwd, **kwargs):
    return subprocess.run(args, cwd=cwd, check=True, timeout=300, **kwargs)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    source = (args.source or ROOT / '.engine-source').resolve()
    if not source.exists():
        run(['git','clone','https://github.com/PSCatLabs/pscat.git',str(source)], ROOT)
        run(['git','checkout','--detach',PIN], source)
    commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
    if commit != PIN:
        raise SystemExit(f'Expected PSCat {PIN}, got {commit}; use a dedicated checkout.')
    patch = ROOT / 'patches/pscat-vector-wasm.patch'
    clean = subprocess.run(['git','apply','--check',str(patch)],cwd=source,capture_output=True).returncode == 0
    if clean:
        if subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=source).strip():
            raise SystemExit('Use a clean upstream checkout.')
        run(['git','apply',str(patch)], source)
    else:
        diff = subprocess.check_output(['git','diff','--no-ext-diff','--src-prefix=a/','--dst-prefix=b/'],cwd=source)
        if diff != patch.read_bytes():
            raise SystemExit('Upstream changes differ from the expected adapter patch.')
    command=['cargo','rustc','--lib','--release','--locked','--target','wasm32-unknown-unknown','--no-default-features','--crate-type','cdylib']
    if args.offline: command.insert(2,'--offline')
    run(command, source)
    output = ROOT / 'public/engine'
    output.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source/'target/wasm32-unknown-unknown/release/pscat.wasm',output/'pscat.wasm')
    shutil.copyfile(source/'web/pscat.js',output/'pscat.js')
    def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
    provenance={
        'repository':'https://github.com/PSCatLabs/pscat','branch':'feature/functional-postscript',
        'commit':PIN,'crateVersion':'0.6.3','adapter':'patches/pscat-vector-wasm.patch',
        'adapterSha256':sha(patch),'wasmSha256':sha(output/'pscat.wasm'),
        'wrapperSha256':sha(output/'pscat.js'),'rustc':subprocess.check_output(['rustc','--version'],text=True).strip(),
        'license':'(MIT OR Apache-2.0) AND OFL-1.1 AND LPPL-1.3c',
    }
    (output/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(f'Wrote {output}; upstream wrapper unchanged, vector ABI adapter applied.')

if __name__ == '__main__': main()
