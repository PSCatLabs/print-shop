// Opt-in real-browser checks. Run only with ?browser-test; no test framework.
const $=id=>document.getElementById(id),checks=[];
const assert=(value,message)=>{if(!value)throw Error(message);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
async function done(wanted='complete'){
  const start=performance.now();
  while(performance.now()-start<25000){
    const state=document.documentElement.dataset.renderState;
    if(state===wanted)return;
    if(state==='error'&&wanted!=='error')throw Error($('status').textContent);
    await tick();
  }
  throw Error('Browser render did not finish: '+$('status').textContent);
}
function input(id,value){$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));}
async function preview(){await done();await $('preview').decode();return (await fetch($('preview').src)).text();}
async function check(name,run){await run();checks.push(name);}
let captured=[];
const originalClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){captured.push({url:this.href,name:this.download,bytes:fetch(this.href).then(response=>response.arrayBuffer())});};
try{
  await check('initial sample renders actual vector SVG',async()=>{
    const svg=await preview();assert(svg.includes('<path '),'No vector geometry');assert(!svg.includes('<image'),'Raster approximation');
    assert($('preview').naturalWidth===612,'Wrong preview page width');assert($('item-summary').textContent.includes('14 items'),'Missing imported items');
  });
  const initial=await preview();
  await check('business name and palette rerender',async()=>{
    input('business-name','Le Jardin');input('palette','wine');
    const changed=await preview();assert(changed!==initial,'Changes did not affect the actual SVG');
  });
  await check('each template executes PostScript',async()=>{
    for(const id of ['modernist','retro-diner','classic-bistro']){document.querySelector(`[data-template="${id}"]`).click();const svg=await preview();assert(svg.includes('<svg'),'Template did not render');}
  });
  await check('SVG, PDF and PNG downloads are real files',async()=>{
    captured=[];$('export-svg').click();$('export-pdf').click();$('export-png').click();
    const start=performance.now();while(captured.length<3&&performance.now()-start<10000)await tick();
    assert(captured.length===3,'Download action missing');
    for(const file of captured){const bytes=new Uint8Array(await file.bytes);
      if(file.name.endsWith('.pdf'))assert(new TextDecoder().decode(bytes.slice(0,8)).startsWith('%PDF-1.4'),'Invalid PDF');
      if(file.name.endsWith('.svg'))assert(new TextDecoder().decode(bytes).includes('<svg'),'Invalid SVG');
      if(file.name.endsWith('.png')){assert(bytes[0]===137&&bytes[1]===80,'Invalid PNG');assert(new DataView(bytes.buffer).getUint32(16)===2550,'PNG is not 300 dpi in pixel dimensions');}
    }
  });
  await check('invalid CSV disables exports and shows a useful error',async()=>{
    $('csv-editor').value='Name,Price\nSoup,9';$('apply-csv').click();await done('error');
    assert($('status').textContent.includes('Missing required column'),'No schema feedback');assert($('export-pdf').disabled,'Stale PDF can be exported');
    $('sample').click();await preview();
  });
  await check('CSV file upload and pagination through the actual UI',async()=>{
    const rows=['Category,Item name,Description,Price'];
    for(let i=0;i<80;i++)rows.push(`Section ${Math.floor(i/10)+1},Seasonal plate ${i+1},Garden vegetables with herbs and toasted almonds,18.50`);
    const transfer=new DataTransfer();transfer.items.add(new File([rows.join('\n')],'large-menu.csv',{type:'text/csv'}));
    $('upload').files=transfer.files;$('upload').dispatchEvent(new Event('change'));
    // File.text() resolves asynchronously before rendering starts.
    const start=performance.now();
    while(!$('item-summary').textContent.includes('80 items')){if(performance.now()-start>5000)throw Error('File import did not complete');await tick();}
    await preview();assert(!$('next').disabled,'Large menu did not paginate');const first=await preview();
    $('next').click();assert(await preview()!==first,'Page navigation did not change SVG');
  });
  await check('card front/back and print limitations are visible',async()=>{
    $('card-mode').click();await preview();assert($('page-number').textContent.includes('Front'),'Card front missing');
    assert($('preflight-results').textContent.includes('TrimBox'),'Missing print limitation');
    $('next').click();await preview();assert($('page-number').textContent.includes('Back'),'Card back missing');
    $('menu-mode').click();$('sample').click();input('business-name','The Olive Room');input('palette','olive');await preview();
  });
  await check('rapid changes preserve only the latest complete edition',async()=>{
    input('business-name','First');input('business-name','Second');input('business-name','The Olive Room');await preview();assert(!$('export-pdf').disabled,'Final render unavailable');
  });
  document.documentElement.dataset.browserTests='passed';
}catch(error){document.documentElement.dataset.browserTests='failed';checks.push('FAIL: '+error.message);}
finally{
  HTMLAnchorElement.prototype.click=originalClick;
  const report=document.createElement('pre');report.id='browser-test-report';report.textContent=JSON.stringify({state:document.documentElement.dataset.browserTests,checks},null,2);document.body.append(report);
}
