import { VectorRenderer } from './renderer.js';
let renderer;
self.onmessage = async ({data}) => {
  try {
    renderer ??= await VectorRenderer.create(data.wasm ?? await (await fetch('/public/engine/pscat.wasm')).arrayBuffer());
    renderer.begin(data.job);
    while (renderer.step()) await new Promise(resolve=>setTimeout(resolve,0));
    const result = renderer.result();
    self.postMessage({id:data.id,result},[result.pdf.buffer]);
  } catch(error) {
    self.postMessage({id:data.id,error:error.message});
  }
};
