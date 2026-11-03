import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const TOKEN = fs.readFileSync(path.join(__dirname, '.ocmax-admin-token'), 'utf8').trim();
const eq = TOKEN.indexOf('=');
const name = TOKEN.slice(0, eq);
const value = TOKEN.slice(eq + 1);
const filterModel = process.argv[2] || 'ukrposhta';

const url =
  'https://oc-max.com/admin/index.php?route=catalog/product&' +
  name +
  '=' +
  encodeURIComponent(value) +
  '&filter_model=' +
  encodeURIComponent(filterModel);

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => /oc-max/.test(p.url())) || (await ctx.newPage());
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

const rows = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('table tbody tr').forEach((tr) => {
    const edit = tr.querySelector('a[href*="product_id="]');
    if (!edit) {
      return;
    }
    const m = (edit.getAttribute('href') || '').match(/product_id=(\d+)/);
    if (!m) {
      return;
    }
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim());
    out.push({ id: m[1], cells: tds.slice(0, 6) });
  });
  return out;
});

console.log(JSON.stringify(rows, null, 2));
console.log('count ' + rows.length);
