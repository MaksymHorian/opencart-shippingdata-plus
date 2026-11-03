/**
 * Ukrposhta 6293 — ?do=edit Опис only (demo buttons UK/EN/RU).
 * Does NOT touch ZIP, gallery, price, tags, characteristics, newVersion.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const EDIT =
  'https://opencartforum.com/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/?do=edit';
const PUBLIC = {
  uk: 'https://opencartforum.com/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/',
  en: 'https://opencartforum.com/en/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/',
  ru: 'https://opencartforum.com/ru/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/',
};
const LISTING_DIR = path.join(__dirname, '../../../docs/ukrposhta/listing');

const LOCALES = [
  {
    lang: 5,
    tab: 'Українська',
    descFile: 'description.forum.uk.html',
    pubMarker: 'Панель адміністратора',
    pubPhrase: '#FFBE21',
  },
  {
    lang: 1,
    tab: 'English',
    descFile: 'description.forum.en.html',
    pubMarker: 'Admin Panel',
    pubPhrase: 'Create/Edit Invoice',
  },
  {
    lang: 2,
    tab: 'Русский',
    descFile: 'description.forum.ru.html',
    pubMarker: 'Панель администратора',
    pubPhrase: '#FFBE21',
  },
];

async function clickSideTab(page, label) {
  await page.evaluate((text) => {
    [...document.querySelectorAll('.ipsTabs_item, .ipsSideMenu_item')]
      .find((el) => (el.textContent || '').trim().replace(/\s+/g, ' ') === text)
      ?.click();
  }, label);
  await page.waitForTimeout(900);
}

async function clickLangTab(page, label) {
  const clicked = await page.evaluate((text) => {
    const descPanel =
      document.querySelector('#ipsTabs_tabs_form_form_tab_file_descTab_panel') ||
      document.querySelector('[id*="file_descTab"]') ||
      document;
    const btn = [...descPanel.querySelectorAll('button, .ipsTabs_item, a')].find(
      (el) => (el.textContent || '').trim() === text,
    );
    if (!btn) {
      return false;
    }
    btn.click();
    return true;
  }, label);
  if (!clicked) {
    await page.evaluate((text) => {
      [...document.querySelectorAll('button')]
        .find((b) => (b.textContent || '').trim() === text)
        ?.click();
    }, label);
  }
  await page.waitForTimeout(700);
}

async function fillDescriptionOnly(page, lang, html) {
  return page.evaluate(
    ({ lang, content }) => {
      const descEl = document.querySelector(`textarea[name="file_description[${lang}]"]`);
      if (!descEl) {
        return { ok: false, reason: 'missing desc textarea' };
      }
      descEl.value = content;
      let via = 'textarea';
      if (typeof CKEDITOR !== 'undefined') {
        for (const k in CKEDITOR.instances) {
          const inst = CKEDITOR.instances[k];
          if (inst.element && inst.element.$ === descEl) {
            inst.setData(content);
            inst.updateElement();
            via = 'ckeditor';
            break;
          }
        }
      }
      descEl.dispatchEvent(new Event('input', { bubbles: true }));
      descEl.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, via, descLen: content.length, descStored: descEl.value.length };
    },
    { lang, content: html },
  );
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

async function verifyPublicGuest(browser, url, marker, phrase) {
  const guest = await browser.newPage();
  await guest.goto(url, { waitUntil: 'domcontentloaded' });
  await guest.waitForTimeout(2500);
  const result = await guest.evaluate(
    ({ marker, phrase }) => {
      const html = document.documentElement.innerHTML;
      const cut =
        html.indexOf('Функціональні') > 0
          ? html.indexOf('Функціональні')
          : html.indexOf('Functional Capabilities') > 0
            ? html.indexOf('Functional Capabilities')
            : html.indexOf('Функциональные') > 0
              ? html.indexOf('Функциональные')
              : html.length;
      const intro = html.slice(0, cut);
      return {
        url: location.href,
        hasMarker: html.includes(marker),
        hasPhrase: html.includes(phrase),
        hasBrandBtn: /#FFBE21|FFBE21|rgb\(255,\s*190,\s*33\)/i.test(intro),
        noStackedBlue: !/background-color:#007bff/.test(intro),
        bodySnippet: (document.body.innerText || '').slice(0, 300),
      };
    },
    { marker, phrase },
  );
  await guest.close();
  return result;
}

for (const loc of LOCALES) {
  const descPath = path.join(LISTING_DIR, loc.descFile);
  if (!fs.existsSync(descPath)) {
    console.log(`BLOCKED missing ${descPath}`);
    process.exit(1);
  }
}

const context = await chromium.launchPersistentContext(path.join(__dirname, '.profile-chrome'), {
  channel: 'chrome',
  headless: true,
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
await clickSideTab(page, 'Опис');

const results = {};
for (const loc of LOCALES) {
  await clickLangTab(page, loc.tab);
  const html = fs.readFileSync(path.join(LISTING_DIR, loc.descFile), 'utf8');
  results[`lang${loc.lang}`] = await fillDescriptionOnly(page, loc.lang, html);
  console.log(`lang${loc.lang} ${JSON.stringify(results[`lang${loc.lang}`])}`);
}

await syncCkeditor(page);

const saveClicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button.ipsButton_primary, button[type=submit]')].find(
    (b) => {
      const t = (b.textContent || b.value || '').trim().replace(/\s+/g, ' ');
      return /^зберегти$|^сохранить$|^save$/i.test(t) && !b.classList.contains('ocfSvcMSave');
    },
  );
  if (!btn) {
    return '';
  }
  btn.click();
  return (btn.textContent || btn.value || '').trim();
});
console.log(`save ${saveClicked || 'NONE'}`);
if (!saveClicked) {
  console.log('STATUS partial (save button not found)');
  await context.close();
  process.exit(1);
}

await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);

if (!page.url().includes('do=edit')) {
  await page.goto(EDIT, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await clickSideTab(page, 'Опис');
}

const after = await page.evaluate(() => ({
  url: location.href,
  d5: document.querySelector('textarea[name="file_description[5]"]')?.value?.length || 0,
  d1: document.querySelector('textarea[name="file_description[1]"]')?.value?.length || 0,
  d2: document.querySelector('textarea[name="file_description[2]"]')?.value?.length || 0,
  btn5: /#FFBE21|FFBE21/i.test(
    document.querySelector('textarea[name="file_description[5]"]')?.value || '',
  ),
  btn1: /Admin Panel/.test(
    document.querySelector('textarea[name="file_description[1]"]')?.value || '',
  ),
  btn2: /Панель администратора/.test(
    document.querySelector('textarea[name="file_description[2]"]')?.value || '',
  ),
  noBlue5: !/background-color:#007bff/i.test(
    document.querySelector('textarea[name="file_description[5]"]')?.value || '',
  ),
}));
console.log(`after ${JSON.stringify(after)}`);

const guestBrowser = await chromium.launch({ channel: 'chrome', headless: true });
const pub = {};
pub.uk = await verifyPublicGuest(guestBrowser, PUBLIC.uk, LOCALES[0].pubMarker, LOCALES[0].pubPhrase);
console.log(`public_uk ${JSON.stringify(pub.uk)}`);
pub.en = await verifyPublicGuest(guestBrowser, PUBLIC.en, LOCALES[1].pubMarker, LOCALES[1].pubPhrase);
console.log(`public_en ${JSON.stringify(pub.en)}`);
pub.ru = await verifyPublicGuest(guestBrowser, PUBLIC.ru, LOCALES[2].pubMarker, LOCALES[2].pubPhrase);
console.log(`public_ru ${JSON.stringify(pub.ru)}`);
await guestBrowser.close();

const editOk =
  after.d5 > 10000 &&
  after.d1 > 10000 &&
  after.d2 > 10000 &&
  after.btn5 &&
  after.btn1 &&
  after.btn2 &&
  after.noBlue5;

const pubOk =
  pub.uk.hasMarker &&
  pub.uk.hasBrandBtn &&
  pub.uk.noStackedBlue &&
  pub.en.hasMarker &&
  pub.en.hasPhrase &&
  pub.en.hasBrandBtn &&
  pub.en.noStackedBlue &&
  pub.ru.hasMarker &&
  pub.ru.hasBrandBtn &&
  pub.ru.noStackedBlue;

const ok = editOk && pubOk;
console.log(`STATUS ${ok ? 'updated' : editOk ? 'partial (public mismatch)' : 'partial'}`);
await context.close();
process.exit(ok ? 0 : 1);
