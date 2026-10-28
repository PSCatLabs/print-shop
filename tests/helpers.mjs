import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {VectorRenderer} from '../src/renderer.js';
import {importMenu} from '../src/csv.js';
import {defaults} from '../src/model.js';
import {compileMenu} from '../src/postscript.js';
export const sample=await readFile(new URL('../public/example-menu.csv',import.meta.url),'utf8');
export const menu=importMenu(sample);
export const common=await readFile(new URL('../templates/common.ps',import.meta.url),'utf8');
export async function sources(id='classic-bistro') {return {common,template:await readFile(new URL(`../templates/${id}.ps`,import.meta.url),'utf8')};}
export const renderer=await VectorRenderer.create(await readFile(new URL('../public/engine/pscat.wasm',import.meta.url)));
export async function render(menuData=menu,params={}) {
  const p={...defaults,...params};const job=compileMenu(menuData,p,await sources(p.template));
  return renderer.render(job);
}
export function makeMenu(n,description='Garden vegetables, fresh herbs and a bright lemon dressing') {
  return {kind:'menu',categories:Array.from({length:Math.ceil(n/10)},(_,c)=>({name:`Chapter ${c+1}`,items:Array.from({length:Math.min(10,n-c*10)},(_,i)=>({name:`Seasonal plate ${c*10+i+1}`,description,price:'18.50',dietary:'Vegetarian',variations:i%3===0?'Add sourdough +3':''}))}))};
}
export async function saveArtifact(name,result) {
  await mkdir('artifacts',{recursive:true});
  await writeFile(`artifacts/${name}.pdf`,result.pdf);
  for(const [index,svg] of result.svgs.entries())await writeFile(`artifacts/${name}-${index+1}.svg`,svg);
}
