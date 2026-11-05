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

// No length caps: what fits is decided by measured layout in PostScript, which
// raises a named error (word, title, subtitle, item or card overflow).
export function textIssue(value, label, required = false) {
  if (typeof value !== 'string') return `${label} must be text.`;
  if (required && !value.trim()) return `${label} is required.`;
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
    const err = textIssue(category.name, `Category ${c + 1}`, true);
    if (err) issues.push(err);
    if (!Array.isArray(category.items) || !category.items.length) { issues.push(`Category ${c + 1} needs at least one item.`); return; }
    category.items.forEach((item, i) => {
      count++;
      if (!item || typeof item !== 'object') { issues.push(`Category ${c + 1}, item ${i + 1} must be an object.`); return; }
      for (const [key, required] of [['name',true], ['description',false], ['price',true], ['dietary',false], ['variations',false]]) {
        const issue = textIssue(item[key], `Category ${c + 1}, item ${i + 1}: ${key}`, required);
        if (issue) issues.push(issue);
      }
      if (typeof item.price === 'string' && !/^(?:(?:[$£]?\s*\d+(?:[.,]\d{1,2})?)(?:\s*\/\s*[$£]?\d+(?:[.,]\d{1,2})?)?|M\.?P\.?|Market price)$/i.test(item.price)) {
        issues.push(`Category ${c + 1}, item ${i + 1}: price must be an amount (12.50, $12) or MP.`);
      }
    });
  });
  if (!count) issues.push('The menu is empty. Add at least one item.');
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
  for (const [key, required] of [['businessName',true],['subtitle',false]]) {
    const issue = textIssue(params[key], key, required);
    if (issue) issues.push(issue);
  }
  if (typeof params.businessName === 'string' && params.businessName.includes('\n')) issues.push('Business name must be on one line.');
  if (typeof params.ornaments !== 'boolean') issues.push('Ornaments must be on or off.');
  if (issues.length) throw new ValidationError(issues);
}

export function validateCard(card) {
  if (!card || card.kind !== 'business-card') throw new ValidationError(['Expected a business card.']);
  const issues = [];
  for (const [key,required] of [['name',true],['role',false],['email',false],['phone',false],['website',false],['address',false]]) {
    const issue = textIssue(card[key], key, required);
    if (issue) issues.push(issue);
  }
  if (typeof card.name === 'string' && card.name.includes('\n')) issues.push('Card name must be on one line.');
  if (card.qr !== undefined && card.qr !== '') {
    // Printable ASCII only: lib/qr.ps encodes raw bytes with no ECI, and URLs are ASCII.
    // No length cap here: capacity at a printable module size is checked where the
    // symbol is built (printshop-qr-too-dense; 203 bytes at level Q in 1 in).
    if (typeof card.qr !== 'string' || !/^[\x20-\x7e]+$/.test(card.qr)) issues.push('QR link must be plain ASCII text, such as a web address.');
  }
  if (issues.length) throw new ValidationError(issues);
}
