import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {importMenu} from '../src/csv.js';
import {compileMenu} from '../src/postscript.js';
import {defaults} from '../src/model.js';

test('offline package resolves the real module graph and exact compressed engine without a server',async()=>{
  await import('../scripts/build.mjs');
  const html=await readFile('dist/printshop-offline.html','utf8');
  assert.ok(!html.includes('<script type="module" src='));
  assert.ok(!html.includes('<link rel="stylesheet"'));
  assert.ok(!html.includes('printshop-offline.html'),'The offline file does not link to itself');
  const bootstrap=/<script type="module">([\s\S]*?)<\/script>/.exec(html)[1];
  const initialization=bootstrap.replace("await import(moduleURL('src/app.js'));",'');
  const anchors=[{href:'public/example-menu.csv'},{href:'public/licenses/THIRD_PARTY_NOTICES.md'},{href:'./'}].map(value=>({...value,getAttribute(){return value.href;}}));
  const context={URL,Blob,Response,Uint8Array,atob,DecompressionStream,document:{querySelectorAll:()=>anchors}};
  const result=await vm.runInNewContext(`(async()=>{${initialization}\nreturn {bundle:globalThis.PRINTSHOP_OFFLINE,app:moduleURL('src/app.js'),urls:[...cache.values()]};})()`,context);
  const manifest=JSON.parse(await readFile('public/engine/provenance.json','utf8'));
  assert.equal(createHash('sha256').update(new Uint8Array(result.bundle.wasm)).digest('hex'),manifest.files['pscat.wasm']);
  assert.equal(result.bundle.text['public/example-menu.csv'],await readFile('public/example-menu.csv','utf8'));
  assert.ok(anchors[0].href.startsWith('blob:'));assert.equal(anchors[2].href,'#');
  const workerSource=await (await fetch(result.bundle.workerURL)).text();
  assert.doesNotMatch(workerSource,/^import\s/m,'Offline worker must not fetch a second module from a file origin');
  // The package's own code survives intact: every line of each engine file
  // that is not module syntax appears verbatim, in order, in the worker.
  for(const file of ['core.js','renderer.js','index.js']){
    const lines=(await readFile('public/engine/'+file,'utf8')).split('\n').filter(line=>!/^(?:import\s|export\s*\{)/.test(line))
      .map(line=>line.replace(/^export /,'').replaceAll('import.meta.url','self.location.href'));
    let at=0;for(const line of lines){at=workerSource.indexOf(line,at);assert.ok(at>=0,`Worker lost ${file}: ${line}`);at+=line.length;}
  }
  assert.equal(result.bundle.workerType,'classic');
  assert.doesNotMatch(workerSource,/^export\s|import\.meta/m,'Offline worker must be valid classic JavaScript');
  new vm.Script(workerSource);
  // Exercise the exact packaged classic worker, including the real WASM,
  // rather than proving only that its transformed source can be parsed.
  const replies=[];
  const scope={self:{postMessage:value=>replies.push(value)},WebAssembly,TextEncoder,TextDecoder,setTimeout,URL};
  vm.runInNewContext(workerSource,scope);
  const menu=importMenu(result.bundle.text['public/example-menu.csv']);
  const job=compileMenu(menu,defaults,{common:result.bundle.text['templates/common.ps'],template:result.bundle.text['templates/classic-bistro.ps']});
  // postMessage structured-clones the bytes into the worker's realm; do the
  // same, since the package checks `instanceof ArrayBuffer` in that realm.
  const cloneIntoWorker=vm.runInNewContext('bytes=>new Uint8Array(bytes).slice().buffer',scope);
  await scope.self.onmessage({data:{id:7,wasm:cloneIntoWorker(result.bundle.wasm),job}});
  // Progress messages may precede the result on a slow machine.
  assert.ok(replies.every(reply=>reply.id===7));replies.splice(0,replies.length,...replies.filter(reply=>!reply.progress));
  assert.equal(replies.length,1);assert.equal(replies[0].id,7);assert.equal(replies[0].error,undefined);
  assert.match(replies[0].result.output,/PSDONE 1 14/);
  assert.match(replies[0].result.svgs[0],/<path /);
  assert.equal(new TextDecoder().decode(replies[0].result.pdf.slice(0,8)),'%PDF-1.4');
  const scratch=await mkdtemp(path.join(os.tmpdir(),'printshop-bundle-test-'));
  try{
    let index=0;
    for(const url of [...result.urls,result.bundle.workerURL]){
      const code=await (await fetch(url)).text();
      const file=path.join(scratch,`${index++}.mjs`);await writeFile(file,code);
      execFileSync(process.execPath,['--check',file],{timeout:10000,stdio:'pipe'});
      assert.doesNotMatch(code,/^import\s+.*from ['"]\./m,'Unresolved static module import');
    }
    assert.ok(index>=8,'Incomplete module graph');
  }finally{
    for(const url of result.urls)URL.revokeObjectURL(url);
    URL.revokeObjectURL(result.bundle.workerURL);
    await rm(scratch,{recursive:true,force:true});
  }
});
test('served edition uses only relative URLs, so it works under a path prefix such as GitHub Pages /print-shop/',async()=>{
  const index=await readFile('index.html','utf8');
  assert.doesNotMatch(index,/\b(?:href|src)="\//,'index.html has a root-absolute URL');
  assert.match(index,/<a href="printshop-offline.html" download="printshop-offline.html">/,'served page offers the offline edition');
  for(const file of ['src/app.js','src/assets.js','src/render-worker.js','src/browser-tests.js'])
    assert.doesNotMatch(await readFile(file,'utf8'),/fetch\(\s*['"`]\//,`${file} fetches a root-absolute URL`);
});
