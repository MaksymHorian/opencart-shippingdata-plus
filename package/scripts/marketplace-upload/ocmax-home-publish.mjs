/**
 * oc-max.com — enable shipping products and put them on the home Featured module.
 * Playbook: docs/listing/oc-max.md
 *
 *   node ocmax-home-publish.mjs
 *   node ocmax-home-publish.mjs --inspect
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODULES, shippingProducts } from './ocmax-modules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const PROFILE = path.join(__dirname, '.profile-ocmax-chrome');
const TOKEN_FILE = path.join(__dirname, '.ocmax-admin-token');
const CDP_PORT = 9333;
const FEATURED_NAME = 'Home Page';
const FEATURED_MODULE_ID = '28';
const HOME_LAYOUT_ID = '1';
const inspectOnly = process.argv.includes('--inspect');

function parseAdminToken(href) {
  const m = String(href || '').match(/[?&](user_token|token)=([^&]+)/i);
  if (!m) {
    return null;
  }
  return { name: m[1].toLowerCase() === 'user_token' ? 'user_token' : 'token', value: decodeURIComponent(m[2]) };
}

function adminUrl(route, token, extra) {
  const u = new URL('https://oc-max.com/admin/index.php');
  u.searchParams.set('route', route);
  if (token) {
    u.searchParams.set(token.name, token.value);
  }
  Object.keys(extra || {}).forEach((k) => u.searchParams.set(k, extra[k]));
  return u.toString();
}

async function readAdminToken(page) {
  return parseAdminToken(page.url()) || page.evaluate(() => {
    const a = document.querySelector('a[href*="user_token="], a[href*="token="]');
    const href = (a && a.getAttribute('href')) || window.location.href;
    const m = href.match(/[?&](user_token|token)=([^&]+)/i);
    return m ? { name: m[1].toLowerCase() === 'user_token' ? 'user_token' : 'token', value: decodeURIComponent(m[2]) } : null;
  });
}

async function isLoggedIn(page) {
  if (/route=common\/login/i.test(page.url()) || await page.evaluate(() => !!document.querySelector('input[name="password"]')).catch(() => true)) {
    return false;
  }
  return !!(await readAdminToken(page));
}

function pickAdminPage(context) {
  const open = context.pages().filter((p) => {
    try {
      return !p.isClosed();
    } catch (e) {
      return false;
    }
  });
  const admin = open.filter((p) => /oc-max\.com\/admin/i.test(p.url()));
  return admin.find((p) => parseAdminToken(p.url())) || admin[0] || open[0] || null;
}

async function launchOrAttach() {
  try {
    return {
      context: await chromium.launchPersistentContext(PROFILE, {
        channel: 'chrome',
        headless: false,
        viewport: null,
        ignoreDefaultArgs: ['--no-sandbox', '--enable-automation'],
        args: ['--remote-debugging-port=' + CDP_PORT],
      }),
    };
  } catch (launchErr) {
    if (!/already in use|Target page|closed/i.test(launchErr.message || '')) {
      throw launchErr;
    }
    const browser = await chromium.connectOverCDP('http://127.0.0.1:' + CDP_PORT);
    const context = browser.contexts()[0];
    if (!context) {
      console.log('STATUS BLOCKED profile_in_use');
      process.exit(1);
    }
    return { context: context };
  }
}

async function clickSave(page, formId) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    page.evaluate((id) => {
      const btn = (id && document.querySelector('button[form="' + id + '"]')) || document.querySelector('.page-header button.btn-primary');
      if (btn) {
        btn.click();
      }
    }, formId || ''),
  ]);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(800);
}

async function pageAlert(page) {
  return page.evaluate(() => {
    const a = document.querySelector('.alert-danger');
    return a ? (a.textContent || '').replace(/\s+/g, ' ').trim() : '';
  });
}

async function inspectShop(page, token) {
  const products = [];
  for (const row of shippingProducts()) {
    await page.goto(adminUrl('catalog/product/edit', token, { product_id: row.id }), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const info = await page.evaluate(() => ({
      status: (document.querySelector('select[name="status"]') || {}).value || '',
      model: (document.querySelector('input[name="model"]') || {}).value || '',
      name: (document.querySelector('input[name="product_description[1][name]"], input[name="product_description[3][name]"]') || {}).value || '',
    }));
    products.push(Object.assign({ id: row.id, key: row.key }, info));
  }

  await page.goto(adminUrl('design/layout/edit', token, { layout_id: '1' }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const homeMods = await page.evaluate(() => {
    const fields = [...document.querySelectorAll('[name*="layout_module"]')].map((el) => ({
      tag: el.tagName,
      name: el.name,
      type: el.type || '',
      value: el.value,
    }));
    return {
      fields: fields,
      headings: [...document.querySelectorAll('h3, legend, .panel-heading, label')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 80).slice(0, 40),
    };
  });
  console.log('home_mods ' + JSON.stringify(homeMods, null, 2));

  for (const extra of [
    { route: 'extension/module/featured', module_id: '28' },
    { route: 'extension/module/featured_product', module_id: '35' },
    { route: 'extension/module/carousel', module_id: '29' },
    { route: 'extension/module/slideshow', module_id: '27' },
  ]) {
    await page.goto(adminUrl(extra.route, token, extra.module_id ? { module_id: extra.module_id } : {}), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const info = await page.evaluate(() => ({
      title: document.title,
      denied: /доступ запрещен|permission|denied/i.test(document.body.innerText || ''),
      name: (document.querySelector('input[name="name"]') || {}).value || '',
      status: (document.querySelector('select[name="status"]') || {}).value || '',
      limit: (document.querySelector('input[name="limit"]') || {}).value || '',
      products: [...document.querySelectorAll('input[name="product[]"]')].map((el) => el.value),
      banners: [...document.querySelectorAll('select[name*="banner"], input[name*="banner"]')].map((el) => el.value),
    }));
    console.log('mod ' + extra.route + ' ' + extra.module_id + ' ' + JSON.stringify(info));
  }

  await page.goto(adminUrl('design/layout', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const layouts = await page.evaluate(() => {
    return [...document.querySelectorAll('table tbody tr')].map((tr) => {
      const href = ((tr.querySelector('a[href*="layout_id="]') || {}).getAttribute('href')) || '';
      const m = href.match(/layout_id=(\d+)/);
      return {
        name: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        id: m ? m[1] : '',
      };
    });
  });

  console.log('products ' + JSON.stringify(products));
  console.log('layouts ' + JSON.stringify(layouts, null, 2));
  return { products: products, layouts: layouts };
}

async function enableProducts(page, token) {
  for (const row of shippingProducts()) {
    await page.goto(adminUrl('catalog/product/edit', token, { product_id: row.id }), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const already = await page.evaluate(() => {
      const status = document.querySelector('select[name="status"]');
      return status ? status.value : '';
    });
    if (already === '1') {
      console.log('already_enabled ' + row.key + ' ' + row.id);
      continue;
    }
    await page.evaluate(() => {
      const status = document.querySelector('select[name="status"]');
      if (status) {
        status.value = '1';
      }
    });
    await clickSave(page, 'form-product');
    const alert = await pageAlert(page);
    if (alert) {
      console.log('STATUS BLOCKED enable ' + row.id + ' ' + alert.slice(0, 200));
      process.exit(1);
    }
    console.log('enabled ' + row.key + ' ' + row.id);
  }
}

async function fillFeatured(page, token, products) {
  await page.goto(adminUrl('extension/module/featured', token, { module_id: FEATURED_MODULE_ID }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const denied = await page.evaluate(() => /доступ запрещен|permission|denied/i.test(document.body.innerText || ''));
  if (denied) {
    console.log('STATUS BLOCKED featured_denied');
    process.exit(1);
  }
  const filled = await page.evaluate(({ products, name }) => {
    const nameInp = document.querySelector('input[name="name"]');
    if (nameInp) {
      nameInp.value = name;
    }
    const limit = document.querySelector('input[name="limit"]');
    if (limit) {
      limit.value = String(Math.max(4, products.length));
    }
    ['width', 'height'].forEach((n) => {
      const el = document.querySelector('input[name="' + n + '"]');
      if (el && !el.value) {
        el.value = '200';
      }
    });
    const status = document.querySelector('select[name="status"]');
    if (status) {
      status.value = '1';
    }
    document.querySelectorAll('input[name="product[]"]').forEach((el) => {
      const wrap = el.closest('div');
      if (wrap) {
        wrap.remove();
      } else {
        el.remove();
      }
    });
    const box = document.getElementById('featured-product') || document.querySelector('.well');
    if (!box) {
      return { ok: false, reason: 'no_box' };
    }
    products.forEach((row) => {
      const id = String(row.id);
      const div = document.createElement('div');
      div.id = 'featured-product' + id;
      div.innerHTML = '<i class="fa fa-minus-circle"></i> ' + String(row.name || row.model || id).replace(/</g, '') + '<input type="hidden" name="product[]" value="' + id + '">';
      box.appendChild(div);
    });
    return {
      ok: true,
      ids: [...document.querySelectorAll('input[name="product[]"]')].map((el) => el.value),
    };
  }, { products: products, name: FEATURED_NAME });
  console.log('featured_fill ' + JSON.stringify(filled));
  if (!filled.ok) {
    console.log('STATUS BLOCKED featured_form');
    process.exit(1);
  }
  await clickSave(page, 'form-module');
  const alert = await pageAlert(page);
  if (alert) {
    console.log('STATUS BLOCKED featured_save ' + alert.slice(0, 200));
    process.exit(1);
  }
  await page.goto(adminUrl('extension/module/featured', token, { module_id: FEATURED_MODULE_ID }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const after = await page.evaluate(() => ({
    status: (document.querySelector('select[name="status"]') || {}).value || '',
    products: [...document.querySelectorAll('input[name="product[]"]')].map((el) => el.value),
  }));
  console.log('featured_saved ' + JSON.stringify(after));
}

async function main() {
  const { context } = await launchOrAttach();
  const page = pickAdminPage(context) || await context.newPage();
  await page.bringToFront().catch(() => {});
  if (!(await isLoggedIn(page))) {
    console.log('STATUS WAITING_LOGIN');
    process.exit(0);
  }
  const token = await readAdminToken(page);
  fs.writeFileSync(TOKEN_FILE, token.name + '=' + token.value, 'utf8');

  if (inspectOnly) {
    await inspectShop(page, token);
    console.log('STATUS INSPECT');
    process.exit(0);
  }

  await enableProducts(page, token);
  await fillFeatured(page, token, shippingProducts());
  console.log('home_layout ' + HOME_LAYOUT_ID + ' already has featured.' + FEATURED_MODULE_ID + ' content_top');
  console.log('STATUS PUBLISHED');
  process.exit(0);
}

main().catch((err) => {
  console.log('STATUS BLOCKED ' + err.message);
  process.exit(1);
});
