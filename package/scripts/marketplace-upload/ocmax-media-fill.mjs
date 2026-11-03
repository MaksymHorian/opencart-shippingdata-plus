/**
 * oc-max.com — ZIP download + product images (logo first, then screenshots).
 *   node ocmax-media-fill.mjs [novaposhta|meest|ukrposhta|rozetka_delivery]
 *   node ocmax-media-fill.mjs meest --shots-only --product-id 54
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODULES } from './ocmax-modules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../image-screenshot/package.json'));
const { chromium } = require('playwright');

const PROFILE = path.join(__dirname, '.profile-ocmax-chrome');
const TOKEN_FILE = path.join(__dirname, '.ocmax-admin-token');
const CDP_PORT = 9333;
const LANG = { ru: '1', en: '2', uk: '3' };

function parseModuleArgs(argv) {
  let key = 'novaposhta';
  let shotsOnly = false;
  let productId = '';
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--shots-only') {
      shotsOnly = true;
    } else if (a === '--product-id') {
      productId = argv[i + 1] || '';
      i += 1;
    } else if (!a.startsWith('-') && MODULES[a]) {
      key = a;
    }
  }
  return { key: key, shotsOnly: shotsOnly, productId: productId };
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
    const browser = await chromium.connectOverCDP('http://127.0.0.1:' + CDP_PORT);
    const context = browser.contexts()[0];
    if (!context) {
      console.log('STATUS BLOCKED profile_in_use');
      process.exit(1);
    }
    return { context: context };
  }
}

function shotPaths(galleryDir) {
  return fs.readdirSync(galleryDir)
    .filter((n) => /^screenshot_/i.test(n) && /\.png$/i.test(n))
    .sort((a, b) => {
      const na = parseInt((a.match(/(\d+)/) || ['0', '999'])[1], 10);
      const nb = parseInt((b.match(/(\d+)/) || ['0', '999'])[1], 10);
      if (na !== nb) {
        return na - nb;
      }
      return a.localeCompare(b);
    })
    .map((n) => path.join(galleryDir, n));
}

async function acceptDialogs(page) {
  page.on('dialog', async (d) => {
    try {
      await d.accept();
    } catch (e) {
      /* already gone */
    }
  });
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

async function listDownloadId(page, token, spec) {
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
    }
    return '';
  }, spec.dlMatch);
}

async function ensureDownload(page, token, spec) {
  let id = await listDownloadId(page, token, spec);
  if (id) {
    console.log('download_exists ' + id);
    return id;
  }
  await page.goto(adminUrl('catalog/download/add', token), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ LANG, DL_NAME }) => {
    Object.keys(LANG).forEach((key) => {
      const el = document.querySelector('input[name="download_description[' + LANG[key] + '][name]"]');
      if (el) {
        el.value = DL_NAME;
      }
    });
  }, { LANG: LANG, DL_NAME: spec.dlName });
  await page.click('#button-upload');
  const fileInp = page.locator('#form-upload input[type="file"]');
  await fileInp.waitFor({ state: 'attached', timeout: 10000 });
  await fileInp.setInputFiles(spec.zip);
  await page.waitForFunction(() => {
    const el = document.querySelector('input[name="filename"]');
    return el && el.value && el.value.length > 3;
  }, { timeout: 120000 });
  await page.evaluate((mask) => {
    const m = document.querySelector('input[name="mask"]');
    if (m && !m.value) {
      m.value = mask;
    }
  }, spec.dlName);
  await clickSave(page, 'form-download');
  id = (page.url().match(/download_id=(\d+)/) || [])[1] || await listDownloadId(page, token, spec);
  console.log(id ? 'download_created ' + id : 'STATUS IMAGES_MANUAL download');
  return id || '';
}

async function openFilemanager(page, token, directory) {
  const extra = directory ? { directory: directory } : {};
  await page.goto(adminUrl('common/filemanager', token, extra), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#button-upload', { timeout: 20000 });
}

async function ensureFolder(page, token, folder) {
  const created = await page.evaluate(async ({ token, folder }) => {
    const r = await fetch('index.php?route=common/filemanager/folder&' + token.name + '=' + encodeURIComponent(token.value) + '&directory=', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'folder=' + encodeURIComponent(folder),
    });
    try {
      return await r.json();
    } catch (e) {
      return { error: 'bad_json' };
    }
  }, { token: token, folder: folder });
  console.log('folder ' + (created.success ? 'ok' : (created.error || 'exists')));
}

async function listFolderImages(page, token, directory) {
  const files = [];
  for (let pageNo = 1; pageNo <= 20; pageNo += 1) {
    const chunk = await page.evaluate(async ({ token, directory, pageNo }) => {
      const u = new URL(location.origin + '/admin/index.php');
      u.searchParams.set('route', 'common/filemanager');
      u.searchParams.set(token.name, token.value);
      u.searchParams.set('directory', directory);
      u.searchParams.set('page', String(pageNo));
      const r = await fetch(u.pathname + u.search, { credentials: 'same-origin' });
      const html = await r.text();
      return [...html.matchAll(/name="path\[\]"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="path\[\]"/g)].map((m) => m[1] || m[2]);
    }, { token: token, directory: directory, pageNo: pageNo });
    if (!chunk.length) {
      break;
    }
    chunk.forEach((p) => {
      if (p && files.indexOf(p) === -1) {
        files.push(p);
      }
    });
    if (chunk.length < 16) {
      break;
    }
  }
  return files;
}

async function deleteFolderFiles(page, token, paths) {
  if (!paths.length) {
    console.log('delete_shots 0');
    return;
  }
  const json = await page.evaluate(async ({ token, paths }) => {
    const body = new URLSearchParams();
    paths.forEach((p) => body.append('path[]', p));
    const u = 'index.php?route=common/filemanager/delete&' + token.name + '=' + encodeURIComponent(token.value);
    const r = await fetch(u, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    });
    try {
      return await r.json();
    } catch (e) {
      return { error: 'bad_json' };
    }
  }, { token: token, paths: paths });
  console.log('delete_shots ' + paths.length + ' ' + (json.success ? 'ok' : (json.error || 'done')));
}

async function uploadToFilemanager(page, token, directory, files) {
  await page.evaluate(() => {
    const old = document.getElementById('form-upload');
    if (old) {
      old.remove();
    }
    const form = document.createElement('form');
    form.id = 'form-upload';
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'file[]';
    input.multiple = true;
    form.appendChild(input);
    document.body.prepend(form);
  });
  await page.locator('#form-upload input[type="file"]').setInputFiles(files);
  const json = await page.evaluate(async ({ token, directory }) => {
    const fd = new FormData(document.getElementById('form-upload'));
    const r = await fetch('index.php?route=common/filemanager/upload&' + token.name + '=' + encodeURIComponent(token.value) + '&directory=' + encodeURIComponent(directory), {
      method: 'POST',
      body: fd,
    });
    try {
      return await r.json();
    } catch (e) {
      return { error: 'bad_json' };
    }
  }, { token: token, directory: directory });
  if (json.error) {
    console.log('upload_warn ' + String(json.error).slice(0, 160));
  } else {
    console.log('upload_ok ' + files.length);
  }
}

async function assignImages(page, spec, shots) {
  await page.evaluate(() => {
    const close = document.querySelector('#modal-image .close, #filemanager .close, .modal .close');
    if (close) {
      close.click();
    }
  });
  await page.waitForTimeout(400);
  const paths = ['catalog/' + spec.folder + '/logo.png'].concat(
    shots.map((p) => 'catalog/' + spec.folder + '/' + path.basename(p)),
  );
  await page.evaluate((paths) => {
    const main = document.querySelector('#input-image, input[name="image"]');
    if (main) {
      main.value = paths[0];
    }
    document.querySelectorAll('#images tbody tr[id^="image-row"]').forEach((tr) => tr.remove());
    if (typeof window.image_row !== 'undefined') {
      window.image_row = 0;
    }
    const extras = paths.slice(1);
    extras.forEach((img, i) => {
      if (typeof window.addImage === 'function') {
        window.addImage();
      }
      const hid = document.querySelector('input[name="product_image[' + i + '][image]"]');
      const sort = document.querySelector('input[name="product_image[' + i + '][sort_order]"]');
      if (hid) {
        hid.value = img;
      }
      if (sort) {
        sort.value = String(i + 1);
      }
    });
  }, paths);
  console.log('images_assigned logo+' + (paths.length - 1));
}

async function attachDownload(page, spec, downloadId) {
  if (!downloadId) {
    return;
  }
  await page.evaluate(() => {
    const a = document.querySelector('a[href="#tab-links"]');
    if (a) {
      a.click();
    }
  });
  await page.waitForTimeout(200);
  await page.evaluate(({ id, name }) => {
    const box = document.getElementById('product-download');
    if (!box) {
      return;
    }
    if (document.querySelector('input[name="product_download[]"][value="' + id + '"]')) {
      return;
    }
    const div = document.createElement('div');
    div.id = 'product-download' + id;
    div.innerHTML = '<i class="fa fa-minus-circle"></i> ' + name + '<input type="hidden" name="product_download[]" value="' + id + '">';
    box.appendChild(div);
  }, { id: downloadId, name: spec.dlName });
  console.log('download_attached ' + downloadId);
}

async function fillManufacturerLogo(page, token) {
  await page.goto(adminUrl('catalog/manufacturer/edit', token, { manufacturer_id: '11' }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((img) => {
    const hid = document.querySelector('#input-image, input[name="image"]');
    if (hid) {
      hid.value = img;
    }
  }, 'catalog/novaposhta/logo.png');
  await clickSave(page, 'form-manufacturer');
  console.log('manufacturer_logo_set');
}

async function main() {
  const args = parseModuleArgs(process.argv);
  const spec = MODULES[args.key];
  const productId = args.productId || spec.productId || listingProductId(spec.listingDir);
  if (!args.shotsOnly && !fs.existsSync(spec.zip)) {
    console.log('STATUS BLOCKED ZIP missing');
    process.exit(1);
  }
  const logo = path.join(spec.galleryDir, 'logo.png');
  const shots = shotPaths(spec.galleryDir);
  if (!fs.existsSync(logo)) {
    console.log('STATUS BLOCKED logo missing');
    process.exit(1);
  }
  if (!productId) {
    console.log('STATUS BLOCKED no_product_id — add product first, then --product-id N');
    process.exit(1);
  }
  const { context } = await launchOrAttach();
  const page = pickAdminPage(context) || await context.newPage();
  await page.bringToFront().catch(() => {});
  await acceptDialogs(page);
  if (!(await isLoggedIn(page))) {
    console.log('STATUS WAITING_LOGIN');
    process.exit(0);
  }
  const token = await readAdminToken(page);
  fs.writeFileSync(TOKEN_FILE, token.name + '=' + token.value, 'utf8');
  console.log('module ' + args.key + ' product_id ' + productId);
  console.log('shots ' + shots.length);

  let downloadId = '';
  if (!args.shotsOnly) {
    downloadId = await ensureDownload(page, token, spec);
  } else {
    downloadId = await listDownloadId(page, token, spec);
  }

  await openFilemanager(page, token, '');
  await ensureFolder(page, token, spec.folder);
  await openFilemanager(page, token, spec.folder);
  const existing = await listFolderImages(page, token, spec.folder);
  console.log('folder_files ' + existing.length);
  const stale = existing.filter((p) => /screenshot_/i.test(p));
  await deleteFolderFiles(page, token, stale);

  if (!args.shotsOnly) {
    console.log('upload_logo');
    await uploadToFilemanager(page, token, spec.folder, [logo]);
  }
  const batch = 6;
  for (let i = 0; i < shots.length; i += batch) {
    const chunk = shots.slice(i, i + batch);
    console.log('upload_shots ' + (i + 1) + '-' + (i + chunk.length));
    await uploadToFilemanager(page, token, spec.folder, chunk);
  }
  await page.goto(adminUrl('catalog/product/edit', token, { product_id: productId }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await assignImages(page, spec, shots);
  await attachDownload(page, spec, downloadId);
  await clickSave(page, 'form-product');
  const alert = await page.evaluate(() => {
    const a = document.querySelector('.alert-danger');
    return a ? (a.textContent || '').replace(/\s+/g, ' ').trim() : '';
  });
  if (alert) {
    console.log('STATUS BLOCKED save_validation ' + alert.slice(0, 200));
    process.exit(1);
  }
  if (!args.shotsOnly && args.key === 'novaposhta') {
    await fillManufacturerLogo(page, token);
  }
  console.log('STATUS MEDIA');
  console.log('product_id ' + productId + ' logo first, shots ' + shots.length + ', download ' + (downloadId || 'none'));
  process.exit(0);
}

main().catch((err) => {
  console.log('STATUS BLOCKED ' + err.message);
  process.exit(1);
});
