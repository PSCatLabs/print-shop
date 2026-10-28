import { normalizeText, validateMenu, ValidationError } from './model.js';

/** RFC 4180-style CSV, including quoted commas, newlines and escaped quotes. */
export function parseCSV(text) {
  if (typeof text !== 'string' || !text.trim()) throw new ValidationError(['The CSV file is empty.']);
  if (new TextEncoder().encode(text).length > 512 * 1024) throw new ValidationError(['CSV must be smaller than 512 KB.']);
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [], field = '', quoted = false, afterQuote = false;
  const pushField = () => { row.push(field); field = ''; afterQuote = false; };
  const pushRow = () => { pushField(); if (row.some(v => v.trim())) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else field += ch;
    } else if (ch === ',') pushField();
    else if (ch === '\n') pushRow();
    else if (ch === '"' && field === '' && !afterQuote) quoted = true;
    else if (afterQuote && ch === ' ') { /* tolerate trailing spaces after a quoted cell */ }
    else if (afterQuote || ch === '"') throw new ValidationError([`Malformed CSV near character ${i + 1}: unexpected text or quote.`]);
    else field += ch;
    if (rows.length > 501) throw new ValidationError(['This edition supports at most 500 menu items.']);
  }
  if (quoted) throw new ValidationError(['CSV has an unclosed quoted cell.']);
  if (field || row.length || afterQuote) pushRow();
  return rows;
}

const headers = new Map([
  ['category','category'],['item name','name'],['name','name'],['item','name'],
  ['description','description'],['price','price'],['dietary','dietary'],['dietary indicators','dietary'],
  ['variations','variations'],['add-ons','variations'],['variations or add-ons','variations'],
]);

/** @returns {import('./types').MenuDocument} */
export function importMenu(text) {
  const [header, ...rows] = parseCSV(text);
  const keys = header.map(s => headers.get(s.trim().toLowerCase()));
  const issues = [];
  for (const key of ['category','name','price']) if (!keys.includes(key)) issues.push(`Missing required column: ${key === 'name' ? 'Item name' : key}.`);
  const seen = new Set();
  keys.forEach((key, i) => {
    if (!key) issues.push(`Unknown column "${header[i]}". Use the example CSV headers.`);
    else if (seen.has(key)) issues.push(`Duplicate column: ${header[i]}.`);
    seen.add(key);
  });
  if (issues.length) throw new ValidationError(issues);
  const categories = new Map();
  rows.forEach((cells, index) => {
    if (cells.length !== header.length) { issues.push(`Data row ${index + 1}: expected ${header.length} cells, found ${cells.length}. Quote text containing commas.`); return; }
    const item = { name:'', description:'', price:'', dietary:'', variations:'' };
    let category = '';
    keys.forEach((key, i) => { if (key === 'category') category = normalizeText(cells[i]); else item[key] = normalizeText(cells[i]); });
    if (!categories.has(category)) categories.set(category, { name: category, items: [] });
    categories.get(category).items.push(item);
  });
  if (issues.length) throw new ValidationError(issues);
  const menu = { kind: 'menu', categories: [...categories.values()] };
  validateMenu(menu);
  return menu;
}
