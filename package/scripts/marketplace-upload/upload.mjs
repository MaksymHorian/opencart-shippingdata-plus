#!/usr/bin/env node
/**
 * Attach ZIP + thumbnails + gallery on opencartcode.com.
 * ZIP: POST /api/v1/author/products/{id}/version (same browser session).
 * Images: inject File objects into Alpine productEditForm, then submitForm().
 * Persistent Chrome profile. Does not click moderation.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.join(__dirname, '../image-screenshot/package.json')
);
const { chromium } = require('playwright');

const DEFAULT_CHANGELOG_UK =
  'перший публічний реліз модуля Meest ПОШТА для OpenCart 1.5-3.x';
const DEFAULT_CHANGELOG_EN =
  'First public release of the Meest POSHTA module for OpenCart 1.5-3.x';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.indexOf(`--${name}`) >= 0;
}

/** All values for a repeated CLI flag (e.g. multiple --edit-url). */
function argsAll(name) {
  const out = [];
  const flag = `--${name}`;
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) {
      out.push(process.argv[i + 1]);
    }
  }
  return out;
}

function firstExisting(dir, names) {
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return '';
}

/**
 * Gallery: screenshot_N.png by number, then other screenshot_*.png.
 * logo.png stays on thumbs only — never in the gallery.
 */
function collectGallery(dir, max) {
  const files = [];
  const names = fs.readdirSync(dir).filter((n) =>
    /^screenshot_.*\.(png|jpe?g|webp|gif)$/i.test(n)
  );
  const numbered = [];
  const named = [];
  for (const n of names) {
    const m = n.match(/^screenshot_(\d+)\./i);
    if (m) {
      numbered.push({ n: parseInt(m[1], 10), p: path.join(dir, n) });
    } else {
      named.push(path.join(dir, n));
    }
  }
  numbered.sort((a, b) => a.n - b.n);
  named.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  for (const item of numbered) {
    files.push(item.p);
  }
  files.push(...named);
  const unique = [...new Set(files)];
  if (unique.length > max) {
    const skipped = unique.slice(max).map((p) => path.basename(p));
    console.log(`gallery_truncated ${unique.length} -> ${max} skipped=${skipped.join(',')}`);
    return unique.slice(0, max);
  }
  return unique;
}

function mimeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.zip': 'application/zip',
    '.ocmod': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

function productIdFromUrl(url) {
  const m = String(url).match(/\/products\/(\d+)/);
  if (!m) {
    throw new Error(`Cannot parse product id from ${url}`);
  }
  return m[1];
}

function fileToPayload(filePath) {
  return {
    name: path.basename(filePath),
    mime: mimeOf(filePath),
    b64: fs.readFileSync(filePath).toString('base64'),
  };
}

async function waitLoggedIn(page, editUrl) {
  await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (page.url().includes('/login')) {
    console.log('WAITING_LOGIN');
    console.log(
      'Sign in in this Google Chrome window. Captcha should work here (not Playwright Chromium). Page will not reload.'
    );
    await page.waitForURL(
      (url) => {
        const href = typeof url === 'string' ? url : url.href;
        return !href.includes('/login');
      },
      { timeout: 30 * 60 * 1000 }
    );
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  await page.waitForSelector('#name_uk, [x-data="productEditForm()"]', {
    state: 'attached',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => window.Alpine && document.querySelector('[x-data="productEditForm()"]'),
    { timeout: 30000 }
  );
}

async function apiTokens(page) {
  return page.evaluate(() => {
    const csrf =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    const raw = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '';
    const xsrf = raw ? decodeURIComponent(raw) : '';
    return { csrf, xsrf, origin: location.origin };
  });
}

async function fetchJson(page, url, init) {
  return page.evaluate(async ({ url, init }) => {
    const response = await fetch(url, init);
    let data = null;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { raw: text.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, data };
  }, { url, init });
}

async function listVersions(page, productId) {
  const tokens = await apiTokens(page);
  return fetchJson(page, `/api/v1/author/products/${productId}/versions`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'uk',
      'X-CSRF-TOKEN': tokens.csrf,
      'X-XSRF-TOKEN': tokens.xsrf,
    },
  });
}

function versionNames(payload) {
  const list = payload?.data?.versions || payload?.data?.data || [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((v) => String(v.version || v.name || '')).filter(Boolean);
}

async function uploadZipViaApi(page, productId, zipPath, version, changelogUk, changelogEn) {
  // Version POST is a free file update — never send price / update_price / version_price.
  const tokens = await apiTokens(page);
  const url = `${tokens.origin}/api/v1/author/products/${productId}/version`;
  const res = await page.request.post(url, {
    timeout: 180000,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'uk',
      'X-CSRF-TOKEN': tokens.csrf,
      'X-XSRF-TOKEN': tokens.xsrf,
      Origin: tokens.origin,
      Referer: page.url(),
    },
    multipart: {
      version,
      file: {
        name: path.basename(zipPath),
        mimeType: mimeOf(zipPath),
        buffer: fs.readFileSync(zipPath),
      },
      modified_files: '',
      notify_buyers: '0',
      allow_older_purchase: '1',
      'translations[uk][changes]': changelogUk,
      'translations[en][changes]': changelogEn,
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = { raw: (await res.text()).slice(0, 500) };
  }
  return { ok: res.ok(), status: res.status(), data };
}

async function uploadZipInPage(page, productId, zipPath, version, changelogUk, changelogEn) {
  const payload = fileToPayload(zipPath);
  const tokens = await apiTokens(page);
  return page.evaluate(
    async ({ productId, payload, version, changelogUk, changelogEn, tokens }) => {
      const bin = Uint8Array.from(atob(payload.b64), (c) => c.charCodeAt(0));
      const file = new File([bin], payload.name, { type: payload.mime });
      const formData = new FormData();
      formData.append('version', version);
      formData.append('file', file);
      formData.append('modified_files', '');
      formData.append('notify_buyers', '0');
      formData.append('allow_older_purchase', '1');
      formData.append('translations[uk][changes]', changelogUk);
      formData.append('translations[en][changes]', changelogEn);
      const response = await fetch(`/api/v1/author/products/${productId}/version`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'uk',
          'X-CSRF-TOKEN': tokens.csrf,
          'X-XSRF-TOKEN': tokens.xsrf,
        },
        body: formData,
      });
      let data = null;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = { raw: text.slice(0, 500) };
      }
      return { ok: response.ok, status: response.status, data };
    },
    { productId, payload, version, changelogUk, changelogEn, tokens }
  );
}

async function injectFile(page, filePath, kind) {
  const payload = fileToPayload(filePath);
  await page.evaluate(({ payload, kind }) => {
    const bin = Uint8Array.from(atob(payload.b64), (c) => c.charCodeAt(0));
    const file = new File([bin], payload.name, { type: payload.mime });
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    if (kind === 'square') {
      data.squareThumbnailFile = file;
      data.squareThumbnailPreview = URL.createObjectURL(file);
    } else if (kind === 'thumb') {
      data.thumbnailFile = file;
      data.thumbnailPreview = URL.createObjectURL(file);
    } else if (kind === 'gallery') {
      data.allImages.push({
        id: 'new_' + Date.now() + '_' + Math.random(),
        type: 'new',
        src: URL.createObjectURL(file),
        file: file,
      });
    }
  }, { payload, kind });
}

async function replaceExistingGallery(page) {
  return page.evaluate(() => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    let n = 0;
    for (const img of data.allImages || []) {
      if (img.type === 'existing' && img.path) {
        data.imagesToDelete.push(img.path);
        n += 1;
      }
    }
    data.allImages = [];
    return n;
  });
}

async function setDescription(page, lang, html) {
  await page.waitForFunction(
    (langCode) => {
      const el = document.querySelector('#quill_description_' + langCode);
      return !!(el && (el.__quill || (window.Quill && Quill.find(el))));
    },
    lang,
    { timeout: 20000 }
  );
  await page.evaluate(({ lang, html }) => {
    const el = document.querySelector('#quill_description_' + lang);
    const quill = el.__quill || Quill.find(el);
    quill.setText('');
    quill.clipboard.dangerouslyPasteHTML(html);
    const input = document.querySelector(
      'input[name="translations[' + lang + '][description]"]'
    );
    if (input) {
      input.value = quill.root.innerHTML;
    }
  }, { lang, html });
}

async function readPrices(page) {
  return page.evaluate(() => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    const form = data.form || {};
    const raw =
      data.productOptions ||
      form.productOptions ||
      form.options ||
      [];
    const opts = raw.map((o, i) => ({
      i,
      id: o.id,
      price: o.price,
      name_uk: o.translations && o.translations.uk && o.translations.uk.name,
      name_en: o.translations && o.translations.en && o.translations.en.name,
    }));
    return {
      price: form.price,
      original_price: form.original_price,
      pricing_type: form.pricing_type,
      options: opts,
    };
  });
}

async function writePrices(page, { price, originalPrice }) {
  await page.evaluate(({ price, originalPrice }) => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    if (price !== '') {
      data.form.price = price;
    }
    if (originalPrice !== '') {
      data.form.original_price = originalPrice;
    }
  }, { price, originalPrice });
}

async function leaveVersionUpdatePriceEmpty(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[x-data="productEditForm()"]');
    const data = Alpine.$data(root);
    const form = data.form || {};
    const cleared = [];
    const walk = (obj, prefix) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return;
      }
      Object.keys(obj).forEach((k) => {
        const path = prefix ? prefix + '.' + k : k;
        const v = obj[k];
        if (
          typeof v !== 'object' &&
          /(?:version|update|file).*(?:price|cost)|(?:price|cost).*(?:version|update|file)/i.test(path) &&
          !/^price$|^original_price$/.test(k)
        ) {
          cleared.push({ path: path, before: v });
          if (typeof v === 'number') {
            obj[k] = 0;
          } else if (typeof v === 'boolean') {
            obj[k] = false;
          } else {
            obj[k] = '';
          }
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          walk(v, path);
        }
      });
    };
    walk(form, '');
    const boxes = [];
    document.querySelectorAll('input, textarea').forEach((el) => {
      const wrap = el.closest('label') || el.closest('div') || el.parentElement;
      const text = ((wrap && wrap.textContent) || '').replace(/\s+/g, ' ').trim();
      const name = el.name || el.getAttribute('x-model') || '';
      if (
        !/ціна оновлен|цена обновл|update price|version price|price for (this )?update/i.test(
          `${text} ${name}`
        )
      ) {
        return;
      }
      boxes.push({
        text: text.slice(0, 80),
        name: name,
        before: el.value,
      });
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return { keys: cleared, boxes: boxes };
  });
}

async function saveExtras(page, extras) {
  return page.evaluate(async (extras) => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    const results = [];
    for (let i = 0; i < extras.length; i++) {
      const value = extras[i];
      const option = data.productOptions && data.productOptions[i];
      if (!option || value === '') {
        continue;
      }
      option.price = value;
      await data.updateOption(i);
      results.push({
        i,
        id: option.id,
        price: option.price,
        toast: data.toast && data.toast.message,
        type: data.toast && data.toast.type,
      });
    }
    return results;
  }, extras);
}

async function setFeatures(page, uk, en) {
  await page.evaluate(({ uk, en }) => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    data.form.featuresPerLang.uk = uk;
    data.form.featuresPerLang.en = en;
  }, { uk, en });
}

async function readFormMeta(page) {
  return page.evaluate(async () => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    const form = data.form || {};
    const formKeys = Object.keys(form).filter((k) =>
      /slug|categor|url|type|additional|domain|later|license/i.test(k)
    );
    const dataKeys = Object.keys(data).filter((k) =>
      /slug|categor|url|additional|domain|later|license/i.test(k)
    );
    const pick = {};
    for (const k of formKeys) {
      const v = form[k];
      pick[k] = Array.isArray(v) ? v.slice(0, 20) : v;
    }
    const extra = form.additional_category_ids || [];
    const options = [...document.querySelectorAll('select option, [data-category-id], input[type="checkbox"][value]')]
      .map((el) => ({
        tag: el.tagName,
        name: el.getAttribute('name') || el.getAttribute('x-model') || '',
        value: el.value || el.getAttribute('data-category-id') || '',
        text: (el.textContent || '').trim().slice(0, 80),
        checked: !!(el.checked || el.selected),
      }))
      .filter((o) => /categor|додатк|доставк|кошик|продуктив|обмін|замовл/i.test(`${o.name} ${o.text}`));
    return {
      slug: form.slug,
      type: form.type,
      category_id: form.category_id,
      formKeys,
      dataKeys,
      pick,
      extra,
      options: options.slice(0, 80),
      html_cats: [...document.querySelectorAll('label, span, li')]
        .map((el) => (el.textContent || '').trim())
        .filter((t) => /Продуктивн|Кошик|Обмін|Управління замов|Доставка/i.test(t))
        .slice(0, 40),
      api: await (async () => {
        const paths = [
          '/api/v1/categories',
          '/api/v1/author/categories',
          '/api/v1/product-categories',
        ];
        const out = {};
        for (const p of paths) {
          try {
            const r = await fetch(p, { credentials: 'include', headers: { Accept: 'application/json' } });
            const t = await r.text();
            out[p] = { status: r.status, body: t.slice(0, 1500) };
          } catch (e) {
            out[p] = { error: String(e) };
          }
        }
        return out;
      })(),
    };
  });
}

async function applyDomainFlags(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[x-data="productEditForm()"]');
    const data = Alpine.$data(root);
    const form = data.form || {};
    const before = {
      requires_domain: !!form.requires_domain,
      allow_domain_later: !!form.allow_domain_later,
    };
    const sync = (model, want) => {
      const el = document.querySelector('input[type="checkbox"][x-model="' + model + '"]');
      if (!el || !!el.checked === want) {
        return null;
      }
      el.checked = want;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { name: model, after: want };
    };
    form.requires_domain = true;
    form.allow_domain_later = false;
    const boxes = [sync('form.requires_domain', true), sync('form.allow_domain_later', false)].filter(Boolean);
    form.requires_domain = true;
    form.allow_domain_later = false;
    return {
      before: before,
      after: {
        requires_domain: !!form.requires_domain,
        allow_domain_later: !!form.allow_domain_later,
      },
      boxes: boxes,
    };
  });
}

async function submitProductWithDomain(page, enabled) {
  if (enabled) {
    const domainRes = await applyDomainFlags(page);
    console.log('domain_flags ' + JSON.stringify(domainRes));
  }
  return submitProduct(page);
}

async function writeFormMeta(page, { slug, extraCategoryIds }) {
  await page.evaluate(({ slug, extraCategoryIds }) => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    if (slug) {
      data.form.slug = slug;
    }
    if (extraCategoryIds && extraCategoryIds.length) {
      data.form.additional_category_ids = extraCategoryIds.map((id) =>
        Number.isNaN(Number(id)) ? id : Number(id)
      );
    }
  }, { slug, extraCategoryIds });
}

function parseExtraCategoryIds(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = parseInt(s, 10);
      return Number.isNaN(n) ? s : n;
    });
}

async function submitProduct(page) {
  const nav = page.waitForURL(/\/author\/products\/\d+\/edit/, {
    timeout: 90000,
    waitUntil: 'domcontentloaded',
  }).catch(() => null);

  const result = await page.evaluate(async () => {
    const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
    await data.submitForm();
    return {
      toast: {
        show: !!(data.toast && data.toast.show),
        type: data.toast && data.toast.type,
        message: data.toast && data.toast.message,
      },
      errors: data.errors || {},
    };
  });

  await nav;
  return result;
}

async function main() {
  let editUrls = argsAll('edit-url');
  if (!editUrls.length) {
    const single = arg('edit-url');
    if (single) {
      editUrls = [single];
    }
  }
  const zip = arg('zip');
  const galleryDir = arg('gallery-dir');
  const maxGallery = parseInt(arg('max-gallery', '30'), 10);
  const version = arg('version', '');
  const changelogUk = arg('changelog-uk', DEFAULT_CHANGELOG_UK);
  const changelogEn = arg('changelog-en', DEFAULT_CHANGELOG_EN);
  const featuresJson = arg('features-json');
  const descriptionUk = arg('description-uk');
  const descriptionEn = arg('description-en');
  const skipZip = hasFlag('skip-zip');
  const forceZip = hasFlag('force-zip');
  const dumpPrices = hasFlag('dump-prices');
  const dumpProducts = hasFlag('dump-products');
  const setPrice = arg('price');
  const setOriginalPrice = arg('original-price');
  const setExtras = arg('extras');
  const dumpForm = hasFlag('dump-form');
  const setSlug = arg('slug');
  const setExtraCategories = arg('extra-categories');
  const uncheckDomainLaterFlag = hasFlag('uncheck-domain-later');

  let square = arg('square');
  let thumb = arg('thumb');
  if (galleryDir) {
    if (!square) {
      square = firstExisting(galleryDir, ['logo_opencartcode_1.png', 'logo.png']);
    }
    if (!thumb) {
      thumb = firstExisting(galleryDir, ['logo_opencartcode_2.png', 'logo.png']);
    }
  }

  if (
    !editUrls.length ||
    (!zip &&
      !skipZip &&
      !galleryDir &&
      !featuresJson &&
      !descriptionUk &&
      !descriptionEn &&
      !dumpPrices &&
      !dumpProducts &&
      !dumpForm &&
      !setSlug &&
      !setExtraCategories &&
      !setPrice &&
      !setOriginalPrice &&
      !setExtras &&
      !uncheckDomainLaterFlag)
  ) {
    throw new Error(
      'Usage: --edit-url --zip [--skip-zip] [--gallery-dir] [--features-json] [--description-uk] [--description-en] [--dump-prices] [--price] [--original-price] [--extras] [--uncheck-domain-later]'
    );
  }
  for (const p of [zip, square, thumb]) {
    if (p && !fs.existsSync(p)) {
      throw new Error(`Missing file: ${p}`);
    }
  }
  const gallery = galleryDir ? collectGallery(galleryDir, maxGallery) : [];
  if (galleryDir && gallery.length === 0) {
    throw new Error(`No screenshot_* in ${galleryDir}`);
  }

  let features = null;
  if (featuresJson) {
    features = JSON.parse(fs.readFileSync(featuresJson, 'utf8'));
    if (!Array.isArray(features.uk) || !Array.isArray(features.en)) {
      throw new Error('features-json must have uk[] and en[]');
    }
  }
  const descriptions = {};
  if (descriptionUk) {
    if (!fs.existsSync(descriptionUk)) {
      throw new Error(`Missing file: ${descriptionUk}`);
    }
    descriptions.uk = fs.readFileSync(descriptionUk, 'utf8');
  }
  if (descriptionEn) {
    if (!fs.existsSync(descriptionEn)) {
      throw new Error(`Missing file: ${descriptionEn}`);
    }
    descriptions.en = fs.readFileSync(descriptionEn, 'utf8');
  }

  const userDataDir = path.join(__dirname, '.profile-chrome');
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    args: [
      '--start-maximized',
      '--window-position=0,0',
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: null,
    acceptDownloads: true,
    ignoreDefaultArgs: ['--enable-automation'],
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.bringToFront();
  console.log('CHROME_OPEN');

  try {
    for (let batchIdx = 0; batchIdx < editUrls.length; batchIdx++) {
      const editUrl = editUrls[batchIdx];
      console.log(`batch_item=${batchIdx + 1}/${editUrls.length} url=${editUrl}`);
    await waitLoggedIn(page, editUrl);
    if (dumpProducts) {
      const list = await fetchJson(page, '/api/v1/author/products', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Accept-Language': 'uk' },
      });
      const items = list?.data?.products || list?.data?.data || list?.data || [];
      const slim = (Array.isArray(items) ? items : []).map((p) => ({
        id: p.id,
        slug: p.slug,
        status: p.status,
        price: p.price,
        version: p.version || (p.latest_version && p.latest_version.version),
        name: (p.translations && p.translations.uk && p.translations.uk.name) || p.name,
      }));
      console.log(`products ${JSON.stringify(slim)}`);
      if (!zip && !galleryDir && !featuresJson && !descriptionUk && !setPrice && !setSlug && !uncheckDomainLaterFlag && !setExtras) {
        console.log('DRAFT_SAVED');
        return;
      }
    }
    const productId = productIdFromUrl(page.url() || editUrl);
    console.log(`product_id=${productId}`);

    const before = await listVersions(page, productId);
    const beforeNames = versionNames(before);
    console.log(`versions_before=${beforeNames.join(',') || '(none)'} status=${before.status}`);

    if (!skipZip && zip && !version) {
      throw new Error('ZIP upload requires --version (do not default to 0.1.0)');
    }

    const zipAlready =
      version &&
      (beforeNames.includes(version) || beforeNames.some((n) => n.indexOf(version) === 0));
    if (skipZip || (zipAlready && !forceZip)) {
      console.log(zipAlready ? `zip_skip already ${version}` : 'zip_skip flag');
    } else if (zip) {
      let zipRes;
      try {
        zipRes = await uploadZipViaApi(
          page,
          productId,
          zip,
          version,
          changelogUk,
          changelogEn
        );
      } catch (e) {
        zipRes = { ok: false, status: 0, data: { message: String(e && e.message ? e.message : e) } };
      }
      console.log(`zip_api status=${zipRes.status} ok=${zipRes.ok}`);
      if (zipRes.data && zipRes.data.message) {
        console.log(`zip_api message=${zipRes.data.message}`);
      }
      if (zipRes.data && zipRes.data.errors) {
        console.log(`zip_api errors=${JSON.stringify(zipRes.data.errors)}`);
      }

      if (!zipRes.ok) {
        console.log('zip_api fallback=in_page_fetch');
        zipRes = await uploadZipInPage(page, productId, zip, version, changelogUk, changelogEn);
        console.log(`zip_in_page status=${zipRes.status} ok=${zipRes.ok}`);
        if (zipRes.data && zipRes.data.message) {
          console.log(`zip_in_page message=${zipRes.data.message}`);
        }
        if (zipRes.data && zipRes.data.errors) {
          console.log(`zip_in_page errors=${JSON.stringify(zipRes.data.errors)}`);
        }
      }

      const afterZip = await listVersions(page, productId);
      const afterNames = versionNames(afterZip);
      const zipPresent =
        afterNames.includes(version) || afterNames.some((n) => n.indexOf(version) === 0);
      if (!zipRes.ok && !zipPresent) {
        throw new Error(
          `ZIP API failed (${zipRes.status}): ${JSON.stringify(zipRes.data).slice(0, 500)}`
        );
      }
      if (!zipRes.ok && zipPresent) {
        console.log(`zip_already_present version=${version}`);
      } else if (zipPresent) {
        console.log(`zip_ok version=${version}`);
      } else {
        throw new Error(`ZIP posted but version ${version} missing from GET /versions`);
      }
    }

    if (dumpForm) {
      const meta = await readFormMeta(page);
      console.log(`form_meta ${JSON.stringify(meta)}`);
    }
    const extraIds = parseExtraCategoryIds(setExtraCategories);
    const wantMetaChange = !!(setSlug || extraIds.length);
    if (wantMetaChange) {
      await writeFormMeta(page, { slug: setSlug, extraCategoryIds: extraIds });
      const afterMeta = await readFormMeta(page);
      console.log(`form_set slug=${afterMeta.slug} extra=${JSON.stringify(afterMeta.extra)}`);
    }
    if (dumpForm && !wantMetaChange && !setPrice && !gallery.length && !features && !descriptions.uk && !descriptions.en && !uncheckDomainLaterFlag) {
      console.log('DRAFT_SAVED');
      console.log(`url=${page.url()}`);
      return;
    }

    const pricesBefore = await readPrices(page);
    console.log(`prices_before ${JSON.stringify(pricesBefore)}`);

    const extrasList = setExtras
      ? setExtras.split(',').map((s) => s.trim())
      : [];
    const wantPriceChange = !!(setPrice || setOriginalPrice || extrasList.length);
    const wantFormPatch = !!(wantPriceChange || wantMetaChange || uncheckDomainLaterFlag);
    if (wantPriceChange) {
      await writePrices(page, {
        price: setPrice,
        originalPrice: setOriginalPrice,
      });
      if (extrasList.length) {
        const extraRes = await saveExtras(page, extrasList);
        console.log(`options_saved ${JSON.stringify(extraRes)}`);
      }
      const pricesSet = await readPrices(page);
      console.log(`prices_set ${JSON.stringify(pricesSet)}`);
    }

    const versionPriceRes = await leaveVersionUpdatePriceEmpty(page);
    console.log('version_update_price ' + JSON.stringify(versionPriceRes));

    if (dumpPrices && !wantPriceChange && !wantMetaChange && !uncheckDomainLaterFlag && !gallery.length && !features && !descriptions.uk && !descriptions.en) {
      console.log('DRAFT_SAVED');
      console.log(`url=${page.url()}`);
      return;
    }

    const wantContent = !!(square || thumb || gallery.length || features || descriptions.uk || descriptions.en);
    if (wantContent || wantFormPatch) {
      if (wantContent) {
        await page.getByRole('button', { name: 'Контент' }).first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(300);
      }

      if (features) {
        await setFeatures(page, features.uk, features.en);
        console.log(`features uk=${features.uk.length} en=${features.en.length}`);
      }
      if (descriptions.uk) {
        await setDescription(page, 'uk', descriptions.uk);
        console.log('description_uk set');
      }
      if (descriptions.en) {
        await setDescription(page, 'en', descriptions.en);
        console.log('description_en set');
      }

      // PHP default max_file_uploads=20: 2 thumbs + 18 gallery per request.
      const galleryChunk = 18;
      const batches = [];
      if (gallery.length) {
        for (let i = 0; i < gallery.length; i += galleryChunk) {
          batches.push({
            files: gallery.slice(i, i + galleryChunk),
            thumbs: i === 0,
            replace: i === 0,
          });
        }
      } else if (square || thumb) {
        batches.push({ files: [], thumbs: true, replace: false });
      }

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        if (b > 0) {
          await page.waitForFunction(
            () => window.Alpine && document.querySelector('[x-data="productEditForm()"]'),
            { timeout: 30000 }
          );
        }
        if (batch.replace) {
          const deleted = await replaceExistingGallery(page);
          console.log(`gallery_marked_delete=${deleted}`);
        }
        if (batch.thumbs && square) {
          await injectFile(page, square, 'square');
          console.log(`square ← ${path.basename(square)}`);
        }
        if (batch.thumbs && thumb) {
          await injectFile(page, thumb, 'thumb');
          console.log(`thumb ← ${path.basename(thumb)}`);
        }
        for (const f of batch.files) {
          await injectFile(page, f, 'gallery');
          console.log(`gallery + ${path.basename(f)}`);
        }

        const newCount = await page.evaluate(() => {
          const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
          return {
            neu: data.allImages.filter((img) => img.type === 'new').length,
            total: data.allImages.length,
            del: data.imagesToDelete.length,
            square: !!(data.squareThumbnailFile && data.squareThumbnailFile.name),
            thumb: !!(data.thumbnailFile && data.thumbnailFile.name),
          };
        });
        console.log(
          `alpine_batch=${b + 1}/${batches.length} new=${newCount.neu} total=${newCount.total} delete=${newCount.del} square=${newCount.square} thumb=${newCount.thumb}`
        );
        if (newCount.neu !== batch.files.length) {
          throw new Error(`Gallery inject mismatch: ${newCount.neu} !== ${batch.files.length}`);
        }

        const submitted = await submitProductWithDomain(page, uncheckDomainLaterFlag);
        console.log(
          `submit toast=${submitted.toast.type || '-'} ${submitted.toast.message || ''}`
        );
        if (submitted.toast.type === 'error') {
          throw new Error(`Product save error: ${submitted.toast.message}`);
        }
        if (submitted.errors && Object.keys(submitted.errors).length) {
          throw new Error(`Product save 422: ${JSON.stringify(submitted.errors)}`);
        }

        await page.waitForTimeout(1500);
        if (!page.url().includes(`/products/${productId}/edit`)) {
          await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
        await page.waitForFunction(
          () => window.Alpine && document.querySelector('[x-data="productEditForm()"]'),
          { timeout: 30000 }
        );
      }

      if (!batches.length && (features || descriptions.uk || descriptions.en || wantPriceChange || wantMetaChange || uncheckDomainLaterFlag)) {
        const submitted = await submitProductWithDomain(page, uncheckDomainLaterFlag);
        console.log(
          `submit toast=${submitted.toast.type || '-'} ${submitted.toast.message || ''}`
        );
        if (submitted.toast.type === 'error') {
          throw new Error(`Product save error: ${submitted.toast.message}`);
        }
      }

      const leftover = await page.evaluate(() => {
        const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
        const slug = String((data.form && data.form.slug) || '');
        const hay = (data.allImages || [])
          .map((img) => `${img.src || ''} ${img.path || ''}`)
          .join(' ');
        const thumbs = `${data.thumbnailPreview || ''} ${data.squareThumbnailPreview || ''}`;
        const blob = `${hay} ${thumbs}`;
        if (!/nova-poshta|novaposhta/i.test(slug) && /nova-poshta|novaposhta/i.test(blob)) {
          return 'novaposhta';
        }
        if (!/ukrposhta/i.test(slug) && /ukrposhta/i.test(blob)) {
          return 'ukrposhta';
        }
        return '';
      });
      if (leftover) {
        throw new Error(`Old ${leftover} images still present after save`);
      }
      const savedCount = await page.evaluate(() => {
        const data = Alpine.$data(document.querySelector('[x-data="productEditForm()"]'));
        return (data.allImages || []).length;
      });
      console.log(`gallery_saved=${savedCount} wanted=${gallery.length}`);
      console.log('gallery_ok');
    }

    const finalVers = versionNames(await listVersions(page, productId));
    console.log(`versions_after=${finalVers.join(',')}`);
    console.log('DRAFT_SAVED');
    console.log(`url=${page.url()}`);
    }
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
