import {cp,mkdir,rm} from 'node:fs/promises';
import {ensureEngine} from './fetch-engine.mjs';
// Installs the pinned pscat release if it is not already present, and fails
// unless every engine file matches its hash in public/engine/provenance.json.
await ensureEngine();
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','styles.css','src','templates','public']) await cp(file,'dist/'+file,{recursive:true});
await import('./build-offline.mjs');
console.log('Static application built in dist/; engine hashes verified.');
