import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {defaults,templates} from '../src/model.js';
import {compileMenu,compileCard} from '../src/postscript.js';
import {preflightPrint} from '../src/preflight.js';
import {renderer,render,menu,makeMenu,common,sources,saveArtifact} from './helpers.mjs';

test('real WASM SVG/PDF exports contain vector geometry and valid page structure',async()=>{
  const result=await render();
  assert.equal(result.svgs.length,1);assert.match(result.svgs[0],/<path /);assert.doesNotMatch(result.svgs[0],/<image|<text/);
  assert.deepEqual(result.warnings,[]);assert.match(result.output,/PSDONE 1 14/);
  const pdf=Buffer.from(result.pdf).toString('latin1');assert.match(pdf,/^%PDF-1.4/);assert.match(pdf,/\/MediaBox \[0 0 612 792\]/);assert.match(pdf,/\/Count 1\b/);assert.doesNotMatch(pdf,/\/Subtype \/Image/);
  const start=Number(/startxref\n(\d+)/.exec(pdf)[1]);assert.equal(pdf.slice(start,start+4),'xref');
  assert.match(pdf,/%%EOF\n$/);
  const streams=[...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(m=>inflateSync(Buffer.from(m[1],'latin1')).toString());
  assert.ok(streams.some(s=>/\bm\b/.test(s)&&/\bf\b/.test(s)));
  await saveArtifact('classic-bistro',result);
});
test('same content and parameters produce byte-identical SVG, PDF and layout logs',async()=>{
  const a=await render(),b=await render();assert.deepEqual(a.svgs,b.svgs);assert.deepEqual(a.pdf,b.pdf);assert.equal(a.output,b.output);
  const changed=await render(menu,{palette:'wine'});assert.notEqual(changed.svgs[0],a.svgs[0]);
  assert.equal(changed.output,a.output);
});
test('each actual PostScript template renders distinctly with outlined Latin-1 type',async()=>{
  const hashes=[];
  for(const t of templates){const r=await render(menu,{template:t.id,palette:t.id==='retro-diner'?'teal':'olive'});assert.deepEqual(r.warnings,[]);assert.match(r.output,/PSDONE 1 14/);hashes.push(createHash('sha256').update(r.svgs[0]).digest('hex'));await saveArtifact(t.id,r);}
  assert.equal(new Set(hashes).size,3);
});
test('small, medium and 500-item menus flow completely within measured column bounds',async()=>{
  for(const n of [1,40,500]){
    const data=makeMenu(n);const r=await render(data);
    const bounds=[...r.output.matchAll(/PSITEM (\d+) (\d+) ([\d.]+) ([\d.]+)/g)].map(m=>m.slice(1).map(Number));
    assert.equal(bounds.length,n);assert.match(r.output,new RegExp(`PSDONE ${r.svgs.length} ${n}\\n`));
    const last=new Map();
    for(const [page,column,top,bottom] of bounds){assert.ok(top<=627&&bottom>=55);assert.ok(column===0||column===1);const key=`${page}/${column}`;if(last.has(key))assert.ok(top<=last.get(key));last.set(key,bottom);}
    const pdf=Buffer.from(r.pdf).toString('latin1');assert.match(pdf,new RegExp(`/Count ${r.svgs.length}\\b`));
    if(n===40)await saveArtifact('paginated-40-items',r);
  }
});
test('A4, one column, long wrapped names, newlines and density changes',async()=>{
  const data=makeMenu(20,'Fresh seasonal vegetables with toasted almonds\nServed with bread and a bright lemon dressing.');
  data.categories[0].items[0].name='Slow-roasted garden vegetables with herbs and farmhouse cheese';
  for(const density of ['airy','balanced','compact']){const r=await render(data,{pageSize:'a4',columns:1,density});assert.match(r.svgs[0],/width="595"/);assert.match(r.output,/PSDONE \d+ 20/);}
});
test('over-wide words, title and oversized blocks fail; interpreter recovers',async()=>{
  const word=makeMenu(1);word.categories[0].items[0].name='W'.repeat(100);await assert.rejects(()=>render(word),/printshop-word-too-wide/);
  const tall=makeMenu(1,Array(55).fill('a').join('\n'));await assert.rejects(()=>render(tall),/printshop-item-too-tall/);
  await assert.rejects(()=>render(menu,{businessName:'W'.repeat(80)}),/printshop-title-too-wide/);
  assert.equal((await render()).svgs.length,1);
});
test('content is literal data, cannot execute PostScript',async()=>{
  const data=makeMenu(1);data.categories[0].items[0].name='Soup) show showpage (injection';
  const r=await render(data,{columns:1});assert.equal(r.svgs.length,1);assert.match(r.output,/PSDONE 1 1/);
});
test('rendering failures never expose partial exports',()=>{
  assert.throws(()=>renderer.render({source:'this-operator-does-not-exist',width:612,height:792}),/undefined/);
  assert.throws(()=>renderer.result(),/completed/);
  assert.throws(()=>renderer.render({source:'',width:0,height:792}),/unusable/);
});
test('business card: two vector sides, bleed media, safe-area overflow and QR boundary',async()=>{
  const card={kind:'business-card',name:'Alex Morgan',role:'Owner & host',email:'hello@example.com',phone:'(415) 555-0128',website:'example.com',address:'42 Orchard Street'};
  const cardSources={common,card:await readFile('templates/business-card.ps','utf8')};
  const r=renderer.render(compileCard(card,defaults,cardSources));assert.equal(r.svgs.length,2);assert.match(r.output,/PSCARD 2/);
  assert.match(Buffer.from(r.pdf).toString('latin1'),/\/MediaBox \[0 0 270 162\]/);
  const preflight=preflightPrint(card,defaults,r);assert.equal(preflight.productionCertified,false);assert.ok(preflight.findings.some(f=>f.code==='missing-page-boxes'));
  assert.throws(()=>compileCard({...card,qr:'https://example.com'},defaults,cardSources),/awaiting/);
  assert.throws(()=>renderer.render(compileCard({...card,address:Array(15).fill('Address').join('\n')},defaults,cardSources)),/printshop-card-overflow/);
  await saveArtifact('business-card',r);
});
test('preflight reports missing output and exporter limitations truthfully',async()=>{
  assert.equal(preflightPrint(menu,defaults,null).readyForReview,false);
  const report=preflightPrint(menu,defaults,await render());assert.equal(report.readyForReview,true);assert.equal(report.productionCertified,false);
  assert.ok(report.findings.some(f=>f.code==='rgb-output'));assert.ok(report.findings.some(f=>f.code==='menu-no-bleed'));
});
test('shipped engine and wrapper match the provenance manifest',async()=>{
  const p=JSON.parse(await readFile('public/engine/provenance.json','utf8'));
  for(const [file,key] of [['public/engine/pscat.wasm','wasmSha256'],['public/engine/pscat.js','wrapperSha256'],['patches/pscat-vector-wasm.patch','adapterSha256']])assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),p[key]);
});
