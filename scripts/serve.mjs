// Static server for development and the served browser checks.
//   node scripts/serve.mjs                       # the source tree at /
//   node scripts/serve.mjs --dist                # the build in dist/
//   node scripts/serve.mjs --dist --base /print-shop/
// --base serves everything under a path prefix, as GitHub Pages does for a
// project site, and 404s any request outside it, so a root-absolute URL in the
// app fails here exactly as it would on Pages.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const dist=process.argv.includes('--dist');
const root=path.resolve(dist?'dist':'.');
const baseArg=process.argv.includes('--base')?process.argv[process.argv.indexOf('--base')+1]:'/';
const base=('/'+baseArg+'/').replace(/\/+/g,'/');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.ps':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json','.md':'text/markdown; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(pathname+'/'===base){res.writeHead(301,{Location:base});res.end();return;}
    if(!pathname.startsWith(base))throw Error('outside base');
    pathname='/'+pathname.slice(base.length);
    // The source tree has no offline edition; serve the last build's copy in dev.
    const from=!dist&&pathname==='/printshop-offline.html'?path.resolve('dist'):root;
    const file=path.resolve(from,'.'+(pathname==='/'?'/index.html':pathname));
    const relative=path.relative(from,file);
    if(relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(p=>p.startsWith('.')) || !(await stat(file)).isFile()) throw Error('not found');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  } catch { res.writeHead(404);res.end('Not found'); }
});
server.listen(Number(process.env.PORT||5173),'127.0.0.1',()=>console.log(`Printshop: http://127.0.0.1:${server.address().port}${base}`));
