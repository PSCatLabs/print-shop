import { VectorRenderer } from './renderer.js';
let renderer;
// The package's createRenderer fetches the module itself and compiles the
// bytes whenever the host does not serve .wasm as application/wasm. The URL is
// resolved relative to this module, so any path prefix works. The offline
// edition always passes data.wasm, so this never resolves from a blob: URL
// (where a relative URL would not parse; hence a function, not a constant).
const engineURL = () => new URL('../public/engine/pscat.wasm', import.meta.url);
// No step budget: the page shows progress and a Cancel button, and cancelling
// (or any new edit) terminates this worker outright. The loop therefore runs
// without yielding; progress messages go out at most every 250 ms.
const PROGRESS_INTERVAL = 250;
self.onmessage = async ({data}) => {
  try {
    renderer ??= await VectorRenderer.create(data.wasm ?? engineURL());
    renderer.begin(data.job);
    let reported = Date.now();
    while (renderer.step()) {
      if (Date.now() - reported >= PROGRESS_INTERVAL) {
        reported = Date.now();
        self.postMessage({id:data.id,progress:renderer.progress});
      }
    }
    const result = renderer.result();
    self.postMessage({id:data.id,result},[result.pdf.buffer]);
  } catch(error) {
    self.postMessage({id:data.id,error:error.message});
  }
};
