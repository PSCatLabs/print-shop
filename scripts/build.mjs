import {cp,mkdir,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('public/engine/provenance.json','utf8'));
const hash=createHash('sha256').update(await readFile('public/engine/pscat.wasm')).digest('hex');
if(hash!==manifest.wasmSha256) throw Error('WASM provenance mismatch. Rebuild the engine.');
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','styles.css','src','templates','public']) await cp(file,'dist/'+file,{recursive:true});
await import('./build-offline.mjs');
console.log('Static application built in dist/; engine hash verified.');
