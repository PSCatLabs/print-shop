import { Pscat } from '../public/engine/pscat.js';

/** The unchanged upstream wrapper drives the real interpreter. Only exports
 * use Printshop's small ABI addition; all vector serialization stays in Rust. */
export class VectorRenderer {
  constructor(core) { this.core = core; }
  static async create(bytes) { return new VectorRenderer(await Pscat.instantiate(bytes)); }
  begin(job) {
    this.complete = false;
    this.job = null;
    for (const value of [job.width,job.height]) {
      if (!Number.isInteger(value) || value <= 0 || value > 2000) throw new RangeError('PSCat: unusable page size.');
    }
    if (typeof job.source !== 'string' || job.source.length > 2_000_000) throw new Error('The PostScript job is missing or too large.');
    this.core.begin(job.source,job.width,job.height);
    this.job = job;
    this.complete = false;
    this.steps = 0;
  }
  step() {
    if (!this.job) throw new Error('Begin a document before rendering.');
    const status = this.core.step(25000);
    this.steps += 25000;
    if (status === -1) { this.complete = false; throw new Error(this.core.error); }
    if (status !== 0 && status !== 1) throw new Error(`Unexpected PSCat status: ${status}`);
    if (this.steps > 12_000_000) throw new Error('The document exceeded the render budget. Reduce its size or density.');
    this.complete = status === 0;
    return !this.complete;
  }
  exportBytes(kind) {
    if (!this.complete) throw new Error('Only completed documents can be exported.');
    const ex = this.core.ex;
    const len = ex.ps_vector_export(kind);
    if (!len) throw new Error('PSCat returned an empty vector export.');
    return new Uint8Array(ex.memory.buffer, ex.ps_vector_ptr(), len).slice();
  }
  result() {
    const svgs = JSON.parse(new TextDecoder().decode(this.exportBytes(0)));
    const pdf = this.exportBytes(1);
    if (!Array.isArray(svgs) || !svgs.length || svgs.some(s=>!s.includes('<svg'))) throw new Error('Invalid SVG export.');
    if (!new TextDecoder().decode(pdf.slice(0,8)).startsWith('%PDF-1.4')) throw new Error('Invalid PDF export.');
    return { svgs, pdf, output: this.core.output, warnings: this.core.warnings,
      width:this.job.width,height:this.job.height };
  }
  render(job) {
    this.begin(job);
    while (this.step());
    return this.result();
  }
}
