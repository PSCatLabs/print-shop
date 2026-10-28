import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

test('offline package resolves the real module graph and exact compressed engine without a server',async()=>{
  await import('../scripts/build.mjs');
  const html=await readFile('dist/printshop-offline.html','utf8');
  assert.ok(!html.includes('<script type="module" src='));
  assert.ok(!html.includes('<link rel="stylesheet"'));
  const bootstrap=/<script type="module">([\s\S]*?)<\/script>/.exec(html)[1];
  const initialization=bootstrap.replace("await import(moduleURL('src/app.js'));",'');
  const anchors=[{href:'/public/example-menu.csv'},{href:'/public/licenses/THIRD_PARTY_NOTICES.md'},{href:'/'}].map(value=>({...value,getAttribute(){return value.href;}}));
  const context={URL,Blob,Response,Uint8Array,atob,DecompressionStream,document:{querySelectorAll:()=>anchors}};
  const result=await vm.runInNewContext(`(async()=>{${initialization}\nreturn {bundle:globalThis.PRINTSHOP_OFFLINE,app:moduleURL('src/app.js'),urls:[...cache.values()]};})()`,context);
  const manifest=JSON.parse(await readFile('public/engine/provenance.json','utf8'));
  assert.equal(createHash('sha256').update(new Uint8Array(result.bundle.wasm)).digest('hex'),manifest.wasmSha256);
  assert.equal(result.bundle.text['public/example-menu.csv'],await readFile('public/example-menu.csv','utf8'));
  assert.ok(anchors[0].href.startsWith('blob:'));assert.equal(anchors[2].href,'#');
  const scratch=await mkdtemp(path.join(os.tmpdir(),'printshop-bundle-test-'));
  try{
    let index=0;
    for(const url of result.urls){
      const code=await (await fetch(url)).text();
      const file=path.join(scratch,`${index++}.mjs`);await writeFile(file,code);
      execFileSync(process.execPath,['--check',file],{timeout:10000,stdio:'pipe'});
      assert.doesNotMatch(code,/^import\s+.*from ['"]\./m,'Unresolved static module import');
    }
    assert.ok(index>=8,'Incomplete module graph');
  }finally{
    for(const url of result.urls)URL.revokeObjectURL(url);
    await rm(scratch,{recursive:true,force:true});
  }
});
