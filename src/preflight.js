/** Practical checks, not a PDF/X certification. Pure API for future MCP use. */
export function preflightPrint(document, parameters, result) {
  const findings = [];
  if (!result?.svgs?.length || !result?.pdf?.length) findings.push({severity:'error',code:'missing-render',message:'Complete a render before exporting.'});
  for (const warning of result?.warnings ?? []) findings.push({severity:'error',code:'font-substitution',message:warning});
  if (document.kind === 'menu' && result) {
    const count=document.categories.reduce((n,c)=>n+c.items.length,0);
    const match=/PSDONE (\d+) (\d+)\n/.exec(result.output);
    if (!match || Number(match[1])!==result.svgs.length || Number(match[2])!==count) findings.push({severity:'error',code:'content-count',message:'The rendered item or page count does not match the document.'});
    const bounds=[...result.output.matchAll(/PSITEM (\d+) (\d+) ([\d.]+) ([\d.]+)/g)];
    if(bounds.length!==count || bounds.some(m=>Number(m[4])<55 || Number(m[3])>result.height-165)) findings.push({severity:'error',code:'layout-bounds',message:'Content exceeded the measured menu layout area.'});
  }
  findings.push({severity:'info',code:'outlined-type',message:'Text is vector outlines. Fonts do not need embedding; text is not searchable.'});
  findings.push({severity:'warning',code:'rgb-output',message:'RGB PDF 1.4: no ICC output intent, CMYK separation or PDF/X certification. Confirm acceptance with your printer.'});
  if (document.kind === 'business-card') {
    findings.push({severity:'info',code:'card-geometry',message:'Trim 3.5 × 2 in; 0.125 in bleed on all sides. Text is set inside a 24 pt media inset, with lower-baseline overflow checks.'});
    findings.push({severity:'warning',code:'missing-page-boxes',message:'Card PDF media includes bleed, but TrimBox, BleedBox and crop marks are not written. Supply trim instructions to your printer.'});
  } else {
    findings.push({severity:'info',code:'menu-safe-area',message:'Menu content uses 42 pt side margins and a 55 pt lower layout boundary. Background extends to the page edge.'});
    findings.push({severity:'warning',code:'menu-no-bleed',message:'Menu PDF uses the selected trim size without bleed or crop marks. Use a white background or discuss edge printing with your printer.'});
  }
  return {readyForReview:!findings.some(f=>f.severity==='error'),productionCertified:false,findings};
}
