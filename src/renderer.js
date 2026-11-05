import { createRenderer, PostScriptError } from '../public/engine/index.js';

const SLICE = 25000;

/** The pscat package's own Renderer API (the pinned release in
 * public/engine/provenance.json, unmodified) drives the real interpreter. SVG
 * and PDF are upstream's own recorders (PSCatLabs/pscat#1004); all vector
 * serialization stays in Rust, and both formats come from the same run.
 *
 * There is no built-in step budget: a document takes as long as its content
 * needs. The browser runs each job in a worker that the user can cancel and
 * that reports progress. A caller without a cancel control (a test, a future
 * server adapter) can pass `maxSteps` to bound a run. */
export class VectorRenderer {
  constructor(core) { this.core = core; }
  /** `wasm`: the module's bytes (or anything createRenderer's `wasm` takes). */
  static async create(wasm) { return new VectorRenderer(await createRenderer({wasm})); }
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
    this.core.begin(job.source,{width:job.width,height:job.height,svg:true,pdf:true});
    this.job = job;
    this.maxSteps = maxSteps;
    this.steps = 0;
    this.pages = 0;
  }
  step() {
    if (!this.job) throw new Error('Begin a document before rendering.');
    // Never run past maxSteps: the last slice is only what remains.
    const slice = Math.min(SLICE, this.maxSteps - this.steps);
    let more;
    try { more = this.core.step(slice); }
    catch (error) {
      this.complete = false;
      // The full report (error name, offending command, hint), as the app's
      // named-error messages match it; PostScriptError.message is line 1 only.
      throw error instanceof PostScriptError ? new Error(error.report) : error;
    }
    this.steps += slice;
    if (more && this.steps >= this.maxSteps) throw new Error(`printshop-step-limit: stopped after ${this.steps} interpreter steps (maxSteps ${this.maxSteps}).`);
    this.complete = !more;
    return more;
  }
  /** Interpreter steps run and pages recorded so far (the current page
   * included) in the current job. The Renderer API has no page count, so this
   * probes svg(n) past the last known page: svg() refuses an index beyond the
   * document with a RangeError before serializing anything, and each existing
   * page is serialized at most once per job to count it. */
  get progress() {
    if (!this.job) return {steps:0, pages:0};
    for (;;) {
      try { this.core.svg(this.pages); } catch (error) { if (error instanceof RangeError) break; throw error; }
      this.pages++;
    }
    return {steps:this.steps, pages:this.pages};
  }
  result() {
    if (!this.complete) throw new Error('Only completed documents can be exported.');
    const svgs = this.core.svgPages();
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
