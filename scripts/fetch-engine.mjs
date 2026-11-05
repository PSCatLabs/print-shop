// Install the pinned pscat release into public/engine/ (issue #28).
//
// The pin lives in public/engine/provenance.json: the npm package tarball
// attached to a PSCatLabs/pscat GitHub release, by exact version, URL and
// SHA-256. This script downloads it (cached in .engine-cache/), verifies the
// tarball hash, extracts it and copies the files Printshop uses, unmodified,
// into public/engine/. Every installed file is checked against its own hash in
// the manifest. Any mismatch is a hard failure: nothing is installed from an
// unverified tarball, and a build never runs on an engine that does not match.
//
// Idempotent: when the installed files already match, it does nothing (and
// needs no network). Moving to another release, or to the npm registry, is a
// manifest change: a new url, sha256 and file hashes.
//
//   node scripts/fetch-engine.mjs     (npm run engine:fetch)
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const engine=path.join(root,'public/engine');
const cache=path.join(root,'.engine-cache');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>readFile(file).catch(error=>{if(error.code==='ENOENT')return null;throw error;});

export async function manifest(){return JSON.parse(await readFile(path.join(engine,'provenance.json'),'utf8'));}

/** Installed files whose bytes do not match the manifest (missing ones included). */
export async function mismatched(pin){
  pin??=await manifest();
  const bad=[];
  for(const [file,hash] of Object.entries(pin.files)){
    const bytes=await read(path.join(engine,file));
    if(!bytes||sha256(bytes)!==hash)bad.push(file);
  }
  return bad;
}

/** Throw unless every installed engine file matches the manifest. */
export async function verifyEngine(){
  const bad=await mismatched();
  if(bad.length)throw Error(`pscat engine files missing or not the pinned release (${bad.join(', ')}). Run npm run engine:fetch.`);
}

async function tarball(pin){
  const file=path.join(cache,path.basename(new URL(pin.url).pathname));
  const cached=await read(file);
  if(cached&&sha256(cached)===pin.sha256)return file;
  const response=await fetch(pin.url);
  if(!response.ok)throw Error(`Could not download ${pin.url}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const hash=sha256(bytes);
  if(hash!==pin.sha256)throw Error(`SHA-256 mismatch for ${pin.url}: expected ${pin.sha256}, got ${hash}. Refusing to install it.`);
  await mkdir(cache,{recursive:true});
  await writeFile(file+'.part',bytes);await rename(file+'.part',file);
  return file;
}

export async function ensureEngine(){
  const pin=await manifest();
  if(!(await mismatched(pin)).length)return false;
  const file=await tarball(pin);
  // Re-check the cached bytes right before extracting them.
  if(sha256(await readFile(file))!==pin.sha256)throw Error(`SHA-256 mismatch for ${file}.`);
  const scratch=await mkdtemp(path.join(os.tmpdir(),'printshop-engine-'));
  try{
    execFileSync('tar',['-xzf',file,'-C',scratch],{stdio:'pipe',timeout:120000});
    const pkg=JSON.parse(await readFile(path.join(scratch,'package/package.json'),'utf8'));
    if(pkg.name!==pin.package||pkg.version!==pin.version)throw Error(`Tarball holds ${pkg.name}@${pkg.version}, not ${pin.package}@${pin.version}.`);
    for(const [name,hash] of Object.entries(pin.files)){
      const bytes=await readFile(path.join(scratch,'package',name));
      if(sha256(bytes)!==hash)throw Error(`${name} in the verified tarball does not match its manifest hash.`);
    }
    for(const name of Object.keys(pin.files)){
      const target=path.join(engine,name);
      await copyFile(path.join(scratch,'package',name),target+'.part');await rename(target+'.part',target);
    }
  }finally{await rm(scratch,{recursive:true,force:true});}
  await verifyEngine();
  return true;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const pin=await manifest();
    const installed=await ensureEngine();
    console.log(`pscat ${pin.version} ${installed?'installed from':'already installed from'} ${pin.url} (sha256 ${pin.sha256}).`);
  }catch(error){console.error(error.message);process.exit(1);}
}
