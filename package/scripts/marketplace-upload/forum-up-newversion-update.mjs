/**
 * Ukrposhta 6293 — ?do=newVersion only (ZIP cleanup + gallery + submit).
 *
 * × delete: in-page IPS click only. Playwright locator.click() follows the
 * href and the tab lands on /clients/alternative-contacts/. Do not wait for
 * navigation after delete. Do not page.goto mid-form.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const NEWVER =
  'https://opencartforum.com/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/?do=newVersion';
const PUBLIC =
  'https://opencartforum.com/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/';
const PUBLIC_EN =
  'https://opencartforum.com/en/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/';
const PUBLIC_RU =
  'https://opencartforum.com/ru/files/file/6293-ukrposhta-api-modul-dostavky-dlia-opencart/';
const ZIP =
  'c:\\OpenServer\\home\\OCMax\\Ukrposhta API\\v. 2.3.1\\ukrposhta_api_v_2.3.1.zip';
const GALLERY_DIR = 'c:\\OpenServer\\home\\OCMax\\Ukrposhta API\\images';
const VERSION = '2.3.1';
const ZIP_NAME = 'ukrposhta_api_v_2.3.1.zip';
const CHANGELOG = `v. 2.3.1 від 13.07.2026:
- актуалізація методів АПІ
- виправлені помилки сумісності
- інші виправлення помилок, дрібні правки та поліпшення`;

function buildGalleryPaths() {
  if (!fs.existsSync(GALLERY_DIR)) {
    return { logo: null, shots: [] };
  }
  const names = fs.readdirSync(GALLERY_DIR);
  const logoName = names.find((n) => /^logo\.png$/i.test(n));
  const shots = names
    .filter((n) => /^screenshot_.*\.(png|jpe?g|webp)$/i.test(n))
    .sort((a, b) => {
      const na = a.match(/^screenshot_(\d+)/i);
      const nb = b.match(/^screenshot_(\d+)/i);
      if (na && nb) {
        return Number(na[1]) - Number(nb[1]);
      }
      if (na) {
        return -1;
      }
      if (nb) {
        return 1;
      }
      return a.localeCompare(b);
    })
    .map((n) => path.join(GALLERY_DIR, n));
  return {
    logo: logoName ? path.join(GALLERY_DIR, logoName) : null,
    shots,
  };
}

async function onNewVersionPage(page) {
  return page.evaluate(() => /do=newVersion/i.test(location.href));
}

async function readPageState(page) {
  return page.evaluate(() => {
    const href = location.href;
    const t = document.body.innerText || '';
    const isAltContacts = /\/clients\/alternative-contacts\/?/i.test(href);
    const hasVerificationInput = !!document.querySelector(
      'input[name*="verification"], input[name*="auth_code"], input[name*="two_factor"], input[autocomplete="one-time-code"], input[type="tel"][maxlength="6"], input[type="text"][maxlength="6"]'
    );
    const isRealMfa =
      !isAltContacts
      && hasVerificationInput
      && /google authenticator|authenticator app|verification code|код підтвердження|код аутентифікації|двофакторн.*аутентифікац/i.test(t);
    const hasLogin = !!document.querySelector('#elUserLogin, form[action*="login"]');
    const onNewVersion = /do=newVersion/i.test(href);
    return { isAltContacts, isRealMfa, hasLogin, onNewVersion, href };
  });
}

async function skipAlternativeContacts(page) {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a, input[type=submit]')].find((b) => {
      const label = (b.textContent || b.value || '').replace(/\s+/g, ' ').trim();
      return /^(skip|continue|пропустити|продовжити)$/i.test(label)
        || /skip|пропустити|continue without|продовжити без/i.test(label);
    });
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    await page.waitForTimeout(1500);
  }
  return clicked;
}

/** Abort full-page GET to alternative-contacts (Playwright following × href). */
async function blockAltContactsNavigation(page) {
  await page.route('**/clients/alternative-contacts/**', (route) => {
    if (route.request().isNavigationRequest()) {
      return route.abort();
    }
    return route.continue();
  });
}

async function confirmDelete(page) {
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.ipsDialog button, .ipsDialog a, [data-role="dialog"] button, button, a')];
    const btn = nodes.find((b) => {
      const t = (b.textContent || b.value || '').replace(/\s+/g, ' ').trim();
      return /^(так|yes|ok|видали|удалить|delete|confirm)$/i.test(t)
        || /підтверд|confirm delete|видали/i.test(t);
    });
    if (btn) {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  });
  await page.waitForTimeout(800);
}

async function deleteOneRow(page, targetId) {
  const clicked = await page.evaluate((id) => {
    const row = document.getElementById(id);
    const a = row && row.querySelector('a[data-role="deleteFile"], a[data-action="deleteFile"]');
    if (!a) {
      return false;
    }
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 1 }));
    return true;
  }, targetId);
  if (!clicked) {
    return { deleted: false };
  }
  await confirmDelete(page);
  await page.waitForFunction(
    (id) => {
      if (/alternative-contacts/i.test(location.href)) {
        return 'navigated';
      }
      const row = document.getElementById(id);
      if (!row) {
        return true;
      }
      const style = window.getComputedStyle(row);
      return style.display === 'none' || style.visibility === 'hidden' || row.offsetParent === null;
    },
    targetId,
    { timeout: 15000 }
  ).catch(() => {});

  const state = await readPageState(page);
  if (state.isAltContacts || !state.onNewVersion) {
    return { deleted: false, navigated: true, href: state.href };
  }
  const gone = await page.evaluate((id) => !document.getElementById(id), targetId);
  return { deleted: gone };
}

async function deleteRowsByKind(page, kind, maxPass) {
  let deleted = 0;
  for (let pass = 0; pass < maxPass; pass++) {
    const rows = await page.evaluate((which) =>
      [...document.querySelectorAll('.ipsUploader__row')]
        .map((r) => ({
          id: r.id,
          text: (r.textContent || '').replace(/\s+/g, ' ').trim(),
        }))
        .filter((r) => {
          if (!r.id) {
            return false;
          }
          const isZip = /\.zip|12\s*кб/i.test(r.text);
          const isImage = /\.(png|jpe?g|webp)/i.test(r.text) && !isZip;
          return which === 'zip' ? isZip : isImage;
        })
    , kind);
    if (!rows.length) {
      return { deleted, navigated: false };
    }
    const result = await deleteOneRow(page, rows[0].id);
    if (result.navigated) {
      return { deleted, navigated: true, href: result.href };
    }
    if (!result.deleted) {
      break;
    }
    deleted += 1;
  }
  return { deleted, navigated: false };
}

async function turnOffBuyerNotify(page) {
  const changed = await page.evaluate(() => {
    const cb =
      document.querySelector('#check_notify_update, [name="notify_update_checkbox"]')
      || document.querySelector('[name="file_notify"]')
      || [...document.querySelectorAll('input[type=checkbox]')].find((el) =>
        /notify|сповіщ|підписник|покупц|buyer|customer/i.test(
          `${el.name} ${el.id} ${el.closest('.ipsFieldRow')?.textContent || ''}`
        )
      );
    if (!cb) {
      return false;
    }
    if (cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      cb.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return !cb.checked;
  });
  console.log(`notify_buyers_off ${changed}`);
}

async function fixNewVersion(page, { resume = false } = {}) {
  const stats = {
    zipDeleted: 0,
    zipUploaded: 0,
    screenshotsDeleted: 0,
    logoUploaded: 0,
    screenshotsUploaded: 0,
  };

  const openForm = resume && (await onNewVersionPage(page));
  if (!openForm) {
    const state = await readPageState(page);
    if (state.isRealMfa) {
      return { login: true, mfa: true, stats };
    }
    if (state.hasLogin) {
      return { login: true, stats };
    }
    if (state.isAltContacts) {
      await skipAlternativeContacts(page);
    }
    if (!(await onNewVersionPage(page))) {
      await page.goto(NEWVER, { waitUntil: 'domcontentloaded' });
    }
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.ipsUploader__row, .ipsUploader input[type=file]').length > 0
      || !!document.querySelector('#elUserLogin, form[action*="login"]'),
    null,
    { timeout: 90000 }
  ).catch(() => {});
  await page.waitForTimeout(openForm ? 1500 : 2500);

  if (await page.evaluate(() => !!document.querySelector('#elUserLogin, form[action*="login"]'))) {
    return { login: true };
  }

  await blockAltContactsNavigation(page);
  await turnOffBuyerNotify(page);

  const zipCleanup = await deleteRowsByKind(page, 'zip', 25);
  stats.zipDeleted = zipCleanup.deleted;
  console.log(`zip_rows_deleted ${stats.zipDeleted}`);
  if (zipCleanup.navigated) {
    console.log(`BLOCKER delete_navigated ${zipCleanup.href}`);
    return { ok: false, blocker: 'delete_navigated', stats };
  }

  let left = await page.evaluate(() =>
    [...document.querySelectorAll('.ipsUploader__row')]
      .map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /\.zip|12\s*кб/i.test(t))
  );
  console.log(`zip_rows_after_cleanup ${JSON.stringify(left)}`);

  if (!fs.existsSync(ZIP)) {
    console.log(`BLOCKER missing_zip ${ZIP}`);
    return { ok: false, blocker: 'missing_zip' };
  }
  const zipHandle = await page.evaluateHandle(() => {
    const zipUploader = document.querySelectorAll('.ipsUploader')[0];
    return (
      zipUploader?.querySelector('input[type=file]')
      || document.querySelector('input[name="files"]')
      || document.querySelector('.ipsUploader input[type=file]')
      || document.querySelector('input[type=file]')
    );
  });
  const zipEl = zipHandle.asElement();
  if (!zipEl) {
    return { ok: false, blocker: 'no_zip_input' };
  }
  await zipEl.setInputFiles(ZIP);
  await page
    .waitForFunction(
      () => /ukrposhta_api_v_2\.3\.1\.zip[\s\S]{0,120}(готово|ready|mb|мб)/i.test(document.body.innerText || ''),
      null,
      { timeout: 180000 }
    )
    .catch(() => {});
  stats.zipUploaded = 1;
  console.log('zip_uploaded');

  const shotCleanup = await deleteRowsByKind(page, 'image', 150);
  stats.screenshotsDeleted = shotCleanup.deleted;
  console.log(`screenshot_rows_deleted ${stats.screenshotsDeleted}`);
  if (shotCleanup.navigated) {
    console.log(`BLOCKER delete_navigated ${shotCleanup.href}`);
    return { ok: false, blocker: 'delete_navigated', stats };
  }

  const gallery = buildGalleryPaths();
  const shotInput = page.locator('.ipsUploader').nth(1).locator('input[type=file]').first();
  if (!gallery.logo && !gallery.shots.length) {
    console.log('BLOCKER missing_gallery');
    return { ok: false, blocker: 'missing_gallery' };
  }
  if (!(await shotInput.count())) {
    return { ok: false, blocker: 'no_shot_input' };
  }

  if (gallery.logo) {
    await shotInput.setInputFiles(gallery.logo);
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const radios = [...document.querySelectorAll('[name="file_primary_screenshot"]')];
      const logo = radios.find((r) => /logo\.png/i.test(r.closest('.ipsUploader__row')?.textContent || ''));
      const primary = logo || radios[0];
      if (primary) {
        primary.checked = true;
        primary.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    stats.logoUploaded = 1;
    console.log('logo_uploaded_primary');
  }

  if (gallery.shots.length) {
    await shotInput.setInputFiles(gallery.shots.slice(0, 35));
    await page.waitForTimeout(Math.min(45000, gallery.shots.length * 1200));
    stats.screenshotsUploaded = gallery.shots.length;
    console.log(`screenshots_uploaded ${gallery.shots.length}`);
  }

  await page.locator('[name="file_version"]').fill(VERSION);
  await page.evaluate((text) => {
    const ta = document.querySelector('textarea[name="file_changelog[5]"], textarea[name="file_changelog"]');
    if (ta) {
      ta.value = text;
      if (typeof CKEDITOR !== 'undefined') {
        for (const k in CKEDITOR.instances) {
          if (CKEDITOR.instances[k].element?.$ === ta) {
            CKEDITOR.instances[k].setData(text.replace(/\n/g, '<br>'));
            CKEDITOR.instances[k].updateElement();
          }
        }
      }
    }
  }, CHANGELOG);

  left = await page.evaluate(() =>
    [...document.querySelectorAll('.ipsUploader__row')]
      .map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /\.zip|12\s*кб/i.test(t))
  );
  console.log(`zip_rows_final ${JSON.stringify(left)}`);

  await turnOffBuyerNotify(page);
  const notifyState = await page.evaluate(
    () => document.querySelector('#check_notify_update, [name="notify_update_checkbox"]')?.checked
  );
  console.log(`notify_before_submit ${notifyState}`);

  const submitBtn = page.locator('button.ipsButton_primary').filter({ hasText: /Save & Submit New Version/i });
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();
  await page.waitForURL(/6293-ukrposhta-api|do=newVersion|files\/file\/6293/i, { timeout: 120000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const afterSubmit = await page.evaluate(() => ({
    url: location.href,
    msgs: [...document.querySelectorAll('.ipsMessage, .ipsFlashMsg')]
      .map((m) => m.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    stillOnNewVersion: /do=newVersion/i.test(location.href),
    hasSubmitBtn: [...document.querySelectorAll('button')].some((b) =>
      /Save & Submit New Version/i.test(b.textContent || '')
    ),
    mod: /На модерації|moderation/i.test(document.body.innerText || ''),
  }));
  console.log(`after_submit ${JSON.stringify(afterSubmit)}`);

  if (afterSubmit.stillOnNewVersion && afterSubmit.hasSubmitBtn) {
    return { ok: false, blocker: 'submit_not_confirmed', zipRows: left, stats };
  }
  return { ok: true, zipRows: left, afterSubmit, stats };
}

async function verifyGuest(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const t = document.body.innerText || '';
    const h1 = (document.querySelector('h1')?.textContent || '').trim();
    return {
      url: location.href,
      h1,
      hasVersion: t.includes('2.3.1'),
      zipSize: (t.match(/Розмір файлу\s*(\S+\s*\S*)|File size\s*(\S+\s*\S*)/i) || [])[1] || '',
      stub12kb: /12\s*КБ|12\s*KB/i.test(t),
      price1300: /1[\s\u00a0]?300/.test(t),
      mod: /На модерації|Under moderation/i.test(t),
      enTitle: /Ukrposhta API|shipping module for OpenCart/i.test(h1),
      ukBodyOnEn: /\/en\//.test(location.href) && /організації доставки|модуль доставки для OpenCart/i.test(t.slice(0, 600)),
      thumbs: document.querySelectorAll('.mp-thumb').length,
    };
  });
  await page.close();
  return data;
}

async function main() {
  if (!fs.existsSync(ZIP)) {
    console.log(`BLOCKER missing_zip ${ZIP}`);
    process.exit(1);
  }

  const resume = process.argv.includes('--resume');
  const context = await chromium.launchPersistentContext(path.join(__dirname, '.profile-chrome'), {
    channel: 'chrome',
    headless: false,
    viewport: null,
  });
  let page = context.pages().find((p) => /do=newVersion/i.test(p.url()))
    || context.pages()[0]
    || (await context.newPage());
  page.setDefaultTimeout(180000);

  const result = await fixNewVersion(page, { resume });
  console.log(`stats ${JSON.stringify(result.stats || {})}`);
  if (result.login) {
    console.log(`STATUS WAITING_LOGIN${result.mfa ? ' mfa' : ''}`);
    process.exit(2);
  }
  if (!result.ok) {
    console.log(`STATUS blocked ${result.blocker || 'newversion_failed'}`);
    await context.close();
    process.exit(1);
  }

  const guest = await chromium.launch({ channel: 'chrome', headless: true });
  const guestCtx = await guest.newContext();
  const uk = await verifyGuest(guestCtx, PUBLIC);
  const en = await verifyGuest(guestCtx, PUBLIC_EN);
  const ru = await verifyGuest(guestCtx, PUBLIC_RU);
  await guest.close();

  const ok =
    !result.afterSubmit?.stillOnNewVersion
    && !uk.stub12kb
    && !en.stub12kb
    && !ru.stub12kb
    && uk.hasVersion
    && en.hasVersion
    && ru.hasVersion
    && en.enTitle
    && !en.ukBodyOnEn
    && uk.price1300
    && en.price1300
    && uk.thumbs > 0
    && uk.thumbs <= 35;

  console.log(`guest_uk ${JSON.stringify(uk)}`);
  console.log(`guest_en ${JSON.stringify(en)}`);
  console.log(`guest_ru ${JSON.stringify(ru)}`);
  console.log(`STATUS ${ok ? 'updated' : result.afterSubmit?.stillOnNewVersion ? 'blocked' : 'submitted'}`);
  if (!resume) {
    await context.close();
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
