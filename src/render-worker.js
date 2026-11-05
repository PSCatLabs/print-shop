import { VectorRenderer } from './renderer.js';
let renderer;
// Bytes, not instantiateStreaming: the engine loads whatever MIME type the host
// gives .wasm. Resolved relative to this module, so any path prefix works. The
// offline edition always passes data.wasm, so this never runs from a blob: URL.
async function engineBytes() {
  const response = await fetch(new URL('../public/engine/pscat.wasm', import.meta.url));
  if (!response.ok) throw new Error(`Could not load the engine: HTTP ${response.status}`);
  return response.arrayBuffer();
}
self.onmessage = async ({data}) => {
  try {
    renderer ??= await VectorRenderer.create(data.wasm ?? await engineBytes());
    renderer.begin(data.job);
    while (renderer.step()) await new Promise(resolve=>setTimeout(resolve,0));
    const result = renderer.result();
    self.postMessage({id:data.id,result},[result.pdf.buffer]);
  } catch(error) {
    self.postMessage({id:data.id,error:error.message});
  }
};
