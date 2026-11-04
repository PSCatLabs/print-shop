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
// Group PSITEM placements into category pieces (a category's run of items in one column).
function pieces(output,sizes){
  const placed=[...output.matchAll(/PSITEM (\d+) (\d+) ([\d.]+) ([\d.]+)/g)].map(m=>m.slice(1).map(Number));
  assert.equal(placed.length,sizes.reduce((a,b)=>a+b,0),'every item exactly once');
  let i=0;return sizes.map(n=>{const runs=[];for(const [page,column,top,bottom] of placed.slice(i,i+n)){
    const last=runs.at(-1);if(last&&last.page===page&&last.column===column){last.count++;last.bottom=bottom;}else runs.push({page,column,top,bottom,count:1});}
    i+=n;return runs;});
}
const shortMenu=sizes=>({kind:'menu',categories:sizes.map((n,c)=>({name:`Section ${c+1}`,items:Array.from({length:n},(_,i)=>({name:`Dish ${c+1}.${i+1}`,description:i%2?'Garden vegetables with herbs and toasted almonds':'',price:'12',dietary:'',variations:''}))}))});
test('a category never ends with its final item alone in a new column',async()=>{
  const sizes=menu.categories.map(c=>c.items.length);
  for(const t of templates){const runs=pieces((await render(menu,{template:t.id})).output,sizes);
    assert.ok(runs.some(r=>r.length>1),'the sample splits a category');
    for(const r of runs)if(r.length>1)assert.ok(r.at(-1).count>=2,`${t.id}: lone continuation`);}
  for(const n of [40,500]){const data=makeMenu(n);const r=await render(data);
    for(const runs of pieces(r.output,data.categories.map(c=>c.items.length)))if(runs.length>1)assert.ok(runs.at(-1).count>=2,`${n} items: lone continuation`);}
});
test('short two-column menus are balanced without splitting categories needlessly',async()=>{
  const sample=pieces((await render()).output,menu.categories.map(c=>c.items.length)).flat();
  const bottom=column=>Math.min(...sample.filter(p=>p.column===column).map(p=>p.bottom));
  assert.ok(Math.abs(bottom(0)-bottom(1))<60,'sample columns end within one item of each other');
  const three=pieces((await render(shortMenu([3]))).output,[3]);
  assert.deepEqual(three[0].map(p=>[p.column,p.count]),[[0,3]],'a three-item category is not split 1 + 2');
  const six=pieces((await render(shortMenu([2,4]))).output,[2,4]);
  assert.deepEqual(six.map(runs=>runs.map(p=>[p.column,p.count])),[[[0,2]],[[1,4]]],'two short categories take a column each');
  // Feasible floors can be half-point intervals (12.5 pt description leading).
  const lines=[[0,7,1,1,1],[0],[2,5,6,5,2,1]];
  const uneven={kind:'menu',categories:lines.map((counts,c)=>({name:`Part ${c+1}`,items:counts.map((n,i)=>({name:`Dish ${i+1}`,description:Array(n).fill('a').join('\n'),price:'9',dietary:'',variations:''}))}))};
  const placed=pieces((await render(uneven)).output,lines.map(l=>l.length)).flat();
  assert.ok(Math.min(...placed.map(p=>p.bottom))>=157.5,'balance search found the half-point floor');
  // Balancing must not create a lone final item the unbalanced flow avoided,
  // even when another category already has a lone opening item.
  const pair=[[0,22,6],[0,0,0]];
  const lopsided={kind:'menu',categories:pair.map((counts,c)=>({name:`Course ${c+1}`,items:counts.map((n,i)=>({name:`Plate ${i+1}`,description:Array(n).fill('a').join('\n'),price:'9',dietary:'',variations:''}))}))};
  for(const runs of pieces((await render(lopsided)).output,[3,3]))if(runs.length>1)assert.ok(runs.at(-1).count>=2,'balancing created a lone final item');
  const one=pieces((await render(shortMenu([2,4]),{columns:1})).output,[2,4]);
  assert.ok(one.flat().every(p=>p.column===0),'one column is never balanced');
});
test('A4, one column, long wrapped names, newlines and density changes',async()=>{
  const data=makeMenu(20,'Fresh seasonal vegetables with toasted almonds\nServed with bread and a bright lemon dressing.');
  data.categories[0].items[0].name='Slow-roasted garden vegetables with herbs and farmhouse cheese';
  for(const density of ['airy','balanced','compact']){const r=await render(data,{pageSize:'a4',columns:1,density});assert.match(r.svgs[0],/width="595"/);assert.match(r.output,/PSDONE \d+ 20/);}
});
test('over-wide words, title and oversized blocks fail; interpreter recovers',async()=>{
  const word=makeMenu(1);word.categories[0].items[0].name='W'.repeat(100);await assert.rejects(()=>render(word),/printshop-word-too-wide/);
  const tall=makeMenu(1,Array(55).fill('a').join('\n'));await assert.rejects(()=>render(tall),/printshop-item-too-tall/);
  const long=makeMenu(500,'a '.repeat(300).trim());await assert.rejects(()=>render(long),/printshop-too-many-pages/,'page limit before the render budget');
  await assert.rejects(()=>render(makeMenu(500,Array(120).fill('a').join('\n')),{businessName:'W'.repeat(80)}),/printshop-title-too-wide/,'title error before measuring');
  const wideHeading=makeMenu(500,'a '.repeat(300).trim());wideHeading.categories[0].name='W'.repeat(60);
  await assert.rejects(()=>render(wideHeading),/printshop-word-too-wide/,'heading checked before its items are measured');
  const capped=makeMenu(90,Array(20).fill('a').join('\n'));
  capped.categories.push({name:'Tail',items:makeMenu(410,'a '.repeat(300).trim()).categories.flatMap(c=>c.items).map(i=>({...i,dietary:'a '.repeat(40).trim(),variations:'a '.repeat(120).trim()}))});
  await assert.rejects(()=>render(capped),/printshop-too-many-pages/,'page limit reached while measuring lazily');
  const tallLate=makeMenu(500,Array(120).fill('a').join('\n'));await assert.rejects(()=>render(tallLate),/printshop-item-too-tall/,'named error before the render budget');
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
  const withQr=renderer.render(compileCard({...card,qr:'https://example.com/menu'},defaults,cardSources));
  assert.equal(withQr.svgs.length,2);assert.match(withQr.output,/PSQR \d+ \/?Q [\d.]+ \d+\n/);
  const qrReport=preflightPrint({...card,qr:'https://example.com/menu'},defaults,withQr);
  assert.equal(qrReport.readyForReview,true);assert.ok(qrReport.findings.some(f=>f.code==='qr-code'));
  assert.equal(preflightPrint({...card,qr:'https://example.com/menu'},defaults,r).findings.find(f=>f.severity==='error')?.code,'qr-missing');
  assert.equal(withQr.svgs[0],r.svgs[0],'the front is unchanged by a QR on the back');
  assert.throws(()=>compileCard({...card,qr:'https://例え.jp'},defaults,cardSources),/plain ASCII/);
  assert.throws(()=>compileCard({...card,qr:'x'.repeat(201)},defaults,cardSources),/200 characters/);
  assert.throws(()=>renderer.render(compileCard({...card,address:Array(15).fill('Address').join('\n')},defaults,cardSources)),/printshop-card-overflow/);
  await saveArtifact('business-card',r);
});
test('card QR: module grid, safe area, density limit and lib/qr.ps errors',async()=>{
  const card={kind:'business-card',name:'Alex Morgan',role:'Owner & host',email:'hello@example.com',phone:'(415) 555-0128',website:'example.com',address:'42 Orchard Street'};
  const cardSources={common,card:await readFile('templates/business-card.ps','utf8')};
  for(const qr of ['https://example.com','https://example.com/menus/autumn-2026?table=12','WIFI:T:WPA;S:Olive Room;P:correct horse battery;;','x'.repeat(120)]){
    const r=renderer.render(compileCard({...card,qr},defaults,cardSources));
    const [,version,,module,n]=/PSQR (\d+) \/?([LMQH]) ([\d.]+) (\d+)/.exec(r.output).map((v,i)=>i&&i!==2?Number(v):v);
    const px=module*300/72;assert.ok(Math.abs(px-Math.round(px))<1e-6&&px>=4,`whole 300 dpi pixels per module (${px})`);
    assert.equal(n,17+4*version+8);assert.ok(module*n<=72.0001,'at most 1 in square');
  }
  assert.match(renderer.render(compileCard({...card,qr:'x'.repeat(200)},defaults,cardSources)).output,/PSQR 12 \/?Q 0.96 73/,'the 200-character limit still prints 4 px modules');
  const dense=compileCard({...card,qr:'x'},defaults,cardSources);
  assert.throws(()=>renderer.render({...dense,source:dense.source.replace('/qr (x)',`/qr (${'x'.repeat(230)})`)}),/printshop-qr-too-dense/,'backstop past the validated length');
  const job=compileCard({...card,qr:'https://example.com'},defaults,cardSources);
  assert.throws(()=>renderer.render({...job,source:job.source.replace('<< /Level /Q >> qrencode','<< /Level /Z >> qrencode')}),/qr-level-must-be-L-M-Q-or-H/,'library errors surface by name');
});
test('preflight reports missing output and exporter limitations truthfully',async()=>{
  assert.equal(preflightPrint(menu,defaults,null).readyForReview,false);
  const report=preflightPrint(menu,defaults,await render());assert.equal(report.readyForReview,true);assert.equal(report.productionCertified,false);
  assert.ok(report.findings.some(f=>f.code==='rgb-output'));assert.ok(report.findings.some(f=>f.code==='menu-no-bleed'));
});
test('preflight blocks substitutes, miscounts, bad bounds and wrong media',async()=>{
  const src=await sources();
  const job=compileMenu(menu,defaults,{...src,template:src.template.replace("/NameFont Config /Sans get { /Helvetica-Bold } { /Times-Bold } ifelse def","/NameFont /Palatino-Roman def")});
  assert.throws(()=>renderer.render(job),/printshop-font-substituted/,'an aliased face is refused, not silently substituted');
  const good=await render();const codes=r=>preflightPrint(menu,defaults,r).findings.filter(f=>f.severity==='error').map(f=>f.code);
  assert.deepEqual(codes(good),[]);
  assert.deepEqual(codes({...good,warnings:['font fallback']}),['engine-warning']);
  assert.deepEqual(codes({...good,output:good.output.replace('PSDONE 1 14','PSDONE 1 13')}),['content-count']);
  assert.deepEqual(codes({...good,output:good.output.replace(/PSITEM 1 0 [\d.]+ ([\d.]+)/,'PSITEM 1 0 700 $1')}),['layout-bounds']);
  assert.deepEqual(codes({...good,svgs:good.svgs.map(s=>s.replace(/width="612(pt)?"/,'width="595$1"'))}),['media-size']);
  assert.deepEqual(preflightPrint(menu,{...defaults,pageSize:'a4'},good).findings.filter(f=>f.severity==='error').map(f=>f.code),['media-size']);
  const card={kind:'business-card',name:'Alex Morgan',role:'Owner',email:'a@example.com',phone:'1',website:'example.com',address:'1 Main St'};
  const cardResult=renderer.render(compileCard(card,defaults,{common,card:await readFile('templates/business-card.ps','utf8')}));
  assert.equal(preflightPrint(card,defaults,cardResult).readyForReview,true);
  assert.deepEqual(preflightPrint(card,defaults,{...cardResult,svgs:cardResult.svgs.slice(0,1)}).findings.filter(f=>f.severity==='error').map(f=>f.code),['media-size','content-count']);
  const report=preflightPrint(menu,defaults,good);
  assert.equal(report.productionCertified,false);assert.ok(report.findings.some(f=>f.code==='proof-not-certified'));
});
test('preflight claims match the exported PDF bytes',async()=>{
  const card={kind:'business-card',name:'Alex Morgan',role:'Owner',email:'a@example.com',phone:'1',website:'example.com',address:'1 Main St'};
  const outputs=[await render(),await render(menu,{template:'retro-diner',palette:'teal'}),
    renderer.render(compileCard(card,defaults,{common,card:await readFile('templates/business-card.ps','utf8')}))];
  for(const r of outputs){
    const pdf=Buffer.from(r.pdf).toString('latin1');
    assert.match(pdf,/^%PDF-1\.4/,'"PDF 1.4"');
    assert.doesNotMatch(pdf,/\/Font\b|\/FontFile/,'"outlined type": no fonts in the PDF');
    assert.doesNotMatch(pdf,/\/OutputIntents?\b|GTS_PDFX|\/ICCBased/,'"no ICC output intent or PDF/X"');
    assert.doesNotMatch(pdf,/\/TrimBox|\/BleedBox/,'"no TrimBox/BleedBox"');
    const ops=new Set([...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].flatMap(m=>inflateSync(Buffer.from(m[1],'latin1')).toString().split(/\s+/)).filter(t=>/^[A-Za-z]+$/.test(t)));
    assert.ok(ops.has('rg'),'RGB fills');
    for(const op of ['k','K','g','G','cs','CS','sc','SC','scn','SCN','Do','BT'])assert.ok(!ops.has(op),`"RGB vector only": unexpected ${op}`);
  }
});
test('shipped engine and wrapper match the provenance manifest',async()=>{
  const p=JSON.parse(await readFile('public/engine/provenance.json','utf8'));
  for(const [file,key] of [['public/engine/pscat.wasm','wasmSha256'],['public/engine/pscat.js','wrapperSha256']])assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),p[key]);
  assert.equal(p.branch,'main');assert.equal(p.patches,'none');assert.match(p.commit,/^[0-9a-f]{40}$/);
});
