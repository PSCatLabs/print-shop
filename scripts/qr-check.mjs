// Independent QR verification for the business card (PS-013).
//
// Renders cards with QR payloads through the real WASM engine, then decodes
// every export with decoders that share no code with pscat's lib/qr.ps:
//   - SVG: the back page rasterized by Chrome at 300 dpi on a canvas, as the
//     app's PNG export does, then read by Chrome's BarcodeDetector.
//   - PDF: page 2 rasterized at 300 dpi by Poppler's pdftoppm (a renderer
//     independent of pscat), then read by BarcodeDetector.
//   - PNG: the same canvas path as the app's PNG export, encoded to PNG bytes,
//     reloaded, then read by BarcodeDetector.
// BarcodeDetector is Chrome's Shape Detection API (Apple Vision on macOS).
// The app's own PNG download is also decoded inside the browser suite.
//
//   node scripts/qr-check.mjs        (needs Chrome with BarcodeDetector and pdftoppm)
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Browser} from './cdp.mjs';
import {VectorRenderer} from '../src/renderer.js';
import {compileCard} from '../src/postscript.js';
import {defaults} from '../src/model.js';

const renderer=await VectorRenderer.create(await readFile('public/engine/pscat.wasm'));
const sources={common:await readFile('templates/common.ps','utf8'),card:await readFile('templates/business-card.ps','utf8')};
const card={kind:'business-card',name:'Alex Morgan',role:'Owner & host',email:'hello@example.com',phone:'(415) 555-0128',website:'example.com',address:'42 Orchard Street'};
const cases=[
  ['short-url','https://example.com','olive'],
  ['menu-url','https://example.com/menus/autumn-2026?table=12','wine'],
  ['wifi','WIFI:T:WPA;S:Olive Room;P:correct horse battery;;','teal'],
  ['text-120','The Olive Room, 42 Orchard Street. Open Tuesday to Sunday, 5 pm to 11 pm. Book at example.com or call (415) 555-0128!','ink'],
  ['max-200','https://example.com/'+'a1b2c3d4e5'.repeat(18),'olive'],
];
await mkdir('artifacts/qr',{recursive:true});
const dir=path.resolve('artifacts/qr');
const jobs=[];
for(const [name,qr,palette] of cases){
  const r=renderer.render(compileCard({...card,qr},{...defaults,palette},sources));
  const info=/PSQR (\d+) \/?([LMQH]) ([\d.]+) (\d+)/.exec(r.output);
  await writeFile(`${dir}/${name}.svg`,r.svgs[1]);await writeFile(`${dir}/${name}-front.svg`,r.svgs[0]);await writeFile(`${dir}/${name}.pdf`,r.pdf);
  execFileSync('pdftoppm',['-r','300','-png','-f','2','-l','2','-singlefile',`${dir}/${name}.pdf`,`${dir}/${name}-pdf`]);
  jobs.push({name,qr,palette,version:Number(info[1]),level:info[2],modulePt:Number(info[3])});
}
const page=`<!doctype html><meta charset="utf-8"><body><script>
const load=src=>new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>bad(Error('cannot load '+src));i.src=src;});
const detector=new BarcodeDetector({formats:['qr_code']});
const read=async source=>(await detector.detect(source)).map(c=>c.rawValue);
window.check=async jobs=>{const out=[];for(const j of jobs){
  // SVG through the app's PNG-export path: 270 x 162 pt at 300/72.
  const svg=await load(j.name+'.svg');const canvas=document.createElement('canvas');canvas.width=1125;canvas.height=675;
  canvas.getContext('2d').drawImage(svg,0,0,1125,675);
  const fromSvg=await read(canvas);
  const png=await load(URL.createObjectURL(await new Promise(r=>canvas.toBlob(r,'image/png'))));
  const fromPng=await read(png);
  const fromPdf=await read(await load(j.name+'-pdf.png'));
  // Control: the front has no symbol, so the decoder must find nothing there.
  const front=await load(j.name+'-front.svg');canvas.getContext('2d').drawImage(front,0,0,1125,675);
  out.push({...j,svg:fromSvg,png:fromPng,pdf:fromPdf,front:await read(canvas)});}
  return JSON.stringify(out);};
document.title='ready';
</script>`;
await writeFile(`${dir}/check.html`,page);
const profile=await mkdtemp(path.join(os.tmpdir(),'printshop-qr-'));
const browser=new Browser(['--headless','--no-first-run','--allow-file-access-from-files',`--user-data-dir=${profile}`,'about:blank']);
let results;
try{
  const {targetId}=await browser.send('Target.createTarget',{url:pathToFileURL(`${dir}/check.html`).href});
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
  for(let i=0;i<40;i++){const t=await browser.send('Runtime.evaluate',{expression:'document.title',returnByValue:true},sessionId);if(t.result.value==='ready')break;await new Promise(r=>setTimeout(r,250));}
  const r=await browser.send('Runtime.evaluate',{expression:`check(${JSON.stringify(jobs)})`,awaitPromise:true,returnByValue:true},sessionId);
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  results=JSON.parse(r.result.value);
}finally{await browser.close();await rm(profile,{recursive:true,force:true}).catch(()=>{});}
let failed=0;
for(const r of results){
  const ok=['svg','pdf','png'].every(k=>r[k].length===1&&r[k][0]===r.qr)&&r.front.length===0;if(!ok)failed++;
  console.log(`${ok?'PASS':'FAIL'} ${r.name}: v${r.version} ${r.level}, ${r.modulePt} pt modules, ${r.qr.length} bytes, ${r.palette}`+(ok?'':`\n  front ${JSON.stringify(r.front)}\n  svg ${JSON.stringify(r.svg)}\n  pdf ${JSON.stringify(r.pdf)}\n  png ${JSON.stringify(r.png)}`));
}
await writeFile('artifacts/qr/report.json',JSON.stringify(results,null,2)+'\n');
if(failed)process.exitCode=1;
