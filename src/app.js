import { defaults, normalizeText, validateParameters } from './model.js';
import { importMenu } from './csv.js';
import { compileMenu, compileCard } from './postscript.js';
import { preflightPrint } from './preflight.js';
import { readText, createRenderWorker } from './assets.js';

const $=id=>document.getElementById(id);
let menu, mode='menu', template=defaults.template, result, currentPage=0, previewURL;
let worker, timeout, debounce, generation=0, sources;
const exportButtons=['export-svg','export-pdf','export-png'];
function status(message,error=false,state=error?'error':'complete') {
  $('status').textContent=message;$('status').classList.toggle('error',error);
  document.documentElement.dataset.renderState=state;
}
function disableExports(){exportButtons.forEach(id=>$(id).disabled=true);}
function invalidate(){clearTimeout(timeout);worker?.terminate();generation++;disableExports();}
function parameters(){
  return {template,businessName:normalizeText($('business-name').value),subtitle:normalizeText($('subtitle').value),
    palette:$('palette').value,typography:$('typography').value,pageSize:$('page-size').value,
    columns:Number($('columns').value),density:$('density').value,ornaments:$('ornaments').checked};
}
function card(){return {kind:'business-card',...Object.fromEntries(['name','role','email','phone','website','address','qr'].map(key=>[key,normalizeText($('card-'+key).value)]))};}
function displayPage(){
  if (!result) return;
  if(previewURL)URL.revokeObjectURL(previewURL);
  previewURL=URL.createObjectURL(new Blob([result.svgs[currentPage]],{type:'image/svg+xml'}));
  $('preview').src=previewURL;$('preview').hidden=false;$('placeholder').hidden=true;
  $('page-number').textContent=mode==='business-card'?(currentPage===0?'Front · 1 / 2':'Back · 2 / 2'):`${currentPage+1} / ${result.svgs.length}`;
  $('previous').disabled=currentPage===0;$('next').disabled=currentPage===result.svgs.length-1;
}
function updatePalette(){
  const colors={olive:['#303b29','#616e40','#faf7ed'],ink:['#1f2630','#3d4f66','#fafaf7'],wine:['#451f26','#85333b','#fcf5eb'],teal:['#0f3d40','#0f6669','#fcf5e0']}[$('palette').value];
  for(const [i,key] of ['ink','accent','paper'].entries())$('palette-chips').style.setProperty('--chip-'+key,colors[i]);
}
async function render(){
  invalidate();clearTimeout(debounce);
  if(!sources || !menu)return;
  const id=generation;
  try {
    const params=parameters();validateParameters(params);updatePalette();
    const document=mode==='menu'?menu:card();
    const job=mode==='menu'?compileMenu(menu,params,{common:sources.common,template:sources[template]}):compileCard(document,params,sources);
    $('page-label').textContent=mode==='business-card'?'3.5 × 2 IN TRIM / ⅛ IN BLEED':params.pageSize==='a4'?'A4 / 210 × 297 MM':'US LETTER / 8.5 × 11 IN';
    status('Setting the type… Previous preview remains until this edition is ready.',false,'running');
    worker=createRenderWorker();
    timeout=setTimeout(()=>{if(id===generation){invalidate();status('Rendering took too long. Try fewer items or a simpler layout. The previous preview is out of date.',true);}},20000);
    worker.onerror=event=>{if(id===generation){invalidate();status('Rendering failed: '+(event.message||'the rendering worker could not load')+'. The previous preview is out of date.',true);}};
    worker.onmessage=({data})=>{
      if(data.id!==generation)return;
      clearTimeout(timeout);worker.terminate();
      if(data.error){status('Could not compose this layout. '+friendlyError(data.error)+' The previous preview is out of date.',true);return;}
      result=data.result;currentPage=0;displayPage();
      const preflight=preflightPrint(document,params,result);
      $('preflight-results').replaceChildren(...preflight.findings.map(finding=>{
        const li=documentElement('li',finding.message);li.dataset.severity=finding.severity;return li;
      }));
      if(preflight.readyForReview)exportButtons.forEach(key=>$(key).disabled=false);
      const count=menu.categories.reduce((n,c)=>n+c.items.length,0);
      status(`Ready · ${mode==='menu'?count+' items · ':''}${result.svgs.length} ${result.svgs.length===1?'page':'pages'} · vector type & geometry`,!preflight.readyForReview);
    };
    worker.postMessage({id,job,wasm:globalThis.PRINTSHOP_OFFLINE?.wasm});
  }catch(error){status(error.message+' The previous preview is out of date.',true);}
}
function documentElement(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
function friendlyError(message){
  const errors={
    'printshop-word-too-wide':'A word is wider than its text area. Shorten it or choose one column.',
    'printshop-price-too-wide':'A price is too wide. Shorten it or choose one column.',
    'printshop-item-too-tall':'One item cannot fit in a column. Shorten its description or use one column.',
    'printshop-title-too-wide':'The business name is too wide. Shorten it.',
    'printshop-subtitle-too-long':'The subtitle needs more than two lines. Shorten it.',
    'printshop-card-overflow':'The contact details exceed the safe area. Shorten them.',
    'printshop-card-name-too-wide':'The name exceeds the card’s safe area. Shorten it.',
    'printshop-qr-too-dense':'The QR link is too long to print at a scannable size on the card. Use a shorter link.',
    'printshop-too-many-pages':'The document exceeds 40 pages. Reduce the number of items.',
    'printshop-font-substituted':'A template font is not available in this engine, so it would be substituted. Report this template.',
  };
  return Object.entries(errors).find(([key])=>message.includes(key))?.[1]||message;
}
function applyCSV(text){
  try {
    const parsed=importMenu(text);menu=parsed;$('csv-editor').value=text;
    $('item-summary').textContent=`${menu.categories.reduce((n,c)=>n+c.items.length,0)} items across ${menu.categories.length} categories · loaded`;
    render();
  }catch(error){invalidate();status('CSV could not be imported. '+error.message+' The previous menu remains loaded.',true);}
}
async function loadFile(file){
  if(!file)return;
  if(file.size>512*1024){invalidate();status('CSV must be smaller than 512 KB.',true);return;}
  try {applyCSV(await file.text());}catch(error){invalidate();status('The file could not be read: '+error.message,true);}
}
function download(data,type,name){
  const url=URL.createObjectURL(new Blob([data],{type}));
  const link=documentElement('a','');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function filename(ext){return `printshop-${mode}${ext==='pdf'?'':`-${String(currentPage+1).padStart(2,'0')}`}.${ext}`;}
$('export-svg').onclick=()=>download(result.svgs[currentPage],'image/svg+xml',filename('svg'));
$('export-pdf').onclick=()=>download(result.pdf,'application/pdf',filename('pdf'));
$('export-png').onclick=async()=>{
  const svg=result.svgs[currentPage],width=result.width,height=result.height,name=filename('png');
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try {
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=Math.round(width*300/72);canvas.height=Math.round(height*300/72);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('PNG encoder returned no image.');
    download(blob,'image/png',name);
  }catch(error){status('PNG export failed: '+error.message,true);}
  finally{URL.revokeObjectURL(url);}
};
$('previous').onclick=()=>{currentPage--;displayPage();};$('next').onclick=()=>{currentPage++;displayPage();};
$('controls').addEventListener('submit',event=>event.preventDefault());
$('controls').addEventListener('input',()=>{invalidate();status('Updating the composition…',false,'running');clearTimeout(debounce);debounce=setTimeout(render,180);});
$('apply-csv').onclick=()=>applyCSV($('csv-editor').value);
$('upload').onchange=()=>loadFile($('upload').files[0]);
const drop=document.querySelector('.upload');
drop.ondragover=event=>{event.preventDefault();drop.classList.add('dragging');};
drop.ondragleave=()=>drop.classList.remove('dragging');
drop.ondrop=event=>{event.preventDefault();drop.classList.remove('dragging');loadFile(event.dataTransfer.files[0]);};
async function sample(){
  invalidate();status('Loading the example menu…',false,'running');
  try{applyCSV(await readText('public/example-menu.csv'));}catch(error){status(error.message,true);}
}
$('sample').onclick=sample;
document.querySelectorAll('[data-template]').forEach(button=>button.onclick=()=>{
  template=button.dataset.template;
  document.querySelectorAll('[data-template]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();
});
function switchMode(next){
  mode=next;
  const isMenu=mode==='menu';$('menu-mode').setAttribute('aria-pressed',String(isMenu));$('card-mode').setAttribute('aria-pressed',String(!isMenu));
  for(const id of ['menu-import','menu-layout','template-picker'])$(id).hidden=!isMenu;
  $('card-fields').hidden=isMenu;$('preview-stage').classList.toggle('card-preview',!isMenu);
  $('document-title').textContent=isMenu?'Your menu, beautifully set.':'A proper introduction.';render();
}
$('menu-mode').onclick=()=>switchMode('menu');$('card-mode').onclick=()=>switchMode('business-card');
try {
  const names=['common','classic-bistro','modernist','retro-diner','business-card'];
  const loaded=await Promise.all(names.map(async name=>[name==='business-card'?'card':name,await readText(`templates/${name}.ps`)]));
  sources=Object.fromEntries(loaded);await sample();
}catch(error){status('Could not initialize Printshop: '+error.message,true);}
if(new URLSearchParams(location.search).has('browser-test'))import('./browser-tests.js');
