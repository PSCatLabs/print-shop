// Real-browser acceptance: drives headless Chrome over the DevTools protocol
// (pipe transport, no debugging port, no npm dependencies).
//
// For each configuration it loads the page, waits for the first real render,
// takes screenshots, checks horizontal fit, then reloads with ?browser-test
// and waits for the in-page suite (src/browser-tests.js) to report. Page or
// worker exceptions and console errors fail the run. File editions also fail
// on any request that is not file:, blob: or data:, and run behind a dead
// proxy so a network request could not succeed anyway.
//
//   npm run build && npm run test:browser            # every configuration
//   npm run test:browser -- --only offline-mobile    # one configuration
//   CHROME_BIN=/path/to/chrome npm run test:browser
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const chrome=process.env.CHROME_BIN||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'chromium');
const desktop={width:1440,height:900,deviceScaleFactor:1,mobile:false};
const mobile={width:390,height:844,deviceScaleFactor:3,mobile:true,
  userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36'};
const offlineUrl=pathToFileURL(path.resolve('dist/printshop-offline.html')).href;
const configs=[
  {name:'offline-desktop',edition:'offline',viewport:desktop},
  {name:'offline-mobile',edition:'offline',viewport:mobile},
  {name:'served-desktop',edition:'served',viewport:desktop},
  {name:'served-mobile',edition:'served',viewport:mobile},
];
const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1]:null;
const SUITE_TIMEOUT=180000,RENDER_TIMEOUT=60000,COMMAND_TIMEOUT=30000;

class Browser {
  constructor(args){
    this.child=spawn(chrome,args,{stdio:['ignore','ignore','pipe','pipe','pipe']});
    this.stderr='';this.child.stderr.on('data',c=>this.stderr+=c);
    this.id=0;this.pending=new Map();this.listeners=new Set();let buffer=Buffer.alloc(0);
    this.child.stdio[4].on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);let end;
      while((end=buffer.indexOf(0))>=0){
        const message=JSON.parse(buffer.subarray(0,end).toString('utf8'));buffer=buffer.subarray(end+1);
        if(message.id&&this.pending.has(message.id)){const {resolve,reject}=this.pending.get(message.id);this.pending.delete(message.id);
          message.error?reject(Error(message.error.message)):resolve(message.result);}
        else for(const listener of this.listeners)listener(message);
      }
    });
    // A crashed or missing browser must fail the run, never leave it waiting.
    this.dead=null;
    const fail=error=>{this.dead??=error;for(const {reject} of this.pending.values())reject(this.dead);this.pending.clear();};
    this.exited=new Promise(resolve=>this.child.on('close',(code,signal)=>{fail(Error(`Chrome exited (code ${code}, signal ${signal||'none'})`));resolve();}));
    this.child.on('error',fail);
    this.child.stdio[3].on('error',fail);
  }
  send(method,params={},sessionId){
    if(this.dead)return Promise.reject(this.dead);
    const id=++this.id;const message={id,method,params};if(sessionId)message.sessionId=sessionId;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`${method} timed out after ${COMMAND_TIMEOUT} ms`));},COMMAND_TIMEOUT);
      const settle=fn=>value=>{clearTimeout(timer);fn(value);};
      this.pending.set(id,{resolve:settle(resolve),reject:settle(reject)});
      this.child.stdio[3].write(JSON.stringify(message)+'\0');
    });
  }
  close(){this.child.kill('SIGKILL');return this.exited;}
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function evaluate(browser,session,expression){
  const result=await browser.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);
  if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(browser,session,expression,timeout,label){
  const start=Date.now();
  while(Date.now()-start<timeout){
    if(browser.dead)throw browser.dead;
    try{const value=await evaluate(browser,session,expression);if(value)return value;}catch{}
    await sleep(250);
  }
  throw Error(`Timed out waiting for ${label}`);
}
async function startServer(){
  const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
  const base=await new Promise((resolve,reject)=>{let out='';
    server.stdout.on('data',c=>{out+=c;const m=/http:\/\/127\.0\.0\.1:\d+/.exec(out);if(m)resolve(m[0]+'/');});
    server.on('exit',code=>reject(Error('Static server exited with '+code)));});
  return {server,base};
}

async function runConfig(config,version){
  const profile=await mkdtemp(path.join(os.tmpdir(),'printshop-browser-'));
  let server,base=offlineUrl;
  if(config.edition==='served')({server,base}=await startServer());
  const args=['--headless','--remote-debugging-pipe','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,
    '--disable-background-networking','--disable-extensions','--disable-component-update','about:blank'];
  if(config.edition==='offline')args.splice(1,0,'--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=<-loopback>');
  const browser=new Browser(args);
  const problems=[],requests=[];
  browser.listeners.add(message=>{
    const {method,params}=message;
    if(method==='Runtime.exceptionThrown')problems.push('exception: '+(params.exceptionDetails.exception?.description||params.exceptionDetails.text));
    if(method==='Runtime.consoleAPICalled'&&params.type==='error')problems.push('console.error: '+params.args.map(a=>a.value??a.description).join(' '));
    if(method==='Log.entryAdded'&&params.entry.level==='error')problems.push(`log: ${params.entry.text} ${params.entry.url||''}`.trim());
    if(method==='Network.requestWillBeSent')requests.push(params.request.url);
    if(method==='Target.attachedToTarget'){
      // Workers: watch their exceptions and requests too, then let them start.
      const s=params.sessionId;
      Promise.allSettled([browser.send('Runtime.enable',{},s),browser.send('Network.enable',{},s)])
        .then(()=>browser.send('Runtime.runIfWaitingForDebugger',{},s)).catch(()=>{});
    }
  });
  try{
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
    const {sessionId:session}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
    await Promise.all(['Page.enable','Runtime.enable','Network.enable','Log.enable'].map(m=>browser.send(m,{},session)));
    await browser.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
    const {userAgent,...metrics}=config.viewport;
    await browser.send('Emulation.setDeviceMetricsOverride',metrics,session);
    if(userAgent)await browser.send('Emulation.setUserAgentOverride',{userAgent},session);

    // 1. Ordinary page load: first real render, screenshots, horizontal fit.
    await browser.send('Page.navigate',{url:base},session);
    await waitFor(browser,session,"document.documentElement.dataset.renderState==='complete'&&document.getElementById('preview').complete",RENDER_TIMEOUT,'first render');
    const fit=await evaluate(browser,session,'({scrollWidth:document.documentElement.scrollWidth,innerWidth})');
    const shot=await browser.send('Page.captureScreenshot',{format:'png'},session);
    await writeFile(`artifacts/browser-${config.name}.png`,Buffer.from(shot.data,'base64'));
    const full=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},session);
    await writeFile(`artifacts/browser-${config.name}-full.png`,Buffer.from(full.data,'base64'));
    if(fit.scrollWidth>fit.innerWidth+1)problems.push(`horizontal overflow: ${fit.scrollWidth} > ${fit.innerWidth}`);

    // 2. The in-page acceptance suite.
    await browser.send('Page.navigate',{url:base+'?browser-test'},session);
    await waitFor(browser,session,"['passed','failed'].includes(document.documentElement.dataset.browserTests)&&!!document.getElementById('browser-test-report')",SUITE_TIMEOUT,'browser suite');
    const suite=JSON.parse(await evaluate(browser,session,"document.getElementById('browser-test-report').textContent"));
    const foreign=config.edition==='offline'?[...new Set(requests.filter(u=>!/^(file|blob|data):/.test(u)))]:[];
    if(foreign.length)problems.push('network requests from the file edition: '+foreign.join(', '));
    return {configuration:config.name,edition:config.edition,url:base,browser:version,date:new Date().toISOString(),
      viewport:{width:metrics.width,height:metrics.height,deviceScaleFactor:metrics.deviceScaleFactor,mobile:metrics.mobile},
      horizontalFit:fit,requestCount:requests.length,nonBlobRequests:[...new Set(requests.filter(u=>!u.startsWith('blob:')).map(u=>u.replace(/^http:\/\/127\.0\.0\.1:\d+/,'')))].sort(),requestSchemes:[...new Set(requests.map(u=>u.split(':')[0]))].sort(),
      suite,problems,state:suite.state==='passed'&&problems.length===0?'passed':'failed'};
  }finally{
    await browser.close();server?.kill();
    await rm(profile,{recursive:true,force:true}).catch(()=>{});
    await writeFile(`artifacts/browser-${config.name}.log`,browser.stderr);
  }
}

await mkdir('artifacts',{recursive:true});
const version=await new Promise(resolve=>{const c=spawn(chrome,['--version']);let o='';
  c.stdout.on('data',d=>o+=d);c.on('close',()=>resolve(o.trim()||'unknown'));c.on('error',()=>resolve('unknown'));});
const reports=[];
// Reports are committed as evidence: keep the checkout's absolute path out of them.
const portable=value=>JSON.stringify(value,null,2).replaceAll(pathToFileURL(process.cwd()).href,'file://.')+'\n';
for(const config of configs.filter(c=>!only||c.name===only)){
  let report;
  try{report=await runConfig(config,version);}
  catch(error){report={configuration:config.name,browser:version,state:'failed',problems:[error.message]};}
  reports.push(report);
  await writeFile(`artifacts/browser-${config.name}.json`,portable(report));
  const failed=(report.suite?.checks||[]).filter(c=>c.startsWith('FAIL'));
  console.log(`${report.state==='passed'?'PASS':'FAIL'} ${config.name}: ${(report.suite?.checks||[]).length-failed.length} checks passed`
    +[...report.problems,...failed].map(p=>'\n  '+p).join(''));
}
await writeFile('artifacts/browser-report.json',portable(reports));
if(!reports.length||reports.some(r=>r.state!=='passed'))process.exitCode=1;
