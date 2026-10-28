/** @typedef {import('./types').MenuDocument} MenuDocument */
/** @typedef {import('./types').DesignParameters} DesignParameters */

export class ValidationError extends Error {
  constructor(issues) {
    super(issues.join('\n'));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

// The bundled standard fonts use single-byte Latin-1. Normalize common pasted
// typography explicitly; never silently replace unsupported scripts or emoji.
export function normalizeText(value) {
  return value.normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/\u2026/g, '...').replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim();
}

export function textIssue(value, label, max, required = false) {
  if (typeof value !== 'string') return `${label} must be text.`;
  if (required && !value.trim()) return `${label} is required.`;
  if (value.length > max) return `${label} exceeds ${max} characters.`;
  if (/[^\x20-\x7e\xa0-\xff\n]/u.test(value)) return `${label} contains unsupported characters. This edition supports Latin-1 text.`;
  return null;
}

/** @param {unknown} document @returns {asserts document is MenuDocument} */
export function validateMenu(document) {
  const issues = [];
  if (!document || document.kind !== 'menu' || !Array.isArray(document.categories)) {
    throw new ValidationError(['Expected a menu with categories.']);
  }
  let count = 0;
  document.categories.forEach((category, c) => {
    if (!category || typeof category !== 'object') { issues.push(`Category ${c + 1} must be an object.`); return; }
    const err = textIssue(category.name, `Category ${c + 1}`, 60, true);
    if (err) issues.push(err);
    if (!Array.isArray(category.items) || !category.items.length) { issues.push(`Category ${c + 1} needs at least one item.`); return; }
    category.items.forEach((item, i) => {
      count++;
      if (!item || typeof item !== 'object') { issues.push(`Category ${c + 1}, item ${i + 1} must be an object.`); return; }
      for (const [key, max, required] of [['name',120,true], ['description',600,false], ['price',24,true], ['dietary',80,false], ['variations',240,false]]) {
        const issue = textIssue(item[key], `Category ${c + 1}, item ${i + 1}: ${key}`, max, required);
        if (issue) issues.push(issue);
      }
      if (typeof item.price === 'string' && !/^(?:(?:[$£]?\s*\d{1,6}(?:[.,]\d{1,2})?)(?:\s*\/\s*[$£]?\d{1,6}(?:[.,]\d{1,2})?)?|M\.?P\.?|Market price)$/i.test(item.price)) {
        issues.push(`Category ${c + 1}, item ${i + 1}: price must be an amount (12.50, $12) or MP.`);
      }
    });
  });
  if (!count) issues.push('The menu is empty. Add at least one item.');
  if (count > 500) issues.push('This edition supports at most 500 menu items.');
  if (issues.length) throw new ValidationError(issues);
}

export const templates = Object.freeze([
  { id: 'classic-bistro', name: 'Classic Bistro', note: 'Serif type · quiet ornament', source: 'classic-bistro.ps' },
  { id: 'modernist', name: 'Modernist', note: 'Swiss grid · bold hierarchy', source: 'modernist.ps' },
  { id: 'retro-diner', name: 'Retro Diner', note: 'Mid-century · playful geometry', source: 'retro-diner.ps' },
]);

/** @type {DesignParameters} */
export const defaults = Object.freeze({
  template: 'classic-bistro', businessName: 'The Olive Room', subtitle: 'SEASONAL KITCHEN · EST. 1998',
  palette: 'olive', typography: 'editorial', pageSize: 'letter', columns: 2,
  density: 'balanced', ornaments: true,
});

/** @param {unknown} params @returns {asserts params is DesignParameters} */
export function validateParameters(params) {
  if (!params || typeof params !== 'object') throw new ValidationError(['Design parameters are required.']);
  const issues = [];
  const choices = {
    template: templates.map(t => t.id), palette: ['olive','ink','wine','teal'],
    typography: ['editorial','sans'], pageSize: ['letter','a4'], columns: [1,2],
    density: ['airy','balanced','compact'],
  };
  for (const [key, values] of Object.entries(choices)) {
    if (!values.includes(params[key])) issues.push(`Choose a supported ${key}: ${values.join(', ')}.`);
  }
  for (const [key, max, required] of [['businessName',80,true],['subtitle',120,false]]) {
    const issue = textIssue(params[key], key, max, required);
    if (issue) issues.push(issue);
  }
  if (typeof params.businessName === 'string' && params.businessName.includes('\n')) issues.push('Business name must be on one line.');
  if (typeof params.ornaments !== 'boolean') issues.push('Ornaments must be on or off.');
  if (issues.length) throw new ValidationError(issues);
}

export function validateCard(card) {
  if (!card || card.kind !== 'business-card') throw new ValidationError(['Expected a business card.']);
  const issues = [];
  for (const [key,max,required] of [['name',60,true],['role',80,false],['email',120,false],['phone',60,false],['website',120,false],['address',180,false]]) {
    const issue = textIssue(card[key], key, max, required);
    if (issue) issues.push(issue);
  }
  if (typeof card.name === 'string' && card.name.includes('\n')) issues.push('Card name must be on one line.');
  if (card.qr) issues.push('QR codes are awaiting the upstream PSCat PostScript library.');
  if (issues.length) throw new ValidationError(issues);
}
