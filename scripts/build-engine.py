#!/usr/bin/env python3
"""Build the pinned upstream PSCat commit, unmodified, for the browser.

Pass --source /path/to/clean/pscat to reuse a checkout at the exact pin.
The default disposable checkout is .engine-source (never the app repository).
SVG/PDF output is part of upstream's WASM build (PSCatLabs/pscat#1004), so no
local patch is applied.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PIN = 'db44e121123ceb737f70daffd34c0a6853dc37a1'

def run(args, cwd, **kwargs):
    return subprocess.run(args, cwd=cwd, check=True, timeout=600, **kwargs)

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
    if subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=source).strip():
        raise SystemExit('Use a clean upstream checkout: the engine is built unmodified.')
    command=['cargo','rustc','--lib','--release','--locked','--target','wasm32-unknown-unknown','--no-default-features','--crate-type','cdylib']
    if args.offline: command.insert(2,'--offline')
    run(command, source)
    output = ROOT / 'public/engine'
    output.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source/'target/wasm32-unknown-unknown/release/pscat.wasm',output/'pscat.wasm')
    (output/'pscat.wasm').chmod(0o644)
    shutil.copyfile(source/'web/pscat.js',output/'pscat.js')
    def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
    version=next(l.split('"')[1] for l in (source/'Cargo.toml').read_text().splitlines() if l.startswith('version'))
    provenance={
        'repository':'https://github.com/PSCatLabs/pscat','branch':'main',
        'commit':PIN,'crateVersion':version,'patches':'none',
        'wasmSha256':sha(output/'pscat.wasm'),
        'wrapperSha256':sha(output/'pscat.js'),'rustc':subprocess.check_output(['rustc','--version'],text=True).strip(),
        'license':'(MIT OR Apache-2.0) AND OFL-1.1 AND LPPL-1.3c',
    }
    (output/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(f'Wrote {output}; unmodified upstream engine and wrapper at {PIN}.')

if __name__ == '__main__': main()
