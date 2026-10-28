import { validateMenu, validateParameters, validateCard } from './model.js';

/** Literal byte strings prevent content from becoming executable PostScript. */
export function psString(text) {
  return '(' + [...text].map(c => {
    const n = c.charCodeAt(0);
    if (n > 255) throw new Error('Text cannot be encoded as Latin-1.');
    if (n < 32 || n > 126) return '\\' + n.toString(8).padStart(3,'0');
    return /[\\()]/.test(c) ? '\\' + c : c;
  }).join('') + ')';
}

const palettes = {
  olive: { ink:[0.19,0.23,0.16], accent:[0.38,0.43,0.25], paper:[0.98,0.97,0.93] },
  ink: { ink:[0.12,0.15,0.19], accent:[0.24,0.31,0.40], paper:[0.98,0.98,0.97] },
  wine: { ink:[0.27,0.12,0.15], accent:[0.52,0.20,0.23], paper:[0.99,0.96,0.92] },
  teal: { ink:[0.06,0.24,0.25], accent:[0.06,0.40,0.41], paper:[0.99,0.96,0.88] },
};

export function pageDimensions(parameters) {
  return parameters.pageSize === 'a4' ? {width:595,height:842} : {width:612,height:792};
}

function configuration(p, width, height) {
  const palette = palettes[p.palette];
  return `/Config << /Business ${psString(p.businessName)} /Subtitle ${psString(p.subtitle)}
 /W ${width} /H ${height} /Columns ${p.columns}
 /Gap ${{airy:18,balanced:12,compact:7}[p.density]}
 /Ornaments ${p.ornaments} /Sans ${p.typography === 'sans'}
 /Ink [${palette.ink.join(' ')}] /Accent [${palette.accent.join(' ')}] /Paper [${palette.paper.join(' ')}]
 >> def\n`;
}

export function compileMenu(menu, parameters, sources) {
  validateMenu(menu);
  validateParameters(parameters);
  const {width,height} = pageDimensions(parameters);
  if (!sources.common || !sources.template) throw new Error('Template source is missing.');
  const records = menu.categories.map(category => `<< /Name ${psString(category.name)} /Items [\n` +
    category.items.map(item => `<< /Name ${psString(item.name)} /Description ${psString(item.description)} /Price ${psString(item.price)} /Dietary ${psString(item.dietary)} /Variations ${psString(item.variations)} >>`).join('\n') + '\n] >>').join('\n');
  return { width,height, source:`%!PS-Adobe-3.0\n%%Title: Printshop menu\n%%EndComments\n` +
    configuration(parameters,width,height) + `/Menu [${records}] def\n` +
    sources.common + '\n' + sources.template + '\nps-layout-menu\n' };
}

export function compileCard(card, parameters, sources) {
  validateCard(card);
  validateParameters(parameters);
  if (!sources.common || !sources.card) throw new Error('Business card template is missing.');
  // 252 x 144 pt trim, plus 9 pt (1/8 inch) bleed on each edge.
  const width=270, height=162;
  const fields = ['name','role','email','phone','website','address'].map(key=>`/${key} ${psString(card[key])}`).join(' ');
  return {width,height,source:`%!PS-Adobe-3.0\n%%Title: Printshop business card\n%%EndComments\n` +
    configuration(parameters,width,height) + `/Card << ${fields} >> def\n` + sources.common + '\n' + sources.card + '\nps-layout-card\n'};
}
