import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const ctx = await chromium.launchPersistentContext(path.join(__dirname, '.profile-chrome'), {
  channel: 'chrome',
  headless: false,
  viewport: null,
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(
  'https://opencartforum.com/files/file/9261-rozetka-delivery-modul-dostavky-dlia-opencart/?do=newVersion',
  { waitUntil: 'domcontentloaded' }
);
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const ta = document.querySelector('textarea[name="file_changelog[5]"], textarea[name="file_changelog"]');
  return {
    changelog: ta?.value || '',
    zipSection: [...document.querySelectorAll('.ipsUploader')].slice(0, 1).map((u) => u.innerHTML.slice(0, 500)),
    allUploaders: [...document.querySelectorAll('.ipsUploader__row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
  };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
