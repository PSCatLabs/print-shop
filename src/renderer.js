import { Pscat } from '../public/engine/pscat.js';

const SLICE = 25000;

/** The unchanged upstream wrapper drives the real interpreter. SVG and PDF are
 * upstream's own recorders (PSCatLabs/pscat#1004); all vector serialization
 * stays in Rust, and both formats come from the same interpreter run.
 *
 * There is no built-in step budget: a document takes as long as its content
 * needs. The browser runs each job in a worker that the user can cancel and
 * that reports progress. A caller without a cancel control (a test, a future
 * server adapter) can pass `maxSteps` to bound a run. */
export class VectorRenderer {
  constructor(core) { this.core = core; }
  static async create(bytes) { return new VectorRenderer(await Pscat.instantiate(bytes)); }
  begin(job, {maxSteps = Infinity} = {}) {
    this.complete = false;
    this.job = null;
    // Positive whole points that cross the WASM boundary as 32-bit integers
    // unchanged (a larger number would wrap). Within that range, what the engine
    // can actually allocate is the engine's to report (pscat: unusable page size).
    for (const value of [job.width,job.height]) {
      if (!Number.isInteger(value) || value <= 0 || value > 0x7fffffff) throw new RangeError('PSCat: unusable page size.');
    }
    if (typeof job.source !== 'string' || !job.source) throw new Error('The PostScript job is missing.');
    if (!(maxSteps === Infinity || (Number.isInteger(maxSteps) && maxSteps > 0))) throw new RangeError('maxSteps must be a positive integer.');
    this.core.begin(job.source,job.width,job.height,1,{svg:true,pdf:true});
    this.job = job;
    this.maxSteps = maxSteps;
    this.steps = 0;
  }
  step() {
    if (!this.job) throw new Error('Begin a document before rendering.');
    // Never run past maxSteps: the last slice is only what remains.
    const slice = Math.min(SLICE, this.maxSteps - this.steps);
    const status = this.core.step(slice);
    this.steps += slice;
    if (status === -1) { this.complete = false; throw new Error(this.core.error); }
    if (status !== 0 && status !== 1) throw new Error(`Unexpected PSCat status: ${status}`);
    if (status === 1 && this.steps >= this.maxSteps) throw new Error(`printshop-step-limit: stopped after ${this.steps} interpreter steps (maxSteps ${this.maxSteps}).`);
    this.complete = status === 0;
    return !this.complete;
  }
  /** Interpreter steps run and pages finished so far in the current job. */
  get progress() { return {steps:this.steps ?? 0, pages:this.job ? this.core.svgCount() : 0}; }
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
  render(job, options) {
    this.begin(job, options);
    while (this.step());
    return this.result();
  }
}
