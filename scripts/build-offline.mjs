// Bundle unchanged ES modules as Blob URLs; this is packaging, never a renderer.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const modules={};
for(const name of await readdir('src'))if(name.endsWith('.js'))modules['src/'+name]=await readFile('src/'+name,'utf8');
modules['public/engine/pscat.js']=await readFile('public/engine/pscat.js','utf8');
const text={};
for(const name of await readdir('templates'))if(name.endsWith('.ps'))text['templates/'+name]=await readFile('templates/'+name,'utf8');
for(const file of ['public/example-menu.csv','public/licenses/THIRD_PARTY_NOTICES.md','public/licenses/wasm-dependency-licenses.html'])text[file]=await readFile(file,'utf8');
const compressed=gzipSync(await readFile('public/engine/pscat.wasm'),{level:9}).toString('base64');
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
// Package the file:// worker as one classic script. Module-worker loading
// rejects opaque file origins in Chrome. The served edition keeps ES modules.
const workerSource=[modules['public/engine/pscat.js'],
  modules['src/renderer.js'].replace("import { Pscat } from '../public/engine/pscat.js';",''),
  modules['src/render-worker.js'].replace("import { VectorRenderer } from './renderer.js';",'')].join('\n')
  .replace(/^export class /gm,'class ').replaceAll('import.meta.url','self.location.href');
const bootstrap=`
const modules=${json(modules)}, text=${json(text)}, cache=new Map();
const packed=Uint8Array.from(atob(${json(compressed)}),c=>c.charCodeAt(0));
const wasm=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
function moduleURL(file){
  if(cache.has(file))return cache.get(file);
  let code=modules[file];if(code===undefined)throw Error('Missing bundled module: '+file);
  const resolve=ref=>moduleURL(new URL(ref,'https://printshop.local/'+file).pathname.slice(1));
  code=code.replace(/\\bfrom\\s*(['"])(\\.[^'"]+)\\1/g,(_,q,ref)=>'from '+q+resolve(ref)+q)
    .replace(/\\bimport\\s*(['"])(\\.[^'"]+)\\1/g,(_,q,ref)=>'import '+q+resolve(ref)+q)
    .replace(/\\bimport\\((['"])(\\.[^'"]+\\.js)\\1\\)/g,(_,q,ref)=>'import('+q+resolve(ref)+q+')');
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));cache.set(file,url);return url;
}
const workerURL=URL.createObjectURL(new Blob([${json(workerSource)}],{type:'text/javascript'}));
globalThis.PRINTSHOP_OFFLINE={text,wasm,workerURL,workerType:'classic'};
for(const a of document.querySelectorAll('a[href]')){
  const file=a.getAttribute('href').replace(/^\\.?\\//,'');
  if(file==='') {a.href='#';continue;}
  if(text[file]!==undefined)a.href=URL.createObjectURL(new Blob([text[file]],{type:file.endsWith('.csv')?'text/csv':file.endsWith('.html')?'text/html':'text/plain'}));
}
await import(moduleURL('src/app.js'));
`;
let html=await readFile('index.html','utf8');
const css=await readFile('styles.css','utf8');
// Exact replacements: fail the build rather than ship a file that still points
// at a server. The offline file is itself the offline edition, so it drops the
// served page's link to download it.
const replace=(from,to)=>{if(!html.includes(from))throw Error('index.html no longer contains '+from);html=html.replace(from,to);};
replace('<link rel="stylesheet" href="styles.css">',()=>`<style>${css}</style>`);
replace('<script type="module" src="src/app.js"></script>',()=>`<script type="module">${bootstrap}</script>`);
html=html.replace(/<small id="offline-edition">[\s\S]*?<\/small>/,()=>'');
if(html.includes('printshop-offline.html'))throw Error('The offline edition must not link to itself.');
await mkdir('dist',{recursive:true});await writeFile('dist/printshop-offline.html',html);
console.log('Offline edition: dist/printshop-offline.html (no server or network required).');
