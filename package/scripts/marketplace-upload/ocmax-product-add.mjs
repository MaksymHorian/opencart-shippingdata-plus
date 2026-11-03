/**
 * oc-max.com ocStore — Catalog → Add product (draft / Disabled).
 * Playbook: docs/listing/oc-max.md
 *
 *   node ocmax-product-add.mjs --login
 *   node ocmax-product-add.mjs [novaposhta|meest|ukrposhta|rozetka_delivery]
 *   node ocmax-product-add.mjs novaposhta --h1-keywords
 *
 * --login: open /admin/ once, leave the window alone, keep Chrome open.
 * Fill mode: attach only after the user is already in. No captcha polling.
 * Profile: .profile-ocmax-chrome (not forum .profile-chrome).
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORY, MODULES, relatedFor } from './ocmax-modules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const ADMIN = 'https://oc-max.com/admin/';
const PRODUCT_ADD_ROUTE = 'catalog/product/add';
const PROFILE = path.join(__dirname, '.profile-ocmax-chrome');
const TOKEN_FILE = path.join(__dirname, '.ocmax-admin-token');
const CDP_PORT = 9333;

function localeKey(label) {
  const t = (label || '').toLowerCase();
  if (/україн|ukrain|uk-ua|украинск/.test(t) && !/русск/.test(t)) {
    return 'uk';
  }
  if (/english|англій|англий/.test(t)) {
    return 'en';
  }
  if (/русск|russian|росій/.test(t)) {
    return 'ru';
  }
  return '';
}

/** ocStore 2.x uses `token`; OC3 / ocStore 3 uses `user_token`. Never log the value. */
function parseAdminToken(href) {
  const m = String(href || '').match(/[?&](user_token|token)=([^&]+)/i);
  if (!m) {
    return null;
  }
  const name = m[1].toLowerCase() === 'user_token' ? 'user_token' : 'token';
  return { name: name, value: decodeURIComponent(m[2]) };
}

function adminUrl(route, token) {
  const u = new URL('https://oc-max.com/admin/index.php');
  u.searchParams.set('route', route);
  if (token) {
    u.searchParams.set(token.name, token.value);
  }
  return u.toString();
}

async function readAdminToken(page) {
  const fromUrl = parseAdminToken(page.url());
  if (fromUrl) {
    return fromUrl;
  }
  return page.evaluate(() => {
    const href = window.location.href;
    let m = href.match(/[?&](user_token|token)=([^&]+)/i);
    if (m) {
      return { name: m[1].toLowerCase() === 'user_token' ? 'user_token' : 'token', value: decodeURIComponent(m[2]) };
    }
    const a = document.querySelector('a[href*="user_token="], a[href*="token="]');
    if (a) {
      m = (a.getAttribute('href') || '').match(/[?&](user_token|token)=([^&]+)/i);
      if (m) {
        return { name: m[1].toLowerCase() === 'user_token' ? 'user_token' : 'token', value: decodeURIComponent(m[2]) };
      }
    }
    const inp = document.querySelector('input[name="user_token"], input[name="token"]');
    if (inp && inp.value) {
      return { name: inp.getAttribute('name') === 'user_token' ? 'user_token' : 'token', value: inp.value };
    }
    return null;
  });
}

function parseArgs(argv) {
  let loginOnly = false;
  let patchH1 = false;
  let key = 'novaposhta';
  for (const a of argv.slice(2)) {
    if (a === '--login') {
      loginOnly = true;
    } else if (a === '--h1-keywords') {
      patchH1 = true;
    } else if (!a.startsWith('-')) {
      key = a.replace(/^-+/, '');
    }
  }
  return { loginOnly: loginOnly, patchH1: patchH1, key: key };
}

async function isLoggedIn(page) {
  const href = page.url();
  if (/route=common\/login/i.test(href)) {
    return false;
  }
  try {
    const hasPassword = await page.evaluate(() => !!document.querySelector('input[name="password"]'));
    if (hasPassword) {
      return false;
    }
  } catch (evalErr) {
    if (/closed|navigating|Target/i.test(evalErr.message || '')) {
      return false;
    }
    throw evalErr;
  }
  return !!parseAdminToken(href);
}

function persistToken(token) {
  if (!token || !token.value) {
    return;
  }
  fs.writeFileSync(TOKEN_FILE, token.name + '=' + token.value, 'utf8');
}

/** Last token from this Playwright profile only. Never log the value. */
function loadCachedToken() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (!raw) {
      return null;
    }
    const eq = raw.indexOf('=');
    if (eq > 0) {
      const name = raw.slice(0, eq).toLowerCase() === 'token' ? 'token' : 'user_token';
      return { name: name, value: raw.slice(eq + 1).trim() };
    }
    return { name: 'user_token', value: raw };
  } catch (readErr) {
    return null;
  }
}

function pickAdminPage(context) {
  const open = context.pages().filter((p) => {
    try {
      return !p.isClosed();
    } catch (e) {
      return false;
    }
  });
  const admin = open.filter((p) => {
    try {
      return /oc-max\.com\/admin/i.test(p.url());
    } catch (e) {
      return false;
    }
  });
  const withToken = admin.find((p) => parseAdminToken(p.url()));
  return withToken || admin[0] || open[0] || null;
}

async function launchOrAttach() {
  const launchOpts = {
    channel: 'chrome',
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--no-sandbox', '--enable-automation'],
    args: ['--remote-debugging-port=' + CDP_PORT],
  };
  try {
    const context = await chromium.launchPersistentContext(PROFILE, launchOpts);
    return { context: context, attached: false };
  } catch (launchErr) {
    const msg = launchErr.message || '';
    if (!/already in use|Target page|closed/i.test(msg)) {
      throw launchErr;
    }
    console.log('profile_in_use attach CDP ' + CDP_PORT);
    const browser = await chromium.connectOverCDP('http://127.0.0.1:' + CDP_PORT);
    const context = browser.contexts()[0];
    if (!context) {
      console.log('STATUS BLOCKED profile_in_use — no browser context on CDP');
      process.exit(1);
    }
    return { context: context, attached: true };
  }
}

async function setRichHtml(page, langId, html) {
  return page.evaluate(
    ({ langId, html }) => {
      const name = 'product_description[' + langId + '][description]';
      const ta = document.querySelector('textarea[name="' + name + '"]');
      const id = ta && ta.id;
      if (id && window.jQuery && window.jQuery.fn && window.jQuery.fn.summernote && window.jQuery('#' + id).next('.note-editor').length) {
        window.jQuery('#' + id).summernote('code', html);
        return 'summernote';
      }
      if (window.CKEDITOR) {
        const inst = id && window.CKEDITOR.instances[id]
          ? window.CKEDITOR.instances[id]
          : Object.keys(window.CKEDITOR.instances || {})
            .map((k) => window.CKEDITOR.instances[k])
            .find((i) => i && i.element && i.element.getName && true);
        if (inst) {
          inst.setData(html);
          if (inst.updateElement) {
            inst.updateElement();
          }
          return 'ckeditor';
        }
      }
      if (ta) {
        ta.value = html;
        return 'textarea';
      }
      return 'missing';
    },
    { langId, html },
  );
}

async function dumpLanguageMap(page) {
  return page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#tab-general a[href^="#language"]')];
    return tabs.map((a) => {
      const href = a.getAttribute('href') || '';
      const id = (href.match(/language(\d+)/) || [])[1] || '';
      return { id, label: (a.textContent || '').replace(/\s+/g, ' ').trim() };
    });
  });
}

async function fillH1AndKeywordsForLang(page, langId, spec, key) {
  const set = await page.evaluate(({ langId, h1, keys }) => {
    const pick = (field) => document.querySelector('[name="product_description[' + langId + '][' + field + ']"]');
    const h1El = pick('meta_h1');
    const keyEl = pick('meta_keyword');
    if (h1El) {
      h1El.value = h1;
    }
    if (keyEl) {
      keyEl.value = keys;
    }
    return { h1: !!(h1El && h1El.value), keys: !!(keyEl && keyEl.value) };
  }, { langId: langId, h1: spec.names[key], keys: spec.tags[key] });
  return set;
}

async function fillH1AndKeywords(page, spec) {
  const map = await dumpLanguageMap(page);
  for (const row of map) {
    const key = localeKey(row.label);
    if (!key || !spec.names[key]) {
      continue;
    }
    await page.click('#tab-general a[href="#language' + row.id + '"]');
    await page.waitForTimeout(200);
    const set = await fillH1AndKeywordsForLang(page, row.id, spec, key);
    console.log('h1_keywords_' + key + ' lang' + row.id + ' ' + JSON.stringify(set));
  }
}

async function fillGeneral(page, spec) {
  const map = await dumpLanguageMap(page);
  console.log('language_map ' + JSON.stringify(map));
  if (!map.length) {
    throw new Error('no language tabs on #tab-general');
  }
  for (const row of map) {
    const key = localeKey(row.label);
    if (!key || !spec.names[key]) {
      console.log('language_skip ' + row.label);
      continue;
    }
    await page.click('#tab-general a[href="#language' + row.id + '"]');
    await page.waitForTimeout(300);
    const nameSel = 'input[name="product_description[' + row.id + '][name]"]';
    await page.fill(nameSel, spec.names[key]);
    const metaTitle = page.locator('input[name="product_description[' + row.id + '][meta_title]"]');
    if (await metaTitle.count()) {
      await metaTitle.fill(spec.names[key]);
    }
    await fillH1AndKeywordsForLang(page, row.id, spec, key);
    const metaDesc = page.locator('textarea[name="product_description[' + row.id + '][meta_description]"]');
    if (await metaDesc.count()) {
      await metaDesc.fill(spec.meta[key]);
    }
    const tag = page.locator('input[name="product_description[' + row.id + '][tag]"]');
    if (await tag.count()) {
      await tag.fill(spec.tags[key]);
    }
    const descPath = path.join(spec.listingDir, spec.descFiles[key]);
    const html = fs.readFileSync(descPath, 'utf8');
    const how = await setRichHtml(page, row.id, html);
    console.log('description_' + key + ' ' + how);
  }
}

async function fillData(page, spec) {
  await page.click('a[href="#tab-data"]');
  await page.waitForTimeout(200);
  await page.fill('input[name="model"]', spec.model);
  await page.fill('input[name="price"]', spec.price);
  const qty = page.locator('input[name="quantity"]');
  if (await qty.count()) {
    await qty.fill('999');
  }
  const shipping = page.locator('input[name="shipping"][value="0"]');
  if (await shipping.count()) {
    await shipping.check();
  }
  const subtract = page.locator('select[name="subtract"]');
  if (await subtract.count()) {
    await subtract.selectOption('0');
  }
  const status = page.locator('select[name="status"]');
  if (await status.count()) {
    await status.selectOption('0');
  }
  const keyword = page.locator('input[name="keyword"]');
  if (await keyword.count()) {
    await keyword.fill(spec.slug);
  }
}

async function listEntityId(page, token, route, name) {
  await page.goto(adminUrl(route, token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page.evaluate((label) => {
    const rows = [...document.querySelectorAll('table tbody tr')];
    for (const tr of rows) {
      if (!(tr.textContent || '').includes(label)) {
        continue;
      }
      const href = ((tr.querySelector('a[href*="_id="]') || {}).getAttribute('href')) || '';
      const m = href.match(/[?&](?:manufacturer_id|category_id|download_id)=(\d+)/);
      if (m) {
        return m[1];
      }
    }
    return '';
  }, name);
}

async function ensureManufacturer(page, token, spec) {
  let id = await listEntityId(page, token, 'catalog/manufacturer', spec.manufacturer);
  if (id) {
    console.log('manufacturer_exists ' + id);
    return id;
  }
  await page.goto(adminUrl('catalog/manufacturer/add', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const nameInput = page.locator('input[name="name"]');
  if (await nameInput.count()) {
    await nameInput.fill(spec.manufacturer);
  } else {
    const named = page.locator('input[name*="[name]"]');
    const n = await named.count();
    for (let i = 0; i < n; i += 1) {
      await named.nth(i).fill(spec.manufacturer);
    }
  }
  await saveProduct(page);
  await page.waitForTimeout(1000);
  id = (page.url().match(/manufacturer_id=(\d+)/) || [])[1] || await listEntityId(page, token, 'catalog/manufacturer', spec.manufacturer);
  console.log('manufacturer_created ' + (id || '?'));
  return id || '';
}

async function findShippingCategory(page, token) {
  await page.goto(adminUrl('catalog/category', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const rows = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((tr) => {
    const href = ((tr.querySelector('a[href*="category_id="]') || {}).getAttribute('href')) || '';
    const box = tr.querySelector('input[name="selected[]"]');
    return {
      id: (href.match(/category_id=(\d+)/) || [])[1] || (box ? box.value : ''),
      text: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
    };
  }));
  if (rows.some((r) => r.id === CATEGORY.id)) {
    console.log('category_exists ' + CATEGORY.id);
    return CATEGORY.id;
  }
  const delivery = rows.filter((r) => r.id && CATEGORY.nameNeedle.test(r.text));
  for (const row of delivery) {
    const edit = new URL(adminUrl('catalog/category/edit', token));
    edit.searchParams.set('category_id', row.id);
    await page.goto(edit.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const parent = await page.evaluate(() => {
      const pathInp = document.querySelector('input[name="path"], input[name="parent"]');
      return (pathInp && pathInp.value) || '';
    });
    if (CATEGORY.parentNeedle.test(parent)) {
      console.log('category_exists ' + row.id);
      return row.id;
    }
  }
  console.log('STATUS BLOCKED no_category ' + CATEGORY.label);
  process.exit(1);
}

function listingProductId(listingDir) {
  try {
    const md = fs.readFileSync(path.join(listingDir, 'LISTING.md'), 'utf8');
    const ocmax = md.split('oc-max.com')[1] || '';
    const m = ocmax.match(/Product ID\s*\|\s*\*\*(\d+)\*\*/i);
    return m ? m[1] : '';
  } catch (e) {
    return '';
  }
}

async function findExistingProduct(page, token, spec) {
  if (spec.productId) {
    console.log('STATUS EXISTS product_id ' + spec.productId + ' from_spec');
    return spec.productId;
  }
  const listed = listingProductId(spec.listingDir);
  if (listed) {
    console.log('STATUS EXISTS product_id ' + listed + ' from_listing');
    return listed;
  }
  const list = new URL(adminUrl('catalog/product', token));
  list.searchParams.set('filter_model', spec.model);
  await page.goto(list.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const hit = await page.evaluate((model) => {
    const needle = String(model || '').toLowerCase();
    for (const tr of document.querySelectorAll('table tbody tr')) {
      const text = (tr.textContent || '').replace(/\s+/g, ' ').toLowerCase();
      if (needle && text.indexOf(needle) === -1) {
        continue;
      }
      const href = ((tr.querySelector('a[href*="product_id="]') || {}).getAttribute('href')) || '';
      const m = href.match(/product_id=(\d+)/);
      if (m) {
        return m[1];
      }
      const box = tr.querySelector('input[name="selected[]"]');
      if (box && box.value) {
        return box.value;
      }
    }
    return '';
  }, spec.model);
  if (hit) {
    console.log('STATUS EXISTS product_id ' + hit + ' from_catalog');
  }
  return hit;
}

async function fillRelated(page, siblings) {
  if (!siblings.length) {
    return;
  }
  await page.evaluate((siblings) => {
    const box = document.getElementById('product-related');
    if (!box) {
      return;
    }
    box.querySelectorAll('div[id^="product-related"]').forEach((div) => div.remove());
    siblings.forEach((row) => {
      const id = String(row.id);
      const div = document.createElement('div');
      div.id = 'product-related' + id;
      div.innerHTML = '<i class="fa fa-minus-circle"></i> ' + String(row.name || row.model || id).replace(/</g, '') + '<input type="hidden" name="product_related[]" value="' + id + '">';
      box.appendChild(div);
    });
  }, siblings);
  console.log('related ' + siblings.map((s) => s.id).join(','));
}

async function fillLinks(page, spec, ids, key) {
  await page.click('a[href="#tab-links"]');
  await page.waitForTimeout(200);
  if (ids.manufacturerId) {
    await page.evaluate(({ name, id }) => {
      const inp = document.querySelector('input[name="manufacturer"]');
      const hid = document.querySelector('input[name="manufacturer_id"]');
      if (inp) {
        inp.value = name;
      }
      if (hid) {
        hid.value = id;
      }
    }, { name: spec.manufacturer, id: ids.manufacturerId });
    console.log('manufacturer_id ' + ids.manufacturerId);
  }
  if (ids.categoryId) {
    await page.evaluate(({ name, id }) => {
      const target = document.getElementById('product-category') || document.querySelector('#tab-links .well');
      if (target && !document.querySelector('input[name="product_category[]"][value="' + id + '"]')) {
        const div = document.createElement('div');
        div.id = 'product-category' + id;
        div.innerHTML = '<i class="fa fa-minus-circle"></i> ' + name + '<input type="hidden" name="product_category[]" value="' + id + '">';
        target.appendChild(div);
      }
      const main = document.querySelector('select[name="main_category_id"]');
      if (main) {
        main.value = id;
      }
    }, { name: CATEGORY.label, id: ids.categoryId });
    console.log('category_id ' + ids.categoryId);
  }
  await page.evaluate(() => {
    document.querySelectorAll('input[name="product_store[]"]').forEach((el) => {
      el.checked = true;
    });
  });
  const dl = page.locator('input[name="download"]');
  if (await dl.count()) {
    console.log('download_skip — attach ZIP in Catalog Downloads after draft');
  }
  await fillRelated(page, relatedFor(key));
}

async function fillSeo(page, spec, langMap) {
  const tab = page.locator('a[href="#tab-seo"]');
  if (!(await tab.count())) {
    return;
  }
  await tab.click();
  await page.waitForTimeout(200);
  const suffixById = {};
  (langMap || []).forEach((row) => {
    const key = localeKey(row.label);
    suffixById[row.id] = key === 'en' ? '-en' : key === 'ru' ? '-ru' : '';
  });
  await page.evaluate(({ spec, suffixById }) => {
    const inputs = [...document.querySelectorAll('#tab-seo input[name*="seo_url"], #tab-seo input[name*="keyword"]')];
    inputs.forEach((inp) => {
      const m = String(inp.name || '').match(/\[(\d+)\]\[(\d+)\]/);
      const langId = m ? String(m[2]) : '';
      const suffix = suffixById[langId] || '';
      inp.value = spec.slug + suffix;
    });
  }, { spec: spec, suffixById: suffixById });
}

async function fillOptions(page, spec) {
  await page.click('a[href="#tab-option"]');
  await page.waitForTimeout(200);
  const type = page.locator('input[name="option"]');
  if (!(await type.count())) {
    console.log('options_input_missing — add Додаткові послуги manually');
    return;
  }
  console.log('options_autocomplete_present — first run: add checkbox group + 3 values in UI if script skip');
}

async function saveProduct(page) {
  const btn = page.locator('button[type="submit"]').filter({ hasText: /зберегти|save|сохранить/i }).first();
  if (await btn.count()) {
    await btn.click();
  } else {
    await page.click('button[type="submit"]');
  }
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const alert = document.querySelector('.alert-danger, .alert-warning');
    const fields = [...document.querySelectorAll('.has-error, .text-danger')].map((el) => {
      return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean).slice(0, 25);
    return {
      ok: !alert && !/product\/add/i.test(window.location.href),
      url: window.location.href,
      alert: alert ? (alert.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) : '',
      fields: fields,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const { context } = await launchOrAttach();
  const page = pickAdminPage(context) || await context.newPage();
  await page.bringToFront().catch(() => {});

  if (args.loginOnly) {
    const href = page.url();
    const onAdmin = /oc-max\.com\/admin/i.test(href);
    if (!(await isLoggedIn(page)) && !/route=common\/login/i.test(href)) {
      if (!onAdmin || !/name="password"/i.test(await page.content().catch(() => ''))) {
        await page.goto(ADMIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
    }
    if (await isLoggedIn(page)) {
      const token = await readAdminToken(page);
      if (token) {
        persistToken(token);
      }
      console.log('session_reuse already_logged_in');
      console.log('STATUS READY');
    } else {
      console.log('STATUS WAITING_LOGIN');
      console.log('Login page is open. Enter captcha here. Write in chat when you are in. Script will not navigate.');
    }
    await new Promise(() => {});
    return;
  }

  const spec = MODULES[args.key];
  if (!spec) {
    console.log('STATUS BLOCKED unknown_module ' + args.key);
    process.exit(1);
  }
  if (!fs.existsSync(spec.zip)) {
    console.log('STATUS BLOCKED ZIP missing — ' + spec.zip);
    process.exit(1);
  }
  for (const file of Object.values(spec.descFiles)) {
    const p = path.join(spec.listingDir, file);
    if (!fs.existsSync(p)) {
      console.log('STATUS BLOCKED desc missing — ' + p);
      process.exit(1);
    }
  }

  if (!(await isLoggedIn(page))) {
    console.log('STATUS WAITING_LOGIN');
    console.log('Not logged in. Run --login, sign in, then write in chat. No navigation.');
    process.exit(0);
  }

  const token = (await readAdminToken(page)) || loadCachedToken();
  if (!token) {
    console.log('STATUS BLOCKED no_admin_token — stay on dashboard, then re-run');
    process.exit(1);
  }
  persistToken(token);
  console.log('admin_token_param ' + token.name);
  console.log('session_saved profile_cookies');

  if (args.patchH1) {
    const productId = spec.productId;
    if (!productId) {
      console.log('STATUS BLOCKED no_product_id');
      process.exit(1);
    }
    const edit = new URL(adminUrl('catalog/product/edit', token));
    edit.searchParams.set('product_id', productId);
    await page.goto(edit.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const fields = await page.evaluate(() => {
      return [...document.querySelectorAll('#tab-general input, #tab-general textarea')].map((el) => el.name).filter((n) => /h1|keyword|meta_/i.test(n || ''));
    });
    console.log('seo_fields ' + JSON.stringify(fields));
    await page.click('a[href="#tab-general"]');
    await fillH1AndKeywords(page, spec);
    const saved = await saveProduct(page);
    if (!saved.ok) {
      console.log('STATUS BLOCKED save_validation ' + JSON.stringify({
        alert: saved.alert,
        fields: saved.fields,
        url: String(saved.url || '').replace(/([?&](?:user_token|token)=)[^&]+/i, '$1***'),
      }));
      process.exit(1);
    }
    await page.goto(edit.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const after = await page.evaluate(() => {
      const pick = (name) => {
        const el = document.querySelector('[name="' + name + '"]');
        return el ? String(el.value || '').slice(0, 80) : '';
      };
      return {
        status: (document.querySelector('select[name="status"]') || {}).value,
        h1: {
          ru: pick('product_description[1][meta_h1]'),
          en: pick('product_description[2][meta_h1]'),
          uk: pick('product_description[3][meta_h1]'),
        },
        keys: {
          ru: pick('product_description[1][meta_keyword]'),
          en: pick('product_description[2][meta_keyword]'),
          uk: pick('product_description[3][meta_keyword]'),
        },
      };
    });
    console.log('after ' + JSON.stringify(after));
    console.log('STATUS H1_KEYWORDS');
    process.exit(0);
  }

  const existing = await findExistingProduct(page, token, spec);
  if (existing) {
    console.log('Use: node ocmax-media-fill.mjs ' + args.key + ' --product-id ' + existing);
    process.exit(0);
  }

  const manufacturerId = await ensureManufacturer(page, token, spec);
  const categoryId = await findShippingCategory(page, token);

  await page.goto(adminUrl(PRODUCT_ADD_ROUTE, token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!(await isLoggedIn(page))) {
    console.log('STATUS WAITING_LOGIN');
    console.log('Session dropped. Sign in in this window, then write in chat.');
    process.exit(0);
  }
  if (!/route=catalog\/product\/add/i.test(page.url()) && !/#tab-general/.test(await page.content())) {
    console.log('STATUS BLOCKED not_on_product_add ' + page.url().replace(/([?&](?:user_token|token)=)[^&]+/i, '$1***'));
    return;
  }

  await page.click('a[href="#tab-general"]');
  await fillGeneral(page, spec);
  await fillData(page, spec);
  await fillLinks(page, spec, { manufacturerId: manufacturerId, categoryId: categoryId }, args.key);
  await fillOptions(page, spec);
  await fillSeo(page, spec, await dumpLanguageMap(page));

  const saved = await saveProduct(page);
  if (!saved.ok) {
    console.log('STATUS BLOCKED save_validation ' + JSON.stringify({
      alert: saved.alert,
      fields: saved.fields,
      url: String(saved.url || '').replace(/([?&](?:user_token|token)=)[^&]+/i, '$1***'),
    }));
    process.exit(1);
  }
  await page.waitForTimeout(1500);
  const afterUrl = page.url();
  let productId = (afterUrl.match(/product_id=(\d+)/) || [])[1] || '';
  if (!productId) {
    productId = await page.evaluate(() => {
      const href = window.location.href;
      const fromUrl = (href.match(/product_id=(\d+)/) || [])[1];
      if (fromUrl) {
        return fromUrl;
      }
      const inputs = document.querySelectorAll('input[name="product_id"]');
      if (inputs.length && inputs[0].value) {
        return inputs[0].value;
      }
      return '';
    });
  }
  if (productId) {
    console.log('product_id ' + productId);
  }
  const storefrontUrl = 'https://oc-max.com/index.php?route=product/product&product_id=' + (productId || 'UNKNOWN');
  console.log('storefront_url ' + storefrontUrl);
  console.log('seo_url https://oc-max.com/' + spec.slug);
  console.log('STATUS DRAFT');
  console.log('Product saved Disabled. Enable only after a visual check.');
  console.log('Manufacturer / Download / Options / Images: confirm in admin (first-run calibrate).');
}

main().catch((err) => {
  console.log('STATUS BLOCKED ' + err.message);
  process.exit(1);
});
