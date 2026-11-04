/** Practical checks, not a PDF/X certification. Pure API for future MCP use.
 *
 * Every limitation stated here is checked against the exported bytes by
 * tests/render.test.mjs ("preflight claims match the exported PDF"), so an
 * engine change that adds page boxes, an output intent, embedded fonts or
 * non-RGB color fails a test until this text is updated. */
import { pageDimensions } from './postscript.js';

export function preflightPrint(document, parameters, result) {
  const findings = [];
  const error=(code,message)=>findings.push({severity:'error',code,message});
  if (!result?.svgs?.length || !result?.pdf?.length) error('missing-render','Complete a render before exporting.');
  // The engine silently falls back for an unknown font name, so templates refuse
  // a substitute in PostScript (printshop-font-substituted) and the render fails
  // before preflight. Engine warnings are still treated as blocking.
  for (const warning of result?.warnings ?? []) error('engine-warning',warning);
  if (result?.svgs?.length && result?.pdf?.length) {
    const expected = document.kind === 'business-card' ? {width:270,height:162} : pageDimensions(parameters);
    const pdf = new TextDecoder('latin1').decode(result.pdf);
    const boxes = [...pdf.matchAll(/\/MediaBox \[0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\]/g)];
    const svgSizes = result.svgs.map(svg => /<svg[^>]*\bwidth="([\d.]+)(?:pt)?"[^>]*\bheight="([\d.]+)(?:pt)?"/.exec(svg));
    if (result.width!==expected.width || result.height!==expected.height || boxes.length!==result.svgs.length
      || boxes.some(m=>Number(m[1])!==expected.width||Number(m[2])!==expected.height)
      || svgSizes.some(m=>!m||Number(m[1])!==expected.width||Number(m[2])!==expected.height))
      error('media-size',`Exported pages are not all ${expected.width} × ${expected.height} pt.`);
  }
  if (document.kind === 'menu' && result) {
    const count=document.categories.reduce((n,c)=>n+c.items.length,0);
    const match=/PSDONE (\d+) (\d+)\n/.exec(result.output);
    if (!match || Number(match[1])!==result.svgs?.length || Number(match[2])!==count) error('content-count','The rendered item or page count does not match the document.');
    const bounds=[...result.output.matchAll(/PSITEM (\d+) (\d+) ([\d.]+) ([\d.]+)/g)];
    if(bounds.length!==count || bounds.some(m=>Number(m[4])<55 || Number(m[3])>result.height-165)) error('layout-bounds','Content exceeded the measured menu layout area.');
  }
  if (document.kind === 'business-card' && result) {
    if (!/PSCARD 2\n/.test(result.output) || result.svgs?.length!==2) error('content-count','The card did not render exactly one front and one back.');
  }
  findings.push({severity:'info',code:'outlined-type',message:'Text is vector outlines of the engine’s bundled faces, exactly as the template names them, with no fallback face (Times and Helvetica are the metric-compatible Liberation Serif and Sans). Fonts do not need embedding; text is not searchable.'});
  findings.push({severity:'warning',code:'rgb-output',message:'RGB PDF 1.4: no ICC output intent, CMYK separation or PDF/X certification. Confirm acceptance with your printer.'});
  if (document.kind === 'business-card') {
    findings.push({severity:'info',code:'card-geometry',message:'Trim 3.5 × 2 in; 0.125 in bleed on all sides. Text is set inside a 24 pt media inset, with lower-baseline overflow checks.'});
    findings.push({severity:'warning',code:'missing-page-boxes',message:'Card PDF media includes bleed, but TrimBox, BleedBox and crop marks are not written. Supply trim instructions to your printer.'});
  } else {
    findings.push({severity:'info',code:'menu-safe-area',message:'Menu content uses 42 pt side margins and a 55 pt lower layout boundary. Background extends to the page edge.'});
    findings.push({severity:'warning',code:'menu-no-bleed',message:'Menu PDF uses the selected trim size without bleed, crop marks or TrimBox/BleedBox. Use a white background or discuss edge printing with your printer.'});
  }
  findings.push({severity:'info',code:'proof-not-certified',message:'Passing these checks means the file is a complete proof ready for review. It is not certified print-ready: confirm bleed, safe area, marks and color with your printer.'});
  return {readyForReview:!findings.some(f=>f.severity==='error'),productionCertified:false,findings};
}
