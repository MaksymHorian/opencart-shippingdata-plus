/**
 * oc-max.com — shop-wide manufacturer, attribute group/attrs, extra-services option.
 * Product values: ocmax-product-tabs.mjs {module}
 *   node ocmax-catalog-fill.mjs
 *
 * Attaches to .profile-ocmax-chrome. No login polling / no captcha navigation.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const PROFILE = path.join(__dirname, '.profile-ocmax-chrome');
const TOKEN_FILE = path.join(__dirname, '.ocmax-admin-token');
const CDP_PORT = 9333;
const MANUFACTURER_ID = '11';
const RATE = 45;
const uahToUsd = (uah) => (uah / RATE).toFixed(2);

const LANG = { ru: '1', en: '2', uk: '3' };

const MANUFACTURER = {
  name: 'OC Max',
  site: 'https://oc-max.com/',
  meta: {
    uk: { h1: 'OC Max', title: 'OC Max — модулі для OpenCart', desc: 'Модулі доставки та сервіси OC Max для OpenCart / ocStore.', keys: 'oc max, opencart, модулі' },
    en: { h1: 'OC Max', title: 'OC Max — OpenCart modules', desc: 'OC Max shipping modules and services for OpenCart / ocStore.', keys: 'oc max, opencart, modules' },
    ru: { h1: 'OC Max', title: 'OC Max — модули для OpenCart', desc: 'Модули доставки и сервисы OC Max для OpenCart / ocStore.', keys: 'oc max, opencart, модули' },
  },
  html: {
    uk: '<p>OC Max — розробник модулів доставки для OpenCart: Нова пошта, Укрпошта, Meest, Rozetka Delivery.</p><p>Сайт: <a href="https://oc-max.com/">oc-max.com</a></p>',
    en: '<p>OC Max develops shipping modules for OpenCart: Nova Poshta, Ukrposhta, Meest, Rozetka Delivery.</p><p>Website: <a href="https://oc-max.com/">oc-max.com</a></p>',
    ru: '<p>OC Max — разработчик модулей доставки для OpenCart: Новая почта, Укрпочта, Meest, Rozetka Delivery.</p><p>Сайт: <a href="https://oc-max.com/">oc-max.com</a></p>',
  },
  seo: { uk: 'oc-max', en: 'oc-max-en', ru: 'oc-max-ru' },
};

const ATTR_GROUP = { uk: 'Модуль', en: 'Module', ru: 'Модуль' };

const ATTRIBUTES = [
  { names: { uk: 'Сумісність', en: 'Compatibility', ru: 'Совместимость' } },
  { names: { uk: 'Ліцензія', en: 'License', ru: 'Лицензия' } },
  { names: { uk: 'Версія', en: 'Version', ru: 'Версия' } },
  { names: { uk: 'Розробник', en: 'Developer', ru: 'Разработчик' } },
  { names: { uk: 'Мова', en: 'Language', ru: 'Язык' } },
];

const OPTION = {
  names: { uk: 'Додаткові послуги', en: 'Extra services', ru: 'Дополнительные услуги' },
  values: [
    { uk: 'Встановлення', en: 'Installation', ru: 'Установка', usd: uahToUsd(400) },
    { uk: 'Оновлення', en: 'Updates', ru: 'Обновление', usd: uahToUsd(400) },
    { uk: 'Адаптація', en: 'Adaptation', ru: 'Адаптация', usd: uahToUsd(600) },
    { uk: 'Підтримати проект', en: 'Support the project', ru: 'Поддержать проект', usd: uahToUsd(300) },
  ],
};

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
  const fromUrl = parseAdminToken(page.url());
  if (fromUrl) {
    return fromUrl;
  }
  return page.evaluate(() => {
    const a = document.querySelector('a[href*="user_token="], a[href*="token="]');
    const href = (a && a.getAttribute('href')) || window.location.href;
    const m = href.match(/[?&](user_token|token)=([^&]+)/i);
    return m ? { name: m[1].toLowerCase() === 'user_token' ? 'user_token' : 'token', value: decodeURIComponent(m[2]) } : null;
  });
}

async function isLoggedIn(page) {
  if (/route=common\/login/i.test(page.url())) {
    return false;
  }
  try {
    if (await page.evaluate(() => !!document.querySelector('input[name="password"]'))) {
      return false;
    }
  } catch (e) {
    return false;
  }
  return !!parseAdminToken(page.url()) || !!(await readAdminToken(page));
}

function persistToken(token) {
  if (token && token.value) {
    fs.writeFileSync(TOKEN_FILE, token.name + '=' + token.value, 'utf8');
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
  const admin = open.filter((p) => /oc-max\.com\/admin/i.test(p.url()));
  return admin.find((p) => parseAdminToken(p.url())) || admin[0] || open[0] || null;
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
    return { context: await chromium.launchPersistentContext(PROFILE, launchOpts) };
  } catch (launchErr) {
    if (!/already in use|Target page|closed/i.test(launchErr.message || '')) {
      throw launchErr;
    }
    console.log('profile_in_use attach CDP');
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
  await page.evaluate((id) => {
    const btn = document.querySelector('button[form="' + id + '"]') || document.querySelector('.page-header button.btn-primary');
    if (btn) {
      btn.click();
    }
  }, formId);
  await page.waitForTimeout(2000);
}

async function saveOk(page, addRoute) {
  return page.evaluate((addRoute) => {
    const alert = document.querySelector('.alert-danger');
    return {
      ok: !alert && !new RegExp(addRoute, 'i').test(window.location.href),
      alert: alert ? (alert.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) : '',
      url: window.location.href.replace(/([?&](?:user_token|token)=)[^&]+/i, '$1***'),
    };
  }, addRoute);
}

async function listId(page, token, route, name, idParam) {
  await page.goto(adminUrl(route, token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page.evaluate(({ name, idParam }) => {
    for (const tr of document.querySelectorAll('table tbody tr')) {
      if (!(tr.textContent || '').includes(name)) {
        continue;
      }
      const href = ((tr.querySelector('a[href*="' + idParam + '="]') || {}).getAttribute('href')) || '';
      const m = href.match(new RegExp(idParam + '=(\\d+)'));
      if (m) {
        return m[1];
      }
    }
    return '';
  }, { name: name, idParam: idParam });
}

async function setLangInputs(page, prefix, byLang) {
  await page.evaluate(({ prefix, byLang, LANG }) => {
    Object.keys(byLang).forEach((key) => {
      const id = LANG[key];
      const el = document.querySelector('input[name="' + prefix + '[' + id + '][name]"]');
      if (el) {
        el.value = byLang[key];
      }
    });
  }, { prefix: prefix, byLang: byLang, LANG: LANG });
}

async function fillManufacturer(page, token) {
  await page.goto(adminUrl('catalog/manufacturer/edit', token, { manufacturer_id: MANUFACTURER_ID }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ M, LANG }) => {
    const name = document.querySelector('input[name="name"]');
    if (name) {
      name.value = M.name;
    }
    ['uk', 'en', 'ru'].forEach((key) => {
      const id = LANG[key];
      const meta = M.meta[key];
      const map = {
        meta_h1: meta.h1,
        meta_title: meta.title,
        meta_description: meta.desc,
        meta_keyword: meta.keys,
      };
      Object.keys(map).forEach((field) => {
        const el = document.querySelector('[name="manufacturer_description[' + id + '][' + field + ']"]');
        if (el) {
          el.value = map[field];
        }
      });
      const ta = document.querySelector('textarea[name="manufacturer_description[' + id + '][description]"]');
      if (ta) {
        ta.value = M.html[key];
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.summernote && ta.id && window.jQuery('#' + ta.id).next('.note-editor').length) {
          window.jQuery('#' + ta.id).summernote('code', M.html[key]);
        }
      }
    });
    document.querySelectorAll('input[name="manufacturer_store[]"]').forEach((el) => {
      el.checked = true;
    });
    const sort = document.querySelector('input[name="sort_order"]');
    if (sort && !sort.value) {
      sort.value = '1';
    }
    Object.keys(M.seo).forEach((key) => {
      const id = LANG[key];
      document.querySelectorAll('input[name*="manufacturer_seo_url"][name*="[' + id + ']"]').forEach((el) => {
        el.value = M.seo[key];
      });
    });
  }, { M: MANUFACTURER, LANG: LANG });
  await clickSave(page, 'form-manufacturer');
  const res = await saveOk(page, 'manufacturer/add');
  console.log(res.ok ? 'manufacturer_saved 11' : 'manufacturer_warn ' + JSON.stringify(res));
}

async function ensureAttrGroup(page, token) {
  let id = await listId(page, token, 'catalog/attribute_group', ATTR_GROUP.uk, 'attribute_group_id');
  if (id) {
    console.log('attribute_group_exists ' + id);
    return id;
  }
  await page.goto(adminUrl('catalog/attribute_group/add', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await setLangInputs(page, 'attribute_group_description', ATTR_GROUP);
  await page.evaluate(() => {
    const s = document.querySelector('input[name="sort_order"]');
    if (s) {
      s.value = '1';
    }
  });
  await clickSave(page, 'form-attribute-group');
  id = (page.url().match(/attribute_group_id=(\d+)/) || [])[1] || await listId(page, token, 'catalog/attribute_group', ATTR_GROUP.uk, 'attribute_group_id');
  console.log('attribute_group_created ' + (id || '?'));
  return id || '';
}

async function ensureAttribute(page, token, groupId, spec) {
  let id = await listId(page, token, 'catalog/attribute', spec.names.uk, 'attribute_id');
  if (id) {
    console.log('attribute_exists ' + spec.names.uk + ' ' + id);
    return id;
  }
  await page.goto(adminUrl('catalog/attribute/add', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await setLangInputs(page, 'attribute_description', spec.names);
  await page.evaluate((groupId) => {
    const sel = document.querySelector('select[name="attribute_group_id"]');
    if (sel) {
      sel.value = groupId;
    }
  }, groupId);
  await clickSave(page, 'form-attribute');
  id = (page.url().match(/attribute_id=(\d+)/) || [])[1] || await listId(page, token, 'catalog/attribute', spec.names.uk, 'attribute_id');
  console.log('attribute_created ' + spec.names.uk + ' ' + (id || '?'));
  return id || '';
}

async function ensureOption(page, token) {
  let id = await listId(page, token, 'catalog/option', OPTION.names.uk, 'option_id');
  if (id) {
    console.log('option_exists ' + id);
    return id;
  }
  await page.goto(adminUrl('catalog/option/add', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ OPTION, LANG }) => {
    Object.keys(OPTION.names).forEach((key) => {
      const el = document.querySelector('input[name="option_description[' + LANG[key] + '][name]"]');
      if (el) {
        el.value = OPTION.names[key];
      }
    });
    const type = document.querySelector('select[name="type"]');
    if (type) {
      type.value = 'checkbox';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof window.addOptionValue === 'function') {
      OPTION.values.forEach(() => window.addOptionValue());
    }
    OPTION.values.forEach((val, row) => {
      Object.keys(LANG).forEach((key) => {
        const el = document.querySelector('input[name="option_value[' + row + '][option_value_description][' + LANG[key] + '][name]"]');
        if (el) {
          el.value = val[key];
        }
      });
      const sort = document.querySelector('input[name="option_value[' + row + '][sort_order]"]');
      if (sort) {
        sort.value = String(row + 1);
      }
    });
  }, { OPTION: OPTION, LANG: LANG });
  await clickSave(page, 'form-option');
  const res = await saveOk(page, 'option/add');
  id = (page.url().match(/option_id=(\d+)/) || [])[1] || await listId(page, token, 'catalog/option', OPTION.names.uk, 'option_id');
  console.log(res.ok || id ? 'option_created ' + (id || '?') : 'option_warn ' + JSON.stringify(res));
  return id || '';
}

async function main() {
  const { context } = await launchOrAttach();
  const page = pickAdminPage(context) || await context.newPage();
  await page.bringToFront().catch(() => {});
  if (!(await isLoggedIn(page))) {
    console.log('STATUS WAITING_LOGIN');
    console.log('Sign in in the Playwright Chrome, then write in chat.');
    process.exit(0);
  }
  const token = await readAdminToken(page);
  if (!token) {
    console.log('STATUS BLOCKED no_admin_token');
    process.exit(1);
  }
  persistToken(token);
  console.log('admin_token_param ' + token.name);
  console.log('extras_usd ' + OPTION.values.map((v) => v.usd).join('/'));

  await fillManufacturer(page, token);
  const groupId = await ensureAttrGroup(page, token);
  for (const spec of ATTRIBUTES) {
    await ensureAttribute(page, token, groupId, spec);
  }
  await ensureOption(page, token);
  console.log('STATUS UPDATED');
  console.log('Shop catalog ready (manufacturer, attributes, extras). Product values: ocmax-product-tabs.mjs {module}');
}

main().catch((err) => {
  console.log('STATUS BLOCKED ' + err.message);
  process.exit(1);
});
