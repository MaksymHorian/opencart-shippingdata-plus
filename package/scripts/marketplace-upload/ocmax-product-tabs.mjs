/**
 * oc-max.com — product attributes, extra-service options, related siblings.
 *   node ocmax-product-tabs.mjs [novaposhta|meest|ukrposhta|rozetka_delivery]
 *   node ocmax-product-tabs.mjs --related-only --all
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODULES, relatedFor } from './ocmax-modules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const PROFILE = path.join(__dirname, '.profile-ocmax-chrome');
const TOKEN_FILE = path.join(__dirname, '.ocmax-admin-token');
const CDP_PORT = 9333;
const LANG = { ru: '1', en: '2', uk: '3' };

function buildAttributes(spec) {
  const compat = spec.compat || 'OpenCart 2.1–3.0, ocStore 2.3–3.0';
  const ver = spec.version || '';
  return [
    { ru: 'Совместимость', uk: 'Сумісність', en: 'Compatibility', values: { uk: compat, en: compat, ru: compat } },
    { ru: 'Лицензия', uk: 'Ліцензія', en: 'License', values: { uk: 'Безстрокова', en: 'Lifetime', ru: 'Бессрочная' } },
    { ru: 'Версия', uk: 'Версія', en: 'Version', values: { uk: ver, en: ver, ru: ver } },
    { ru: 'Разработчик', uk: 'Розробник', en: 'Developer', values: { uk: 'OC Max', en: 'OC Max', ru: 'OC Max' } },
    { ru: 'Язык', uk: 'Мова', en: 'Language', values: { uk: 'Українська, English, Русский', en: 'Ukrainian, English, Russian', ru: 'Украинский, English, Русский' } },
  ];
}

const OPTION_PRICES = [
  { match: /встановл|установ|install/i, usd: '8.89' },
  { match: /оновлен|обновл|update/i, usd: '8.89' },
  { match: /адаптац|adapt/i, usd: '13.33' },
  { match: /підтрим|поддерж|support/i, usd: '6.67' },
];

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

async function apiJson(page, token, route, extra) {
  return page.evaluate(async ({ token, route, extra }) => {
    const u = new URL(location.origin + '/admin/index.php');
    u.searchParams.set('route', route);
    u.searchParams.set(token.name, token.value);
    Object.keys(extra || {}).forEach((k) => u.searchParams.set(k, extra[k]));
    const r = await fetch(u.pathname + u.search, { credentials: 'same-origin' });
    return r.json();
  }, { token: token, route: route, extra: extra || {} });
}

async function clickSave(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('button[form="form-product"]') || document.querySelector('.page-header button.btn-primary');
    if (btn) {
      btn.click();
    }
  });
  await page.waitForTimeout(2200);
}

async function deleteOldZips(page, token, keepName) {
  await page.goto(adminUrl('catalog/download', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const rows = await page.evaluate((keep) => {
    return [...document.querySelectorAll('#form-download table tbody tr, table tbody tr')].map((tr) => {
      const box = tr.querySelector('input[name="selected[]"]');
      return {
        id: box ? box.value : '',
        text: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        keep: (tr.textContent || '').includes(keep),
      };
    });
  }, keepName);
  console.log('downloads ' + JSON.stringify(rows));
  const stale = rows.filter((r) => r.id && !r.keep && /novaposhta|нова(я)?\s*почт|nova\s*poshta/i.test(r.text));
  if (!stale.length) {
    console.log('zip_no_old_np');
    return rows.filter((r) => r.keep).map((r) => r.id);
  }
  const posted = await page.evaluate(async (ids) => {
    const form = document.getElementById('form-download');
    if (!form) {
      return { ok: false, err: 'no_form' };
    }
    const body = new URLSearchParams();
    ids.forEach((id) => body.append('selected[]', id));
    const r = await fetch(form.action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { ok: r.ok, status: r.status, ids: ids };
  }, stale.map((r) => r.id));
  console.log('zip_deleted ' + JSON.stringify(posted));
  return rows.filter((r) => r.keep).map((r) => r.id);
}

async function fillRelated(page, siblings) {
  await page.evaluate(() => {
    const tab = document.querySelector('a[href="#tab-links"]');
    if (tab) {
      tab.click();
    }
  });
  await page.waitForTimeout(200);
  if (!siblings.length) {
    console.log('related_none');
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
  console.log('related_set ' + siblings.map((s) => s.id).join(','));
}

async function fillAttributes(page, token, attributes) {
  const found = [];
  for (const spec of attributes) {
    const json = await apiJson(page, token, 'catalog/attribute/autocomplete', { filter_name: spec.ru });
    const hit = (json || []).find((i) => i.name && (i.name.includes(spec.ru) || i.name.includes(spec.uk) || i.name.includes(spec.en)));
    if (hit) {
      found.push({ id: String(hit.attribute_id), spec: spec });
    } else {
      console.log('attribute_miss ' + spec.ru);
    }
  }
  await page.evaluate(({ found, LANG }) => {
    const tab = document.querySelector('a[href="#tab-attribute"]');
    if (tab) {
      tab.click();
    }
    document.querySelectorAll('#attribute tbody tr[id^="attribute-row"]').forEach((tr) => tr.remove());
    if (typeof window.attribute_row !== 'undefined') {
      window.attribute_row = 0;
    }
    found.forEach((row, i) => {
      if (typeof window.addAttribute === 'function') {
        window.addAttribute();
      }
      const nameInp = document.querySelector('input[name="product_attribute[' + i + '][name]"]');
      const idInp = document.querySelector('input[name="product_attribute[' + i + '][attribute_id]"]');
      if (nameInp) {
        nameInp.value = row.spec.ru;
      }
      if (idInp) {
        idInp.value = row.id;
      }
      Object.keys(LANG).forEach((key) => {
        const ta = document.querySelector('textarea[name="product_attribute[' + i + '][product_attribute_description][' + LANG[key] + '][text]"]');
        if (ta) {
          ta.value = row.spec.values[key];
        }
      });
    });
  }, { found: found, LANG: LANG });
  console.log('attributes_set ' + found.length);
}

async function fillOptions(page, token) {
  const json = await apiJson(page, token, 'catalog/option/autocomplete', { filter_name: 'Дополн' });
  const raw = (json || []).find((i) => /додатков|дополнительн|extra/i.test(i.name || '')) || (json || [])[0];
  if (!raw) {
    console.log('STATUS BLOCKED no_catalog_option');
    return false;
  }
  const item = {
    label: raw.name,
    value: String(raw.option_id),
    type: raw.type,
    option_value: raw.option_value || [],
  };
  console.log('option_catalog ' + item.value + ' values=' + item.option_value.length);

  await page.evaluate((item) => {
    const tab = document.querySelector('a[href="#tab-option"]');
    if (tab) {
      tab.click();
    }
    document.querySelectorAll('#option a[href^="#tab-option"]').forEach((a) => {
      const pane = document.querySelector(a.getAttribute('href'));
      if (a.parentElement) {
        a.parentElement.remove();
      }
      if (pane) {
        pane.remove();
      }
    });
    if (typeof window.option_row !== 'undefined') {
      window.option_row = 0;
    }
    if (typeof window.option_value_row !== 'undefined') {
      window.option_value_row = 0;
    }
    const $inp = window.jQuery && window.jQuery('input[name="option"]');
    if ($inp && $inp.data && $inp.data('ui-autocomplete')) {
      $inp.autocomplete('search', item.label);
    }
  }, item);
  await page.waitForTimeout(400);

  const attached = await page.evaluate((item) => {
    const $ = window.jQuery;
    if (!$ || !$('input[name="option"]').length) {
      return 'no_jq';
    }
    const inst = $('input[name="option"]').data('autocomplete') || $('input[name="option"]').data('ui-autocomplete');
    if (inst && inst.select) {
      inst._trigger('select', null, { item: item });
      return 'trigger';
    }
    const handlers = $._data && $._data(document.querySelector('input[name="option"]'), 'events');
    return handlers ? 'has_events' : 'no_handler';
  }, item);

  if (attached !== 'trigger') {
    await page.evaluate((item) => {
      const $ = window.jQuery;
      const row = typeof window.option_row === 'number' ? window.option_row : 0;
      let html = '<div class="tab-pane active" id="tab-option' + row + '">';
      html += '<input type="hidden" name="product_option[' + row + '][product_option_id]" value="" />';
      html += '<input type="hidden" name="product_option[' + row + '][name]" value="' + item.label + '" />';
      html += '<input type="hidden" name="product_option[' + row + '][option_id]" value="' + item.value + '" />';
      html += '<input type="hidden" name="product_option[' + row + '][type]" value="' + item.type + '" />';
      html += '<div class="form-group"><label class="col-sm-2 control-label">Обов\'язково</label><div class="col-sm-10"><select name="product_option[' + row + '][required]" class="form-control"><option value="1">Так</option><option value="0" selected="selected">Ні</option></select></div></div>';
      html += '<div class="table-responsive"><table id="option-value' + row + '" class="table table-striped table-bordered table-hover">';
      html += '<thead><tr><td>Значение</td><td>Кол-во</td><td>Вычитать</td><td>Цена</td><td>Баллы</td><td>Вес</td><td></td></tr></thead><tbody></tbody></table></div>';
      html += '<select id="option-values' + row + '" style="display:none">';
      (item.option_value || []).forEach((v) => {
        html += '<option value="' + v.option_value_id + '">' + v.name + '</option>';
      });
      html += '</select></div>';
      const content = document.querySelector('#tab-option .tab-content');
      if (content) {
        content.insertAdjacentHTML('beforeend', html);
      }
      const ul = document.querySelector('#option');
      if (ul) {
        const li = document.createElement('li');
        li.className = 'active';
        li.innerHTML = '<a href="#tab-option' + row + '" data-toggle="tab">' + item.label + '</a>';
        const last = ul.querySelector('li:last-child');
        ul.insertBefore(li, last);
      }
      if (typeof window.option_row !== 'undefined') {
        window.option_row = row + 1;
      }
    }, item);
  }
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const row = 0;
    if (typeof window.addOptionValue !== 'function') {
      return;
    }
    const hidden = document.querySelector('#option-values' + row);
    const n = hidden ? hidden.options.length : 0;
    for (let i = 0; i < n; i += 1) {
      window.addOptionValue(row);
    }
    const selects = [...document.querySelectorAll('select[name*="[option_value_id]"]')];
    [...(hidden ? hidden.options : [])].forEach((opt, i) => {
      if (selects[i]) {
        selects[i].value = opt.value;
      }
    });
  });

  await page.evaluate((pairs) => {
    const selects = [...document.querySelectorAll('select[name*="[option_value_id]"]')];
    selects.forEach((sel) => {
      const label = (sel.selectedOptions[0] && sel.selectedOptions[0].textContent) || '';
      const hit = pairs.find((p) => new RegExp(p.source, 'i').test(label));
      if (!hit) {
        return;
      }
      const priceName = sel.name.replace('[option_value_id]', '[price]');
      const prefixName = sel.name.replace('[option_value_id]', '[price_prefix]');
      const qtyName = sel.name.replace('[option_value_id]', '[quantity]');
      const subName = sel.name.replace('[option_value_id]', '[subtract]');
      const pri = document.querySelector('input[name="' + priceName + '"]');
      const pre = document.querySelector('select[name="' + prefixName + '"]');
      const q = document.querySelector('input[name="' + qtyName + '"]');
      const s = document.querySelector('select[name="' + subName + '"]');
      if (pre) {
        pre.value = '+';
      }
      if (pri) {
        pri.value = hit.usd;
      }
      if (q) {
        q.value = '999';
      }
      if (s) {
        s.value = '0';
      }
    });
  }, OPTION_PRICES.map((p) => ({ source: p.match.source, usd: p.usd })));

  const count = await page.evaluate(() => document.querySelectorAll('select[name*="[option_value_id]"]').length);
  console.log('option_rows ' + count);
  return count > 0;
}

async function checkShot12(page, token) {
  const info = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('input[name="image"], input[name*="[image]"]')].map((el) => el.value).filter(Boolean);
    return {
      main: (document.querySelector('#input-image, input[name="image"]') || {}).value || '',
      shot12: paths.filter((v) => /screenshot_12/i.test(v)),
      all: paths.length,
    };
  });
  console.log('images_main ' + info.main);
  console.log('images_count ' + info.all);
  console.log('shot12_paths ' + JSON.stringify(info.shot12));

  const listed = await page.evaluate(async ({ token }) => {
    const u = 'index.php?route=common/filemanager&' + token.name + '=' + encodeURIComponent(token.value) + '&directory=novaposhta';
    const r = await fetch(u, { credentials: 'same-origin' });
    const html = await r.text();
    return {
      png: /screenshot_12\.png/i.test(html),
      jpg: /screenshot_12\.jpg/i.test(html),
    };
  }, { token: token });
  console.log('shot12_files png=' + listed.png + ' jpg=' + listed.jpg);

  if (listed.jpg && info.shot12.some((p) => /screenshot_12\.png$/i.test(p))) {
    await page.evaluate(() => {
      document.querySelectorAll('input[name="image"], input[name*="[image]"]').forEach((el) => {
        if (/screenshot_12\.png$/i.test(el.value || '')) {
          el.value = 'catalog/novaposhta/screenshot_12.jpg';
        }
      });
    });
    console.log('shot12_path_fixed_to_jpg');
  }
  if (listed.jpg && !info.shot12.length) {
    await page.evaluate(() => {
      const tab = document.querySelector('a[href="#tab-image"]');
      if (tab) {
        tab.click();
      }
      const used = [...document.querySelectorAll('input[name^="product_image"][name$="[image]"]')]
        .map((el) => {
          const m = (el.name || '').match(/product_image\[(\d+)\]/);
          return m ? parseInt(m[1], 10) : -1;
        })
        .filter((n) => n >= 0);
      const next = used.length ? Math.max.apply(null, used) + 1 : 0;
      if (typeof window.image_row !== 'undefined') {
        window.image_row = next;
      }
      if (typeof window.addImage === 'function') {
        window.addImage();
      }
      const hid = document.querySelector('input[name="product_image[' + next + '][image]"]');
      const sort = document.querySelector('input[name="product_image[' + next + '][sort_order]"]');
      if (hid) {
        hid.value = 'catalog/novaposhta/screenshot_12.jpg';
      }
      if (sort) {
        sort.value = String(next + 1);
      }
    });
    console.log('shot12_row_added');
  }
  if (!listed.jpg && !listed.png) {
    console.log('shot12_missing_on_server');
  }
}

async function listDownloadId(page, token, match) {
  await page.goto(adminUrl('catalog/download', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page.evaluate((label) => {
    for (const tr of document.querySelectorAll('table tbody tr')) {
      if (!(tr.textContent || '').includes(label)) {
        continue;
      }
      const href = ((tr.querySelector('a[href*="download_id="]') || {}).getAttribute('href')) || '';
      const m = href.match(/download_id=(\d+)/);
      if (m) {
        return m[1];
      }
      const box = tr.querySelector('input[name="selected[]"]');
      if (box && box.value) {
        return box.value;
      }
    }
    return '';
  }, match);
}

async function attachCurrentZip(page, keepIds, zipName) {
  const id = keepIds[0];
  if (!id) {
    return;
  }
  await page.evaluate(() => {
    const a = document.querySelector('a[href="#tab-links"]');
    if (a) {
      a.click();
    }
  });
  await page.evaluate(({ id, name }) => {
    const box = document.getElementById('product-download');
    if (!box) {
      return;
    }
    box.querySelectorAll('div[id^="product-download"]').forEach((div) => {
      const hid = div.querySelector('input[name="product_download[]"]');
      if (hid && hid.value !== id) {
        div.remove();
      }
    });
    if (!document.querySelector('input[name="product_download[]"][value="' + id + '"]')) {
      const div = document.createElement('div');
      div.id = 'product-download' + id;
      div.innerHTML = '<i class="fa fa-minus-circle"></i> ' + name + '<input type="hidden" name="product_download[]" value="' + id + '">';
      box.appendChild(div);
    }
  }, { id: id, name: zipName });
  console.log('download_keep ' + id);
}

function parseTabsArgs(argv) {
  const args = argv.slice(2);
  const relatedOnly = args.includes('--related-only');
  const all = args.includes('--all') || (relatedOnly && !args.some((a) => MODULES[a]));
  const keys = all ? Object.keys(MODULES) : [args.find((a) => MODULES[a]) || 'novaposhta'];
  return { relatedOnly: relatedOnly, keys: keys };
}

async function fillOneProduct(page, token, key, relatedOnly) {
  const spec = MODULES[key];
  const productId = spec.productId;
  if (!productId) {
    console.log('STATUS BLOCKED no_product_id ' + key);
    return false;
  }
  console.log('module ' + key + ' product_id ' + productId);

  let keepIds = [];
  if (!relatedOnly) {
    if (key === 'novaposhta') {
      keepIds = await deleteOldZips(page, token, spec.dlName);
    }
    const dlId = await listDownloadId(page, token, spec.dlMatch);
    if (dlId) {
      keepIds = [dlId];
    }
    if (!keepIds.length) {
      console.log('download_missing ' + spec.dlMatch);
    }
  }

  await page.goto(adminUrl('catalog/product/edit', token, { product_id: productId }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!relatedOnly) {
    const before = await page.evaluate(() => ({
      attrs: document.querySelectorAll('#attribute tbody tr[id^="attribute-row"]').length,
      opts: document.querySelectorAll('#option a[href^="#tab-option"]').length,
      optVals: document.querySelectorAll('select[name*="[option_value_id]"]').length,
    }));
    console.log('before ' + JSON.stringify(before));
    await fillAttributes(page, token, buildAttributes(spec));
    await fillOptions(page, token);
    if (key === 'novaposhta') {
      await checkShot12(page, token);
    }
    await attachCurrentZip(page, keepIds, spec.dlName);
  }
  await fillRelated(page, relatedFor(key));
  await clickSave(page);
  const alert = await page.evaluate(() => {
    const a = document.querySelector('.alert-danger');
    return a ? (a.textContent || '').replace(/\s+/g, ' ').trim() : '';
  });
  if (alert) {
    console.log('STATUS BLOCKED ' + alert.slice(0, 220));
    return false;
  }
  console.log('saved ' + productId);
  return true;
}

async function main() {
  const args = parseTabsArgs(process.argv);
  const { context } = await launchOrAttach();
  const page = pickAdminPage(context) || await context.newPage();
  await page.bringToFront().catch(() => {});
  if (!(await isLoggedIn(page))) {
    console.log('STATUS WAITING_LOGIN');
    process.exit(0);
  }
  const token = await readAdminToken(page);
  fs.writeFileSync(TOKEN_FILE, token.name + '=' + token.value, 'utf8');

  for (const key of args.keys) {
    const ok = await fillOneProduct(page, token, key, args.relatedOnly);
    if (!ok) {
      process.exit(1);
    }
  }
  console.log('STATUS TABS');
  process.exit(0);
}

main().catch((err) => {
  console.log('STATUS BLOCKED ' + err.message);
  process.exit(1);
});
