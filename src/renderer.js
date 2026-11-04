import { Pscat } from '../public/engine/pscat.js';

/** The unchanged upstream wrapper drives the real interpreter. SVG and PDF are
 * upstream's own recorders (PSCatLabs/pscat#1004); all vector serialization
 * stays in Rust, and both formats come from the same interpreter run. */
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
    this.core.begin(job.source,job.width,job.height,1,{svg:true,pdf:true});
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
  result() {
    if (!this.complete) throw new Error('Only completed documents can be exported.');
    const svgs = Array.from({length:this.core.svgCount()},(_,page)=>this.core.svg(page));
    const pdf = this.core.pdf();
    if (!pdf?.length) throw new Error('PSCat returned an empty vector export.');
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
