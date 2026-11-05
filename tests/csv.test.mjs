import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importMenu,parseCSV} from '../src/csv.js';
import {validateMenu,validateParameters,defaults,normalizeText} from '../src/model.js';
import {psString,compileCard} from '../src/postscript.js';

test('quoted commas, multiline cells, escaped quotes, BOM and CRLF',()=>{
  const data='\uFEFFCategory,Item name,Description,Price\r\nStarters,"Soup, today","Fresh\r\nwith ""cream""",$9.50\r\n';
  const menu=importMenu(data);assert.equal(menu.categories[0].items[0].name,'Soup, today');
  assert.equal(menu.categories[0].items[0].description,'Fresh\nwith "cream"');
});
test('sample imports all rows and stable category order',async()=>{
  const menu=importMenu(await readFile('public/example-menu.csv','utf8'));
  assert.equal(menu.categories.length,4);assert.equal(menu.categories.flatMap(c=>c.items).length,14);
  assert.equal(menu.categories[0].items[3].description.includes('crème'),true);
});
test('validation reports empty, malformed, missing, duplicate and ragged data',()=>{
  for(const csv of ['', 'Category,Item name,Price\nA,"unclosed,3','Name,Price\nSoup,3','Category,Name,Price,Name\nA,B,3,C','Category,Name,Price\nA,B,3,extra','Category,Name,Price\nA,,3','Category,Name,Price\nA,B,-1','Category,Name,Price\nA,B,abc','Category,Name,Price\nA,B,"3"junk'])assert.throws(()=>importMenu(csv));
  assert.throws(()=>validateMenu({kind:'menu',categories:[]}),/empty/);
  assert.throws(()=>validateMenu({kind:'menu',categories:[null]}),/object/);
});
test('no policy caps: a CSV over 512 KB with 3,000 items and long fields imports',()=>{
  const long='Slow-roasted garden vegetables with herbs, farmhouse cheese and toasted almonds. '.repeat(3);
  const rows=['Category,Item name,Description,Price,Dietary,Variations'];
  for(let i=0;i<3000;i++)rows.push(`Section ${Math.floor(i/25)+1},"${'Seasonal plate '.repeat(10)}${i}","${long}",18.50,"${'Vegetarian '.repeat(12)}","${'Add sourdough +3; '.repeat(16)}"`);
  const csv=rows.join('\n');assert.ok(csv.length>512*1024);
  const menu=importMenu(csv);assert.equal(menu.categories.flatMap(c=>c.items).length,3000);
  validateParameters({...defaults,businessName:'B'.repeat(200),subtitle:'S'.repeat(400)});
  assert.equal(importMenu('Category,Name,Price\nA,B,$1234567.50').categories[0].items[0].price,'$1234567.50');
});
test('normalizes common typography; rejects unsupported scripts',()=>{
  assert.equal(normalizeText('  chef’s – “special”…  '),'chef\'s - "special"...');
  assert.throws(()=>importMenu('Category,Name,Price\nMain,김치,8'),/Latin-1/);
});
test('parameters reject injection, invalid enum, nonnumeric columns and empty name',()=>{
  validateParameters(defaults);
  for(const patch of [{columns:0},{columns:'2'},{template:'evil'},{palette:'[1] exec'},{ornaments:'true'},{businessName:''},{subtitle:'😀'},{density:NaN}])assert.throws(()=>validateParameters({...defaults,...patch}));
  assert.equal(psString('Café (special) \\'),'(Caf\\351 \\(special\\) \\\\)');
});
test('CSV keeps repeated categories together without reordering items',()=>{
  const menu=importMenu('Category,Name,Price\nA,one,1\nB,two,2\nA,three,3');
  assert.deepEqual(menu.categories.map(c=>[c.name,c.items.map(i=>i.name)]),[['A',['one','three']],['B',['two']]]);
});
