/**
 * Canonical Meest forum chars + ZIP (?do=edit Характеристики, ?do=newVersion).
 * Extra ZIPs: a[data-role="deleteFile"] (×) — files_keep is hidden, not a checkbox.
 * Playbook: docs/listing/opencartforum.md § First pass.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const ROOT = 'c:\\OpenServer\\home\\oc3';
const EDIT = 'https://opencartforum.com/files/file/9692-meest-poshta-modul-dostavky-dlia-opencart/?do=edit';
const NEWVER = 'https://opencartforum.com/files/file/9692-meest-poshta-modul-dostavky-dlia-opencart/?do=newVersion';
const PUBLIC = 'https://opencartforum.com/files/file/9692-meest-poshta-modul-dostavky-dlia-opencart/';
const ZIP = 'c:\\OpenServer\\home\\OCMax\\Meest POSHTA\\v. 0.1.0\\meest_poshta_v_0.1.0.zip';
const DESC = path.join(ROOT, 'docs\\meest\\listing\\description.forum.uk.html');
const CHANGELOG = 'перший публічний реліз модуля Meest ПОШТА для OpenCart 1.5-3.x';

const OC_VERSIONS = [
  '3.0', '2.3', '2.2', '2.1', '2.0',
  '1.5.6.4', '1.5.6.3', '1.5.6.2', '1.5.6.1', '1.5.6',
  '1.5.5.1', '1.5.5', '1.5.4.1', '1.5.3.1',
];
const OCSTORE_VERSIONS = [
  '3.0', '2.3.0.2.4', '2.3', '2.2', '2.1',
  '1.5.5.1.2', '1.5.5.1.1', '1.5.5.1',
  '1.5.4.1.2', '1.5.4.1.1', '1.5.4.1',
  '1.5.3.1', '1.5.2.1', '1.5.1.3',
];
const PRO_OCSHOP = [
  'Opencart.pro 2.3', 'Opencart.pro 2.1', 'OcShop 2.0.3.х', 'OcShop 1.5.6.4.х',
];
const SYSREQ = 'PHP library CURL, PHP version 5.6 and higher';
const TEMPLATES = 'Всі шаблони. Може знадобитись додаткова адаптація під модуль оформлення замовлень.';

async function clickTab(page, label) {
  await page.evaluate((text) => {
    [...document.querySelectorAll('.ipsTabs_item, .ipsSideMenu_item')]
      .find((el) => (el.textContent || '').trim() === text)
      ?.click();
  }, label);
  await page.waitForTimeout(900);
}

async function selectOptionsByText(page, selector, texts) {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) {
    return 0;
  }
  return loc.evaluate((el, wanted) => {
    const set = new Set(wanted.map((t) => String(t)));
    const picked = [...el.options]
      .filter((o) => set.has(o.text.trim()) || set.has(o.value))
      .map((o) => o.value);
    for (const o of el.options) {
      o.selected = picked.includes(o.value);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return picked.length;
  }, texts);
}

async function syncCkeditor(page) {
  await page.evaluate(() => {
    if (typeof CKEDITOR === 'undefined') {
      return;
    }
    for (const k in CKEDITOR.instances) {
      CKEDITOR.instances[k].updateElement();
    }
  });
}

async function saveEdit(page) {
  await syncCkeditor(page);
  await page.locator('button.ipsButton_primary').filter({ hasText: /^Зберегти$/ }).first().click();
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function fillCharacteristics(page) {
  await clickTab(page, 'Характеристики');
  const n3 = await selectOptionsByText(page, 'select[name="downloads_field_3[]"]', OC_VERSIONS);
  const n5 = await selectOptionsByText(page, 'select[name="downloads_field_5[]"]', OCSTORE_VERSIONS);
  const n9 = await selectOptionsByText(page, 'select[name="downloads_field_9[]"]', PRO_OCSHOP);
  await page.locator('[name="downloads_field_4"]').fill(SYSREQ);
  await page.locator('[name="downloads_field_26"]').fill(TEMPLATES);
  console.log(`chars f3=${n3} f5=${n5} f9=${n9}`);
}

async function fillDescription(page, html) {
  await clickTab(page, 'Опис');
  const ok = await page.evaluate((content) => {
    function setEditor(name, body) {
      const ta = document.querySelector(`textarea[name="${name}"]`);
      if (!ta) {
        return false;
      }
      ta.value = body;
      if (typeof CKEDITOR !== 'undefined') {
        for (const k in CKEDITOR.instances) {
          const inst = CKEDITOR.instances[k];
          if (inst.element && inst.element.$ === ta) {
            inst.setData(body);
            inst.updateElement();
            return true;
          }
        }
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return setEditor('file_description[5]', content);
  }, html);
  console.log(`desc_set ${ok}`);
}

async function readCharacteristics(page) {
  await clickTab(page, 'Характеристики');
  return page.evaluate(() => ({
    f3: [...document.querySelectorAll('select[name="downloads_field_3[]"] option:checked')].map((o) => o.value),
    f5: [...document.querySelectorAll('select[name="downloads_field_5[]"] option:checked')].map((o) => o.value),
    f9: [...document.querySelectorAll('select[name="downloads_field_9[]"] option:checked')].map((o) => o.value),
    f4: document.querySelector('[name="downloads_field_4"]')?.value || '',
    f26: document.querySelector('[name="downloads_field_26"]')?.value || '',
  }));
}

async function fixNewVersion(page) {
  await page.goto(NEWVER, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  for (let pass = 0; pass < 20; pass++) {
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.ipsUploader__row[data-role="file"]')]
        .map((r) => ({
          id: r.id,
          text: (r.textContent || '').replace(/\s+/g, ' ').trim(),
        }))
        .filter((r) => /\.zip|12\s*кб/i.test(r.text))
    );
    const good = rows.filter((r) => /meest_poshta_v_0\.1\.0\.zip/i.test(r.text) && !/12\s*кб/i.test(r.text));
    if (rows.length <= 1 && good.length === 1) {
      break;
    }
    const targetId =
      rows.find((r) => /12\s*кб/i.test(r.text))?.id
      || (good.length > 1 ? good[0].id : rows[0]?.id);
    if (!targetId) {
      break;
    }
    const del = page.locator(`[id="${targetId}"] a[data-role="deleteFile"]`);
    if (!(await del.count())) {
      break;
    }
    await del.click();
    await page.waitForTimeout(700);
  }

  const left = await page.evaluate(() =>
    [...document.querySelectorAll('.ipsUploader__row[data-role="file"]')]
      .map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /\.zip|12\s*кб/i.test(t))
  );
  console.log(`zip_rows ${JSON.stringify(left)}`);

  if (left.length === 0) {
    if (!fs.existsSync(ZIP)) {
      console.log(`BLOCKER missing_zip ${ZIP}`);
      return false;
    }
    const zipHandle = await page.evaluateHandle(() => {
      const h = document.querySelector('input[name="files"]');
      const root = h ? h.closest('.ipsFieldRow, .ipsAttachments, .ipsUploader, form, div') : document;
      return root?.querySelector('input[type=file]') || document.querySelector('input[type=file]');
    });
    const zipEl = zipHandle.asElement();
    if (!zipEl) {
      return false;
    }
    await zipEl.setInputFiles(ZIP);
    await page.waitForFunction(() => /meest_poshta_v_0\.1\.0\.zip[\s\S]{0,40}готово/i.test(document.body.innerText || ''), null, { timeout: 180000 });
    console.log('zip_uploaded');
  }

  await page.locator('[name="file_version"]').fill('0.1.0');
  await page.evaluate((text) => {
    const ta = document.querySelector('textarea[name="file_changelog[5]"], textarea[name="file_changelog"]');
    if (ta) {
      ta.value = text;
      if (typeof CKEDITOR !== 'undefined') {
        for (const k in CKEDITOR.instances) {
          if (CKEDITOR.instances[k].element?.$ === ta) {
            CKEDITOR.instances[k].setData(text);
          }
        }
      }
    }
  }, CHANGELOG);

  const zips = await page.evaluate(() =>
    [...document.querySelectorAll('.ipsAttach, .ipsDataItem, li, tr')]
      .map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /\.zip|12\s*кб|мб|mb/i.test(t))
      .slice(0, 8)
  );
  console.log(`zip_rows ${JSON.stringify(zips)}`);

  await page.locator('button').filter({ hasText: /Save & Submit New Version/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(4000);
  return true;
}

async function verifyPublic(page) {
  await page.goto(PUBLIC, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const t = document.body.innerText || '';
    return {
      url: location.href,
      h1: (document.querySelector('h1')?.textContent || '').trim(),
      p1300: /1300\s*грн|1\s*300\s*грн/i.test(t),
      free: /Безкоштовно/i.test(t),
      mod: /На модерації/i.test(t),
      stub12kb: /12\s*КБ/i.test(t),
      zip: (t.match(/Розмір файлу\s*(\S+)/i) || [])[1] || '',
      version: (t.match(/Версія\s*(\S+)/i) || [])[1] || '',
      demoButtons: [...document.querySelectorAll('a[href*="shipping.oc-max.com"]')]
        .map((a) => ({ text: (a.textContent || '').trim(), href: a.href })),
    };
  });
}

async function main() {
  if (!fs.existsSync(DESC)) {
    console.log(`BLOCKER missing_desc ${DESC}`);
    process.exit(1);
  }
  const descHtml = fs.readFileSync(DESC, 'utf8');

  const context = await chromium.launchPersistentContext(path.join(__dirname, '.profile-chrome'), {
    channel: 'chrome',
    headless: false,
    viewport: null,
  });
  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(180000);

  await page.goto('https://opencartforum.com/', { waitUntil: 'domcontentloaded' });
  if (!(await page.evaluate(() => !!document.querySelector('#elUserLink')))) {
    console.log('STATUS WAITING_LOGIN');
    await context.close();
    process.exit(2);
  }

  await page.goto(EDIT, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  await fillCharacteristics(page);
  await fillDescription(page, descHtml);
  await saveEdit(page);

  const charsAfter = await readCharacteristics(page);
  console.log(`chars_after ${JSON.stringify(charsAfter)}`);

  const newVerOk = await fixNewVersion(page);
  const pub = await verifyPublic(page);

  const ok =
    newVerOk
    && charsAfter.f9.length === 4
    && !charsAfter.f9.includes('Не проверялось')
    && charsAfter.f4 === SYSREQ
    && charsAfter.f26 === TEMPLATES
    && pub.demoButtons.length >= 4
    && !pub.stub12kb;

  console.log(`pub ${JSON.stringify(pub)}`);
  console.log(`STATUS ${ok ? 'updated' : 'partial'}`);
  await context.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
