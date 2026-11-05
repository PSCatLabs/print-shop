export async function readText(path) {
  if (globalThis.PRINTSHOP_OFFLINE?.text[path] !== undefined) return globalThis.PRINTSHOP_OFFLINE.text[path];
  // Relative to this module, so the app works under any path prefix (GitHub Pages
  // serves it at /print-shop/).
  const response=await fetch(new URL('../'+path,import.meta.url));
  if(!response.ok)throw Error(`Could not load ${path}: HTTP ${response.status}`);
  return response.text();
}

export function createRenderWorker() {
  return new Worker(globalThis.PRINTSHOP_OFFLINE?.workerURL ?? new URL('./render-worker.js',import.meta.url),{type:globalThis.PRINTSHOP_OFFLINE?.workerType ?? 'module'});
}
