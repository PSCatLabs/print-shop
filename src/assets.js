export async function readText(path) {
  if (globalThis.PRINTSHOP_OFFLINE?.text[path] !== undefined) return globalThis.PRINTSHOP_OFFLINE.text[path];
  const response=await fetch('/'+path);
  if(!response.ok)throw Error(`Could not load ${path}: HTTP ${response.status}`);
  return response.text();
}

export function createRenderWorker() {
  return new Worker(globalThis.PRINTSHOP_OFFLINE?.workerURL ?? new URL('./render-worker.js',import.meta.url),{type:'module'});
}
