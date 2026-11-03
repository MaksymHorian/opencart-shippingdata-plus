#!/usr/bin/env node
/**
 * Admin UI screenshots via Playwright (real Chromium window, maximized).
 * Spec: docs/{module}/images/SCREENSHOTS.md
 * Output: OCMax/{Product}/images/ (see module manifest screenshots.*)
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const ALERT_DB_OK = 'Дані успішно оновлено';
const ALERT_CN_OK = 'Накладна успішно збережена';

/** Named FAQ shots — same IDs/actions for every carrier; not included in `-Targets all`. */
const NAMED_FAQ_SHOTS = {
  i_cron_tracking: { action: 'cronTrackingAnnotated', file: 'i_cron_tracking.png' },
  i_order: { action: 'orderInfoCnAnnotated', file: 'i_order.png' },
  i_orders: { action: 'orderListCnAnnotated', file: 'i_orders.png' },
  i_tracking_statuses_settings: {
    action: 'trackingStatusesSettingsAnnotated',
    file: 'i_tracking_statuses_settings.png',
  },
};

/**
 * Per-module profiles — keep in sync with docs/{module}/images/SCREENSHOTS.md
 * `shots[id]` = action name (+ optional params). IDs are 1-based; index 0 unused.
 */
const MODULE_PROFILES = {
  ukrposhta: {
    route: 'extension/shipping/ukrposhta',
    form: '#form-ukrposhta',
    orderId: 1,
    clearCredentialFields: ['#input-ecom_bearer', '#input-tracking_bearer', '#input-user_token'],
    dbPercentDeltas: { references: 10, cities: 10, departments: 10 },
    dbDeltas: {},
    clearSenderFields: [
      '#input-sender_name',
      '#input-sender_tin',
      '#input-sender_bank_account',
      '#input-sender_phone',
      '#input-sender_house',
      '#input-sender_flat',
    ],
    departureMacros: '#departure_description_t_m',
    cronMacros: '#message-macros-collapse',
    componentsListButton: '#button-components_list-0',
    orderListQuickCnButton: '#button-cn-q-1',
    maxTarget: 23,
    checkoutProductId: 40,
    checkout: {
      city: 'Суми',
      citySearch: 'суми',
      region: 'Сумська область',
      phone: '380999999999',
      lastname: 'Іванов',
      firstname: 'Іван',
      patronymic: 'Іванович',
      comments: {
        department: 'Тестове замовлення - Експрес до відділення Укрпошта',
        poshtomat: '',
        doors: 'Тестове замовлення - Експрес кур\'єр Укрпошта на адресу',
      },
      shippingCodes: {
        department: 'ukrposhta.express_department',
        doors: 'ukrposhta.express_doors',
      },
      doorsField: '#shipping_address_postcode',
      streetQuery: '4000',
    },
    shots: {
      1: { action: 'settingsGeneralClearSave' },
      2: { action: 'settingsGeneralSub', href: '#tab-express_department' },
      3: { action: 'settingsGeneralSub', href: '#tab-express_doors' },
      4: { action: 'settingsGeneralSub', href: '#tab-standard_department' },
      5: { action: 'settingsGeneralSub', href: '#tab-standard_doors' },
      6: { action: 'settingsTab', href: '#tab-tariffs' },
      7: { action: 'database' },
      8: { action: 'sender' },
      9: { action: 'settingsTab', href: '#tab-recipient' },
      10: { action: 'departureMacros' },
      11: { action: 'settingsTab', href: '#tab-payment' },
      12: { action: 'settingsTab', href: '#tab-consignment_note' },
      13: { action: 'cronMacros' },
      14: { action: 'support' },
      15: { action: 'orderListCnShortcuts' },
      16: { action: 'cnForm' },
      17: { action: 'cnFormTotals' },
      18: { action: 'cnListAlertGear' },
      19: { action: 'cnListAddToGroup' },
      20: { action: 'checkoutDepartment', shippingCode: 'ukrposhta.express_department', comment: 'Тестове замовлення - Експрес до відділення Укрпошта' },
      21: { action: 'checkoutDoors', shippingCode: 'ukrposhta.express_doors', comment: 'Тестове замовлення - Експрес кур\'єр Укрпошта на адресу' },
      22: { action: 'checkoutDepartment', shippingCode: 'ukrposhta.standard_department', comment: 'Тестове замовлення - Стандарт до відділення Укрпошта' },
      23: { action: 'checkoutDoors', shippingCode: 'ukrposhta.standard_doors', comment: 'Тестове замовлення - Стандарт кур\'єр Укрпошта на адресу' },
    },
    namedShots: NAMED_FAQ_SHOTS,
  },
  rozetka_delivery: {
    route: 'extension/shipping/rozetka_delivery',
    form: '#form-rozetka_delivery',
    orderId: 2,
    maxTarget: 16,
    checkoutProductId: 40,
    clearCredentialFields: ['#input-phone', '#input-password'],
    dbPercentDeltas: { references: 10, cities: 10, departments: 10 },
    dbDeltas: {},
    clearSenderFields: ['#input-sender', '#input-sender_contact_person', '#input-sender_contact_person_phone'],
    departureMacros: '#departure_additional_information_t_m',
    cronMacros: '#message-macros-collapse',
    componentsListButton: '#button-components_list',
    orderListQuickCnButton: '#button-cn-q-2',
    recipientContactColumnHeader: 'Контактна особа отримувача',
    recipientContactMockHtml: 'Тестовий Тест<br>380999999999',
    checkout: {
      city: 'Суми',
      citySearch: 'суми',
      region: 'Сумська область',
      phone: '380999999999',
      lastname: 'Іванов',
      firstname: 'Іван',
      patronymic: 'Іванович',
      comments: {
        department: 'Тестове замовлення - Доставка у відділення ROZETKA Delivery',
      },
      shippingCodes: {
        department: 'rozetka_delivery.department',
      },
    },
    shots: {
      1: { action: 'settingsGeneralClearSave' },
      2: { action: 'settingsGeneralSub', href: '#tab-department' },
      3: { action: 'settingsTab', href: '#tab-tariffs' },
      4: { action: 'database' },
      5: { action: 'sender' },
      6: { action: 'settingsTab', href: '#tab-recipient' },
      7: { action: 'departureMacros' },
      8: { action: 'settingsTab', href: '#tab-payment' },
      9: { action: 'settingsTab', href: '#tab-consignment_note' },
      10: { action: 'cronMacros' },
      11: { action: 'support' },
      12: { action: 'orderListCnShortcuts' },
      13: { action: 'cnForm' },
      14: { action: 'cnFormTotals' },
      15: { action: 'cnListAlertGear' },
      16: { action: 'checkoutDepartment' },
    },
    namedShots: NAMED_FAQ_SHOTS,
  },
  novaposhta: {
    route: 'extension/shipping/novaposhta',
    form: '#form-novaposhta',
    orderId: 3,
    maxTarget: 23,
    checkoutProductId: 40,
    clearCredentialFields: ['#input-key_api'],
    dbPercentDeltas: { references: 10, cities: 10, departments: 10 },
    dbDeltas: {},
    clearSenderFields: ['#input-sender', '#input-sender_contact_person'],
    departureMacros: '#departure_additional_information_t_m',
    cronMacros: '#message-macros-collapse',
    componentsListButton: '#button-components_list',
    orderListQuickCnButton: '#button-cn-q-3',
    checkout: {
      city: 'Суми',
      citySearch: 'суми',
      region: 'Сумська область',
      phone: '380999999999',
      lastname: 'Іванов',
      firstname: 'Іван',
      patronymic: 'Іванович',
      comments: {
        department: 'Тестове замовлення - Доставка у відділення Нової пошти',
        poshtomat: 'Тестове замовлення - Доставка в поштомат Нової пошти',
        doors: 'Тестове замовлення - Доставка кур\'єром Нової пошти на адресу',
      },
      shippingCodes: {
        department: 'novaposhta.department',
        poshtomat: 'novaposhta.poshtomat',
        doors: 'novaposhta.doors',
      },
      streetQuery: 'Пере',
    },
    shots: {
      1: { action: 'settingsGeneralClearSave' },
      2: { action: 'settingsGeneralSub', href: '#tab-department' },
      3: { action: 'settingsGeneralSub', href: '#tab-poshtomat' },
      4: { action: 'settingsGeneralSub', href: '#tab-doors' },
      5: { action: 'settingsTab', href: '#tab-tariffs' },
      6: { action: 'database' },
      7: { action: 'sender' },
      8: { action: 'settingsTab', href: '#tab-recipient' },
      9: { action: 'departureMacros' },
      10: { action: 'settingsTab', href: '#tab-payment' },
      11: { action: 'settingsTab', href: '#tab-consignment_note' },
      12: { action: 'cronMacros' },
      13: { action: 'support' },
      14: { action: 'orderListCnShortcuts' },
      15: { action: 'cnForm' },
      16: { action: 'cnFormTotals' },
      17: { action: 'cnFormSeatCalc' },
      18: { action: 'cnListAlertGear' },
      19: { action: 'cnListAddToRegistry' },
      20: { action: 'cnListPrintSettings' },
      21: { action: 'checkoutDepartment' },
      22: { action: 'checkoutPoshtomat' },
      23: { action: 'checkoutDoors' },
    },
    namedShots: NAMED_FAQ_SHOTS,
  },
  meest: {
    route: 'extension/shipping/meest',
    form: '#form-meest',
    orderId: 4,
    maxTarget: 24,
    registryFilterDate: '2026-08-14',
    checkoutProductId: 40,
    clearCredentialFields: ['#input-api_token', '#input-contract_id'],
    dbPercentDeltas: { references: 10, cities: 10, departments: 10 },
    dbDeltas: {},
    clearSenderFields: ['#input-sender', '#input-sender_phone'],
    departureMacros: '#departure_additional_information_t_m',
    cronMacros: '#message-macros-collapse',
    componentsListButton: '#button-components_list',
    orderListQuickCnButton: '#button-cn-q-4',
    checkout: {
      city: 'Суми',
      citySearch: 'суми',
      region: 'Сумська область',
      phone: '380999999999',
      lastname: 'Іванов',
      firstname: 'Іван',
      patronymic: 'Іванович',
      comments: {
        department: 'Тестове замовлення - Доставка у відділення Meest ПОШТА',
        poshtomat: 'Тестове замовлення - Доставка у поштомат Meest ПОШТА',
        doors: 'Тестове замовлення - Кур\'єрська доставка Meest ПОШТА на адресу',
      },
      shippingCodes: {
        department: 'meest.department',
        poshtomat: 'meest.poshtomat',
        doors: 'meest.doors',
      },
      streetQuery: 'Пере',
    },
    shots: {
      1: { action: 'settingsGeneralClearSave' },
      2: { action: 'settingsGeneralSub', href: '#tab-department' },
      3: { action: 'settingsGeneralSub', href: '#tab-poshtomat' },
      4: { action: 'settingsGeneralSub', href: '#tab-doors' },
      5: { action: 'settingsTab', href: '#tab-tariffs' },
      6: { action: 'database' },
      7: { action: 'sender' },
      8: { action: 'settingsTab', href: '#tab-recipient' },
      9: { action: 'departureMacros' },
      10: { action: 'settingsTab', href: '#tab-payment' },
      11: { action: 'settingsTab', href: '#tab-consignment_note' },
      12: { action: 'cronMacros' },
      13: { action: 'support' },
      14: { action: 'orderListCnShortcuts' },
      15: { action: 'cnForm' },
      16: { action: 'cnFormTotals' },
      17: { action: 'cnListAlertGear' },
      18: { action: 'cnListAddToRegistry' },
      19: { action: 'cnListPrintSettings' },
      20: { action: 'registryList' },
      21: { action: 'registryCreateModal' },
      22: { action: 'checkoutDepartment' },
      23: { action: 'checkoutPoshtomat' },
      24: { action: 'checkoutDoors' },
    },
    namedShots: NAMED_FAQ_SHOTS,
  },
};

function parseArgs(argv) {
  const out = { module: 'ukrposhta', targets: '1', baseUrl: 'http://oc3/admin', catalogBaseUrl: '', outDir: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--module') out.module = argv[++i];
    else if (a === '--targets') out.targets = argv[++i];
    else if (a === '--base-url') out.baseUrl = argv[++i].replace(/\/$/, '');
    else if (a === '--catalog-base-url') out.catalogBaseUrl = argv[++i].replace(/\/$/, '');
    else if (a === '--out-dir') out.outDir = argv[++i];
  }
  return out;
}

function catalogBaseFromAdmin(baseUrl, explicit) {
  if (explicit) return explicit.replace(/\/$/, '');
  return baseUrl.replace(/\/admin\/?$/i, '') || 'http://oc3';
}

function getProfile(module) {
  const profile = MODULE_PROFILES[module];
  if (!profile) {
    throw new Error(`Unknown module '${module}'. Known: ${Object.keys(MODULE_PROFILES).join(', ')}`);
  }
  return profile;
}

function parseTargets(s, maxTarget = 14, namedKeys = []) {
  if (!s || s === 'all') return Array.from({ length: maxTarget }, (_, i) => i + 1);
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const part of s.split(',')) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-') && /^\d+-\d+$/.test(p)) {
      const [a, b] = p.split('-').map(Number);
      for (let i = a; i <= b; i++) add(i);
    } else if (/^\d+$/.test(p)) {
      add(Number(p));
    } else if (namedKeys.includes(p)) {
      add(p);
    } else {
      throw new Error(`Unknown target '${p}'. Named: ${namedKeys.join(', ') || '(none)'}`);
    }
  }
  return ids;
}

async function removeMocks(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.screenshot-mock').forEach((n) => n.remove());
    document.querySelectorAll('.screenshot-mock-hide').forEach((n) => {
      n.style.removeProperty('display');
      n.classList.remove('screenshot-mock-hide');
    });
    document.querySelector('.screenshot-order-cn-bar')?.remove();
    const main = document.querySelector('#content > .container-fluid');
    if (main?.classList.contains('screenshot-mock-pad-top')) {
      main.style.removeProperty('padding-top');
      main.classList.remove('screenshot-mock-pad-top');
    }
    const content = document.getElementById('content');
    if (content?.classList.contains('screenshot-mock-pad-top')) {
      content.style.removeProperty('padding-top');
      content.classList.remove('screenshot-mock-pad-top');
    }
  });
}

async function padContentTop(page, px = 28) {
  return page.evaluate((pad) => {
    const content = document.getElementById('content');
    if (!content) return { ok: false, reason: 'missing #content' };
    content.classList.add('screenshot-mock-pad-top');
    content.style.paddingTop = `${pad}px`;
    return { ok: true };
  }, px);
}

async function hideAfterCronTracking(page) {
  return page.evaluate(() => {
    const tab = document.getElementById('tab-cron');
    const track = document.getElementById('input-cron_departures_tracking');
    if (!tab || !track) return { ok: false, reason: 'tab-cron or tracking input missing' };
    let group = track.parentElement;
    while (group && group !== tab) {
      if (group.parentElement === tab && group.classList.contains('form-group')) break;
      group = group.parentElement;
    }
    if (!group || group.parentElement !== tab) {
      return { ok: false, reason: 'tracking form-group missing' };
    }
    const hideEl = (el) => {
      if (!el) return;
      el.classList.add('screenshot-mock-hide');
      el.style.setProperty('display', 'none', 'important');
    };
    let hide = false;
    [...tab.children].forEach((child) => {
      if (hide) hideEl(child);
      if (child === group) hide = true;
    });
    hideEl(document.getElementById('footer'));
    document.querySelectorAll('#form-meest > .tab-content > .tab-pane').forEach((pane) => {
      if (pane.id !== 'tab-cron') hideEl(pane);
    });
    return { ok: true };
  });
}

async function screenshotElement(page, selector, outPath, padTop = 0, clipBottomViewport = null) {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`Element not found for screenshot: ${selector}`);
  }
  const vp = page.viewportSize();
  const vpH = vp?.height || 2000;
  const useClip = padTop > 0 || clipBottomViewport != null;
  if (useClip) {
    const y = padTop > 0 ? Math.max(0, box.y - padTop) : box.y;
    const rawBottom = clipBottomViewport != null ? clipBottomViewport : (y + box.height + padTop);
    const bottom = Math.min(rawBottom, vpH);
    const height = Math.max(1, bottom - y);
    await page.screenshot({
      path: outPath,
      clip: {
        x: box.x,
        y,
        width: box.width,
        height,
      },
    });
  } else {
    await page.locator(selector).screenshot({ path: outPath });
  }
  const stats = fs.statSync(outPath);
  if (stats.size < 10000) {
    throw new Error(`Screenshot too small (${stats.size} bytes): ${outPath}`);
  }
  console.log(`ok ${outPath}`);
}

async function getOrderListClipBottom(page) {
  return page.evaluate(() => {
    const content = document.getElementById('content');
    if (!content) return null;
    let bottom = content.getBoundingClientRect().top;
    const pageHeader = content.querySelector('.page-header');
    if (pageHeader) {
      bottom = Math.max(bottom, pageHeader.getBoundingClientRect().bottom);
    }
    const tableWrap = document.querySelector('#form-order .table-responsive');
    if (tableWrap) {
      bottom = Math.max(bottom, tableWrap.getBoundingClientRect().bottom);
    }
    document.querySelectorAll(
      '.btn-group.open .dropdown-menu, #screenshot-order-row-cn-menu, body > .dropdown-menu.screenshot-mock',
    ).forEach((menu) => {
      bottom = Math.max(bottom, menu.getBoundingClientRect().bottom);
    });
    return bottom + 12;
  });
}

async function ensureMacrosCollapsed(page, collapseSelector) {
  const href = collapseSelector.startsWith('#') ? collapseSelector : `#${collapseSelector}`;
  const isOpen = await page.locator(href).evaluate((el) => el.classList.contains('in') || el.classList.contains('show'));
  if (isOpen) {
    await page.locator(`a[href="${href}"]`).click();
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && !el.classList.contains('in') && !el.classList.contains('show');
      },
      href,
      { timeout: 5000 },
    );
  }
  await page.waitForTimeout(200);
}

async function getTrackingStatusesSettingsClip(page) {
  return page.evaluate(() => {
    const content = document.getElementById('content');
    const tab = document.getElementById('tab-cron');
    const legend = (() => {
      const track = document.getElementById('input-cron_departures_tracking');
      if (!track || !tab) return null;
      let group = track.parentElement;
      while (group && group !== tab) {
        if (group.parentElement === tab && group.classList.contains('form-group')) break;
        group = group.parentElement;
      }
      if (!group) return null;
      const prev = group.previousElementSibling;
      return prev && prev.tagName === 'LEGEND' ? prev : null;
    })();
    const table = document.getElementById('table-tracking_statuses');
    if (!content || !legend || !table) return null;
    const panel = table.closest('.panel.panel-default') || table;
    const tfoot = table.querySelector('tfoot');
    const bottomEl = tfoot || panel;
    const contentBox = content.getBoundingClientRect();
    const top = legend.getBoundingClientRect().top + window.scrollY - 7;
    const bottom = bottomEl.getBoundingClientRect().bottom + window.scrollY + 12;
    return {
      x: contentBox.left + window.scrollX,
      y: top,
      width: contentBox.width,
      height: bottom - top,
    };
  });
}

async function screenshotClipRect(page, outPath, clip, fullPage = false) {
  if (!clip || clip.width <= 0 || clip.height <= 0) {
    throw new Error('Invalid screenshot clip rect');
  }
  await page.screenshot({ path: outPath, clip, fullPage });
  const stats = fs.statSync(outPath);
  if (stats.size < 10000) {
    throw new Error(`Screenshot too small (${stats.size} bytes): ${outPath}`);
  }
  console.log(`ok ${outPath}`);
}

async function injectCronTrackingArrows(page) {
  return page.evaluate(() => {
    document.getElementById('screenshot-cron-arrows')?.remove();
    const content = document.getElementById('content');
    const keyEl = document.getElementById('input-key_cron');
    const trackEl = document.getElementById('input-cron_departures_tracking');
    if (!content || !keyEl || !trackEl) {
      return { ok: false, reason: 'missing #content, #input-key_cron or #input-cron_departures_tracking' };
    }

    const origin = content.getBoundingClientRect();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
        cx: r.left - origin.left + Math.min(80, r.width * 0.2),
        cy: r.top - origin.top + r.height / 2,
      };
    };

    const key = box(keyEl);
    const track = box(trackEl);
    const color = '#e00000';
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'screenshot-cron-arrows');
    svg.setAttribute('class', 'screenshot-mock');
    const svgW = Math.ceil(content.scrollWidth || origin.width);
    const svgH = Math.ceil(content.scrollHeight || origin.height);
    svg.setAttribute('width', String(svgW));
    svg.setAttribute('height', String(svgH));
    svg.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;z-index:2147483646;pointer-events:none;overflow:visible;';
    if (getComputedStyle(content).position === 'static') {
      content.style.position = 'relative';
    }

    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'cron-arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    const tip = document.createElementNS(NS, 'path');
    tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    tip.setAttribute('fill', color);
    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const addArrow = (x1, y1, x2, y2) => {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#cron-arrowhead)');
      svg.appendChild(line);
    };

    const addLabel = (x, y, w, h, text) => {
      const fo = document.createElementNS(NS, 'foreignObject');
      fo.setAttribute('x', String(x));
      fo.setAttribute('y', String(y));
      fo.setAttribute('width', String(w));
      fo.setAttribute('height', String(h));
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.cssText =
        'font:700 14px/1.35 Arial,Helvetica,sans-serif;color:#e00000;'
        + 'text-shadow:0 0 4px #fff,0 0 4px #fff,1px 1px 0 #fff,-1px -1px 0 #fff;';
      div.textContent = text;
      fo.appendChild(div);
      svg.appendChild(fo);
    };

    const label1 = '1. Генеруєте або задаєте довільний ключ';
    const label2 = '2. Cron команда з ключем (налаштовується на хостингу/сервері)';

    const l1w = 340;
    const l1h = 40;
    const l1x = Math.max(16, key.x - 20);
    const l1y = Math.max(8, key.y - 58);
    addLabel(l1x, l1y, l1w, l1h, label1);
    addArrow(l1x + 36, l1y + l1h - 2, key.cx, key.y + 3);

    const l2w = 420;
    const l2h = 44;
    const l2x = Math.max(16, track.x - 20);
    const l2y = Math.max(8, track.y - 64);
    addLabel(l2x, l2y, l2w, l2h, label2);
    addArrow(l2x + 36, l2y + l2h - 2, track.cx, track.y + 3);

    content.appendChild(svg);
    return { ok: true, key, track };
  });
}

async function waitOrderInfoShippingData(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    if (document.querySelector('.fa-clock-o.fa-spin')) return false;
    if (document.querySelector('[id^="ocmax-loader"]')) return false;
    return true;
  }, { timeout: 60000 });
  await page.waitForSelector('.page-header .pull-right button#button-cn.dropdown-toggle', { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function hideAfterOrderInfoContent(page) {
  return page.evaluate(() => {
    const hideEl = (el) => {
      if (!el) return;
      el.classList.add('screenshot-mock-hide');
      el.style.setProperty('display', 'none', 'important');
    };
    const container = document.querySelector('#content > .container-fluid');
    if (!container) return { ok: false, reason: 'order info container-fluid missing' };
    const historyPanel = document.getElementById('tab-history')?.closest('.panel.panel-default')
      || [...container.querySelectorAll('.panel.panel-default')].find((p) => p.querySelector('.panel-heading .fa-comment-o'));
    if (!historyPanel) return { ok: false, reason: 'order history panel missing' };
    let hide = false;
    [...container.children].forEach((child) => {
      if (child === historyPanel) hide = true;
      if (hide) hideEl(child);
    });
    hideEl(document.getElementById('footer'));
    return { ok: true };
  });
}

async function prepareOrderInfoShotFrame(page) {
  return page.evaluate(() => {
    document.querySelector('.screenshot-order-cn-bar')?.remove();
    hideEl(document.getElementById('footer'));
    return { ok: true };

    function hideEl(el) {
      if (!el) return;
      el.classList.add('screenshot-mock-hide');
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

async function injectOrderCnArrow(page) {
  return page.evaluate(() => {
    document.getElementById('screenshot-order-cn-arrow')?.remove();
    const root = document.getElementById('content');
    const group = document.querySelector('#content .page-header .pull-right .btn-group:has(#button-cn)');
    if (!root || !group) {
      return { ok: false, reason: 'missing #content or CN btn-group in page-header' };
    }

    const origin = root.getBoundingClientRect();
    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    group.querySelectorAll(':scope > .btn, :scope > a.btn, :scope > button.btn').forEach((el) => {
      const b = el.getBoundingClientRect();
      top = Math.min(top, b.top);
      left = Math.min(left, b.left);
      right = Math.max(right, b.right);
      bottom = Math.max(bottom, b.bottom);
    });
    if (!Number.isFinite(top)) {
      const r = group.getBoundingClientRect();
      top = r.top;
      left = r.left;
      right = r.right;
      bottom = r.bottom;
    }
    const target = {
      cx: (left + right) / 2 - origin.left,
      cy: (top + bottom) / 2 - origin.top,
      x: left - origin.left,
      y: top - origin.top,
      w: right - left,
      h: bottom - top,
    };

    const color = '#e00000';
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'screenshot-order-cn-arrow');
    svg.setAttribute('class', 'screenshot-mock');
    const svgW = Math.ceil(root.scrollWidth || origin.width);
    const svgH = Math.ceil(root.scrollHeight || origin.height);
    svg.setAttribute('width', String(svgW));
    svg.setAttribute('height', String(svgH));
    svg.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;z-index:2147483646;pointer-events:none;overflow:visible;';
    if (getComputedStyle(root).position === 'static') {
      root.style.position = 'relative';
    }

    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'order-cn-arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    const tip = document.createElementNS(NS, 'path');
    tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    tip.setAttribute('fill', color);
    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const line = document.createElementNS(NS, 'line');
    const label = 'Створення/Редагування накладної';
    const lh = 22;
    const arrowY = target.cy;
    const x2 = target.x - 4;
    const y2 = target.cy;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '700 14px Arial, Helvetica, sans-serif';
    const labelWidth = Math.ceil(ctx.measureText(label).width);
    const gap = 10;
    const arrowLen = 56;
    const x1 = x2 - arrowLen;
    const labelX = Math.max(8, x1 - gap - labelWidth);
    const y1 = arrowY;
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#order-cn-arrowhead)');

    const fo = document.createElementNS(NS, 'foreignObject');
    fo.setAttribute('x', String(labelX));
    fo.setAttribute('y', String(arrowY - lh / 2));
    fo.setAttribute('width', String(labelWidth + 4));
    fo.setAttribute('height', String(lh));
    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.style.cssText =
      'font:700 14px/1.35 Arial,Helvetica,sans-serif;color:#e00000;white-space:nowrap;'
      + 'text-shadow:0 0 4px #fff,0 0 4px #fff,1px 1px 0 #fff,-1px -1px 0 #fff;';
    div.textContent = label;
    fo.appendChild(div);
    svg.appendChild(fo);
    svg.appendChild(line);

    root.appendChild(svg);
    return { ok: true, target };
  });
}

/**
 * Row CN menus in `.table-responsive` are clipped (last rows especially).
 * Open as Bootstrap `dropup` (menu stays over the table rows) and clone the full
 * menu (`scrollHeight`) onto `body` as `position:fixed` for the PNG.
 */
async function floatOrderListRowDropdown(page, orderId) {
  return page.evaluate((id) => {
    document.getElementById('screenshot-order-row-cn-menu')?.remove();
    const rowBtn = document.getElementById(`button-cn-${id}`);
    const rowGroup = rowBtn?.closest('.btn-group');
    const menu = rowGroup?.querySelector(':scope > .dropdown-menu, .dropdown-menu');
    if (!menu || !rowGroup) {
      return { ok: false, reason: 'row dropdown missing' };
    }
    rowGroup.classList.add('open', 'dropup');
    menu.style.setProperty('display', 'block');
    menu.style.setProperty('top', 'auto');
    menu.style.setProperty('bottom', '100%');
    const fullH = Math.max(menu.scrollHeight, menu.getBoundingClientRect().height);
    const fullW = Math.max(menu.scrollWidth, menu.getBoundingClientRect().width);
    const r = menu.getBoundingClientRect();
    if (fullW < 8 || fullH < 8) {
      return { ok: false, reason: 'row dropdown has no box' };
    }
    const clone = menu.cloneNode(true);
    clone.id = 'screenshot-order-row-cn-menu';
    clone.classList.add('screenshot-mock');
    clone.style.cssText = [
      'position:fixed',
      `left:${r.left}px`,
      `top:${r.top}px`,
      `width:${fullW}px`,
      `height:${fullH}px`,
      'right:auto',
      'bottom:auto',
      'display:block',
      'max-height:none',
      'overflow:visible',
      'z-index:2147483647',
      'margin:0',
    ].join(';');
    document.body.appendChild(clone);
    menu.style.setProperty('visibility', 'hidden');
    return { ok: true, top: r.top, height: fullH };
  }, String(orderId));
}

/** Open toolbar CN/registry list + the smoke-order row CN menu (full row menu, not clipped). */
async function openOrderListCnDropdowns(page, orderId) {
  const oid = String(orderId);
  const listToggle = page.locator('.page-header .pull-right .btn-group').filter({ has: page.locator('.fa-list-ul') }).locator('.dropdown-toggle').first();
  await listToggle.click();
  await page.waitForSelector('.page-header .pull-right .btn-group.open .dropdown-menu', { timeout: 5000 });
  const rowToggle = page.locator(`#button-cn-${oid}`);
  await rowToggle.scrollIntoViewIfNeeded();
  await rowToggle.click();
  await page.waitForTimeout(300);
  const opened = await page.evaluate((id) => {
    document.querySelectorAll('.page-header .pull-right .btn-group').forEach((g) => {
      if (g.querySelector('.fa-list-ul')) {
        g.classList.add('open');
        const menu = g.querySelector('.dropdown-menu');
        if (menu) menu.style.display = 'block';
      }
    });
    const rowBtn = document.getElementById(`button-cn-${id}`);
    const rowGroup = rowBtn?.closest('.btn-group');
    if (rowGroup) {
      rowGroup.classList.add('open', 'dropup');
      const menu = rowGroup.querySelector('.dropdown-menu');
      if (menu) {
        menu.style.display = 'block';
        menu.style.top = 'auto';
        menu.style.bottom = '100%';
      }
    }
    return {
      ok: !!(rowGroup && document.querySelector('.page-header .pull-right .btn-group.open .fa-list-ul')),
      hasQuick: !!document.getElementById(`button-cn-q-${id}`),
    };
  }, oid);
  if (!opened?.ok) return opened;
  const floated = await floatOrderListRowDropdown(page, oid);
  if (!floated?.ok) {
    throw new Error(`Order list row dropdown float failed: ${floated?.reason || 'unknown'}`);
  }
  return opened;
}

async function injectOrderListCnArrows(page, orderId) {
  return page.evaluate((oid) => {
    document.getElementById('screenshot-order-list-arrows')?.remove();
    const root = document.getElementById('content');
    const listGroup = [...document.querySelectorAll('.page-header .pull-right .btn-group')]
      .find((g) => g.querySelector('.fa-list-ul'));
    const quickBtn = document.getElementById(`button-cn-q-${oid}`);
    const rowGroup = quickBtn?.closest('.btn-group')
      || document.getElementById(`button-cn-${oid}`)?.closest('.btn-group');
    if (!root || !listGroup || !rowGroup) {
      return { ok: false, reason: 'missing #content, list dropdown or order CN btn-group' };
    }

    const origin = root.getBoundingClientRect();
    const localBox = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
        cx: r.left - origin.left + r.width / 2,
        cy: r.top - origin.top + r.height / 2,
      };
    };

    const groupTarget = (group) => {
      let top = Infinity;
      let left = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      group.querySelectorAll(':scope > .btn, :scope > a.btn, :scope > button.btn').forEach((el) => {
        const b = localBox(el);
        top = Math.min(top, b.y);
        left = Math.min(left, b.x);
        right = Math.max(right, b.x + b.w);
        bottom = Math.max(bottom, b.y + b.h);
      });
      if (!Number.isFinite(top)) {
        const r = localBox(group);
        return { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.cx, cy: r.cy };
      }
      return {
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
        cx: (left + right) / 2,
        cy: (top + bottom) / 2,
      };
    };

    const listTarget = groupTarget(listGroup);
    const rowAnchor = quickBtn ? localBox(quickBtn) : groupTarget(rowGroup);
    const rowTarget = {
      x: rowAnchor.x,
      y: rowAnchor.y,
      w: rowAnchor.w,
      h: rowAnchor.h,
      cx: rowAnchor.x + rowAnchor.w / 2,
      cy: rowAnchor.y + rowAnchor.h / 2,
    };

    const color = '#e00000';
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'screenshot-order-list-arrows');
    svg.setAttribute('class', 'screenshot-mock');
    const svgW = Math.ceil(root.scrollWidth || origin.width);
    const svgH = Math.ceil(root.scrollHeight || origin.height);
    svg.setAttribute('width', String(svgW));
    svg.setAttribute('height', String(svgH));
    svg.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;z-index:2147483646;pointer-events:none;overflow:visible;';
    if (getComputedStyle(root).position === 'static') {
      root.style.position = 'relative';
    }

    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'order-list-arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    const tip = document.createElementNS(NS, 'path');
    tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    tip.setAttribute('fill', color);
    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const addInlineArrow = (label, target, arrowLen = 56) => {
      const lh = 22;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = '700 14px Arial, Helvetica, sans-serif';
      const labelWidth = Math.ceil(ctx.measureText(label).width);
      const gap = 10;
      const arrowY = target.cy;
      const x2 = target.x - 4;
      const x1 = x2 - arrowLen;
      const labelX = Math.max(8, x1 - gap - labelWidth);

      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(arrowY));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(arrowY));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#order-list-arrowhead)');

      const fo = document.createElementNS(NS, 'foreignObject');
      fo.setAttribute('x', String(labelX));
      fo.setAttribute('y', String(arrowY - lh / 2));
      fo.setAttribute('width', String(labelWidth + 4));
      fo.setAttribute('height', String(lh));
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.cssText =
        'font:700 14px/1.35 Arial,Helvetica,sans-serif;color:#e00000;white-space:nowrap;'
        + 'text-shadow:0 0 4px #fff,0 0 4px #fff,1px 1px 0 #fff,-1px -1px 0 #fff;';
      div.textContent = label;
      fo.appendChild(div);
      svg.appendChild(fo);
      svg.appendChild(line);
    };

    addInlineArrow('Список накладних та реєстрів', listTarget, 72);
    addInlineArrow('Створення/Редагування накладної', rowTarget, 56);

    root.appendChild(svg);
    return { ok: true, listTarget, rowTarget };
  }, String(orderId));
}

async function injectSuccessAlert(page, message) {
  return page.evaluate((msg) => {
    document.querySelectorAll('.screenshot-mock').forEach((n) => n.remove());
    const html =
      '<div class="alert alert-success screenshot-mock"><i class="fa fa-check-circle"></i> '
      + msg
      + '<button type="button" class="close" data-dismiss="alert">&times;</button></div>';
    const target =
      document.querySelector('#content > .container-fluid')
      || (window.jQuery && jQuery('.container-fluid').length > 2 ? jQuery('.container-fluid').eq(2)[0] : null);
    if (!target) return { alert: false, target: null };
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    target.insertBefore(wrap.firstChild, target.firstChild);
    window.scrollTo(0, 0);
    return { alert: !!document.querySelector('.alert-success.screenshot-mock'), target: target.className };
  }, message);
}

async function mockDatabaseTab(page, deltas, percentDeltas = {}) {
  return page.evaluate(({ deltaMap, percentMap, alertMsg }) => {
    document.querySelectorAll('.screenshot-mock').forEach((n) => n.remove());
    if (window.jQuery) {
      jQuery('ul.nav-tabs a[href="#tab-database"]').tab('show');
    }
    const amounts = {};
    const applyDelta = (type, d) => {
      const el = document.getElementById('td-' + type + '_amount');
      if (!el) return;
      const raw = (el.textContent || '').trim().split(/\s+/)[0].replace(/\s/g, '');
      const current = parseInt(raw, 10) || 0;
      const delta = Math.max(0, Math.round(Number(d) || 0));
      const base = Math.max(0, current - delta);
      el.innerHTML = String(base) + ' <span class="label label-success">+' + delta + '</span>';
      amounts[type] = el.innerHTML;
    };
    Object.keys(percentMap || {}).forEach((type) => {
      const el = document.getElementById('td-' + type + '_amount');
      if (!el) return;
      const raw = (el.textContent || '').trim().split(/\s+/)[0].replace(/\s/g, '');
      const current = parseInt(raw, 10) || 0;
      const pct = Number(percentMap[type]) || 0;
      const delta = Math.max(0, Math.round(current * pct / 100));
      applyDelta(type, delta);
    });
    Object.keys(deltaMap || {}).forEach((type) => applyDelta(type, deltaMap[type]));
    const html =
      '<div class="alert alert-success screenshot-mock"><i class="fa fa-check-circle"></i> '
      + alertMsg
      + '<button type="button" class="close" data-dismiss="alert">&times;</button></div>';
    const target =
      document.querySelector('#content > .container-fluid')
      || (window.jQuery && jQuery('.container-fluid').length > 2 ? jQuery('.container-fluid').eq(2)[0] : null);
    if (target) {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      target.insertBefore(wrap.firstChild, target.firstChild);
    }
    window.scrollTo(0, 0);
    return {
      tabActive: !!document.querySelector('#tab-database.active.in'),
      alert: !!document.querySelector('.alert-success.screenshot-mock'),
      amounts,
    };
  }, { deltaMap: deltas, percentMap: percentDeltas, alertMsg: ALERT_DB_OK });
}

/** Clear inputs/selects in DOM without firing change (avoids API verify modals). */
async function clearFieldsQuiet(page, selectors) {
  if (!selectors?.length) return;
  await page.evaluate((sels) => {
    sels.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        el.selectedIndex = -1;
        el.value = '';
        if (window.jQuery && jQuery.fn.selectpicker) {
          try {
            jQuery(el).selectpicker('val', '');
            jQuery(el).selectpicker('refresh');
          } catch (_) { /* ignore */ }
        }
      } else {
        el.value = '';
      }
    });
  }, selectors);
}

async function waitAjaxQuiet(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    if (document.querySelector('.fa-clock-o.fa-spin')) return false;
    if (document.querySelector('[id^="ocmax-loader"]')) return false;
    return true;
  }, { timeout: 60000 });
  await page.waitForTimeout(300);
}

async function mockRecipientContactColumn(page, headerText, html) {
  return page.evaluate(({ header, cellHtml }) => {
    const tables = document.querySelectorAll('table');
    let updated = 0;
    tables.forEach((table) => {
      const heads = [...table.querySelectorAll('thead td, thead th')];
      const colIndex = heads.findIndex((th) => (th.textContent || '').trim() === header);
      if (colIndex < 0) return;
      table.querySelectorAll('tbody tr').forEach((row) => {
        const cell = row.children[colIndex];
        if (!cell) return;
        cell.innerHTML = cellHtml;
        updated++;
      });
    });
    return { updated };
  }, { header: headerText, cellHtml: html });
}

async function activateTab(page, href) {
  await page.locator(`a[href="${href}"]`).first().click();
  const paneId = href.replace('#', '');
  await page.waitForSelector(`#${paneId}.active`, { state: 'attached', timeout: 10000 });
  await page.waitForSelector(`#${paneId}.active`, { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(200);
}

async function waitCNFormAjax(page) {
  await page.waitForSelector('#button-save', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    if (document.querySelector('.fa-clock-o.fa-spin')) return false;
    if (document.querySelector('[id^="ocmax-loader-"]')) return false;
    return true;
  }, { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

async function cnListRowLoaded(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (!rows.length) return false;
    if (document.querySelectorAll('input[data-status=""]').length > 0) return false;
    const row = rows[0];
    const tds = row.querySelectorAll('td');
    for (const td of tds) {
      const t = (td.textContent || '').trim();
      if (t.length > 2 && !td.querySelector('input[type="checkbox"]')) return true;
    }
    return false;
  });
}

async function gotoCNListLoaded(page, baseUrl, token, profile) {
  const url = `${baseUrl}/index.php?route=${profile.route}/getCNList&user_token=${token}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody', { timeout: 15000 });
    for (let i = 0; i < 20; i++) {
      if (await cnListRowLoaded(page)) return;
      await page.waitForTimeout(500);
    }
    console.log(`CN list data not ready, reload (${attempt}/3)`);
  }
  throw new Error('CN list row data did not load after 3 reloads');
}

async function login(page, baseUrl, user, pass) {
  await page.goto(`${baseUrl}/`);
  await page.fill('#input-username', user);
  await page.fill('#input-password', pass);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function getUserToken(page) {
  const url = page.url();
  let m = url.match(/user_token=([^&]+)/);
  if (m) return m[1];
  const href = await page.locator('a[href*="user_token"]').first().getAttribute('href');
  m = href && href.match(/user_token=([^&]+)/);
  if (m) return m[1];
  throw new Error('user_token not found after login');
}

async function gotoSettings(page, baseUrl, token, profile) {
  await page.goto(`${baseUrl}/index.php?route=${profile.route}&user_token=${token}`);
  await page.waitForSelector(profile.form, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function openMacrosCollapse(page, collapseId) {
  const href = collapseId.startsWith('#') ? collapseId : `#${collapseId}`;
  const id = href.slice(1);
  await page.locator(`[href="${href}"]`).click();
  await page.waitForSelector(`${href}.in, ${href}.show, #${id}.in, #${id}.show`, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function screenshot(page, outPath, fullPage = true) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage });
  const stats = fs.statSync(outPath);
  if (stats.size < 10000) {
    throw new Error(`Screenshot too small (${stats.size} bytes): ${outPath}`);
  }
  console.log(`ok ${outPath}`);
}

async function openFirstRowGear(page) {
  const gearBtn = page.locator('table tbody tr').first().locator('button.dropdown-toggle').filter({ has: page.locator('.fa-cog') });
  await gearBtn.click();
  await page.waitForTimeout(300);
  return gearBtn;
}

/** Reuse one browser page per shot group — avoid duplicate goto/AJAX/DOM clears. */
const captureSession = {
  settingsRoute: '',
  cnFormRoute: '',
  cnFormFieldsCleared: false,
  cnListRoute: '',
  registryRoute: '',
  checkoutKey: '',
  checkoutOnPage: false,
};

function profileSettingsRoute(profile) {
  return `route=${profile.route}&`;
}

function isOnModuleSettings(page, profile) {
  const url = page.url();
  return url.includes(profileSettingsRoute(profile))
    && !url.includes('getCNForm')
    && !url.includes('getCNList')
    && !url.includes('getRegistryList')
    && !url.includes('sale/order');
}

async function ensureSettingsPage(page, baseUrl, token, profile) {
  if (!isOnModuleSettings(page, profile)) {
    await gotoSettings(page, baseUrl, token, profile);
    captureSession.settingsRoute = profile.route;
  }
  await removeMocks(page);
}

async function clickSettingsTab(page, href) {
  await page.locator(`a[href="${href}"]`).first().click();
  const paneId = href.replace('#', '');
  await page.waitForSelector(`#${paneId}.active`, { state: 'attached', timeout: 10000 });
  // General top pane uses floated columns (offsetHeight 0); pill sub-tabs have measurable height.
  if (paneId !== 'tab-general') {
    await page.waitForSelector(`#${paneId}.active`, { state: 'visible', timeout: 10000 });
  }
  await page.waitForTimeout(200);
}

async function ensureCNForm(page, baseUrl, token, profile) {
  const routePart = `${profile.route}/getCNForm`;
  if (!page.url().includes(routePart)) {
    await page.goto(`${baseUrl}/index.php?route=${profile.route}/getCNForm&user_token=${token}&order_id=${profile.orderId}`);
    await waitCNFormAjax(page);
    captureSession.cnFormRoute = routePart;
    captureSession.cnFormFieldsCleared = false;
  }
  await removeMocks(page);
  if (!captureSession.cnFormFieldsCleared) {
    await clearFieldsQuiet(page, profile.clearSenderFields);
    captureSession.cnFormFieldsCleared = true;
  }
}

async function ensureCNList(page, baseUrl, token, profile) {
  const routePart = `${profile.route}/getCNList`;
  if (!page.url().includes(routePart) || !(await cnListRowLoaded(page))) {
    await gotoCNListLoaded(page, baseUrl, token, profile);
    captureSession.cnListRoute = routePart;
  }
  await removeMocks(page);
}

async function ensureRegistryList(page, baseUrl, token, profile) {
  const routePart = `${profile.route}/getRegistryList`;
  const date = profile.registryFilterDate || '2026-08-14';
  if (!page.url().includes(routePart)) {
    await page.goto(`${baseUrl}/index.php?route=${profile.route}/getRegistryList&user_token=${token}&filter_date=${date}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#input-filter_date', { timeout: 15000 });
    captureSession.registryRoute = routePart;
  }
  await removeMocks(page);
}

async function closeVisibleModals(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal.in, .modal.show').forEach((modal) => {
      if (window.jQuery && jQuery.fn.modal) {
        jQuery(modal).modal('hide');
      }
    });
    document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
    document.body.classList.remove('modal-open');
  });
  await page.waitForTimeout(200);
}

async function dismissTooltips(page) {
  await page.evaluate(() => {
    if (window.jQuery && jQuery.fn.tooltip) {
      jQuery('[data-toggle="tooltip"], [data-tooltip="true"]').tooltip('hide');
    }
    document.querySelectorAll('.tooltip.in, .tooltip.show').forEach((el) => el.remove());
  });
  await page.waitForTimeout(200);
}

async function waitAddressDropdownItems(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const lists = document.querySelectorAll('.dropdown-address');
    for (const ul of lists) {
      if (ul.style.display !== 'none' && ul.querySelectorAll('li').length > 0) return true;
    }
    return false;
  }, { timeout });
  await page.waitForTimeout(200);
}

async function waitSimpleCheckoutIdle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    if (document.querySelector('.fa-clock-o.fa-spin')) return false;
    if (document.querySelector('.simplecheckout-loading, .loading')) return false;
    return true;
  }, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function fillCheckoutCustomer(page, checkout) {
  await page.evaluate((cfg) => {
    const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const setVal = (el, value) => {
      if (!el || !visible(el)) return false;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const byName = (part, value) => {
      const el = document.querySelector(`input[name*="${part}"]`);
      return setVal(el, value);
    };
    byName('lastname', cfg.lastname);
    byName('firstname', cfg.firstname);
    byName('patronymic', cfg.patronymic) || byName('middle', cfg.patronymic);
    byName('telephone', cfg.phone) || byName('phone', cfg.phone);

    const regNo = document.querySelector('input[name*="register"][value="0"]');
    if (regNo && visible(regNo)) regNo.click();
    const regRadios = document.querySelectorAll('input[type="radio"][name*="register"]');
    regRadios.forEach((el) => {
      if ((el.value === '0' || el.value === 'false') && visible(el)) el.click();
    });
  }, checkout);
  await ensureShippingQuotesLoaded(page);
}

async function addProductToCart(page, catalogBaseUrl, productId) {
  await page.goto(`${catalogBaseUrl}/index.php?route=product/product&product_id=${productId}`);
  await page.waitForSelector('#button-cart', { timeout: 15000 });
  await page.click('#button-cart');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function ensureCheckoutSession(page, profile) {
  const catalogBaseUrl = profile.catalogBaseUrl;
  const checkout = profile.checkout || {};
  const key = `${catalogBaseUrl}:${profile.checkoutProductId || 40}`;
  const onCheckout = page.url().includes('checkout/simplecheckout');
  if (captureSession.checkoutOnPage && captureSession.checkoutKey === key && onCheckout) {
    await waitSimpleCheckoutIdle(page);
    return catalogBaseUrl;
  }
  await addProductToCart(page, catalogBaseUrl, profile.checkoutProductId || 40);
  await page.goto(`${catalogBaseUrl}/index.php?route=checkout/simplecheckout`);
  await page.waitForSelector('#simplecheckout_shipping', { timeout: 20000 });
  await waitSimpleCheckoutIdle(page);
  await fillCheckoutCustomer(page, checkout);
  captureSession.checkoutOnPage = true;
  captureSession.checkoutKey = key;
  return catalogBaseUrl;
}

async function waitCheckoutRadioReady(page, shippingCode, timeout = 90000) {
  await page.waitForFunction((id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    return !el.disabled && el.getAttribute('data-dummy') !== 'true';
  }, shippingCode, { timeout });
}

async function triggerSimpleCheckoutReload(page) {
  await page.evaluate(() => {
    if (typeof reloadAll === 'function') {
      reloadAll();
      return;
    }
    const $sc = window.jQuery && jQuery('.simplecheckout');
    if ($sc && $sc.length && typeof $sc.data === 'function') {
      const inst = $sc.data('simplecheckout');
      if (inst && typeof inst.reloadAll === 'function') {
        inst.reloadAll();
      }
    }
  });
}

async function ensureShippingQuotesLoaded(page) {
  await waitSimpleCheckoutIdle(page);
  const hasDummy = await page.evaluate(() => !!document.querySelector('#simplecheckout_shipping input[data-dummy="true"]'));
  if (!hasDummy) return;
  await triggerSimpleCheckoutReload(page);
  await waitSimpleCheckoutIdle(page);
}

async function selectCheckoutShipping(page, shippingCode) {
  await ensureShippingQuotesLoaded(page);
  try {
    await waitCheckoutRadioReady(page, shippingCode);
  } catch {
    await triggerSimpleCheckoutReload(page);
    await waitSimpleCheckoutIdle(page);
    await waitCheckoutRadioReady(page, shippingCode);
  }
  const safeId = shippingCode.replace('.', '\\.');
  const radio = page.locator(`#${safeId}`);
  await radio.waitFor({ state: 'visible', timeout: 15000 });
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing shipping radio #${id}`);
    el.click();
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, shippingCode);
  await waitSimpleCheckoutIdle(page);
}

async function dismissAddressDropdowns(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.dropdown-address').forEach((ul) => {
      ul.style.display = 'none';
    });
  });
  await page.waitForTimeout(150);
}

/** shippingdata Autocomplete selects on ul mousedown — not click (anchor href="#" navigates). */
async function pickVisibleAddressOption(page, matchName) {
  await waitAddressDropdownItems(page);
  const list = page.locator('.dropdown-address').filter({ visible: true });
  const escaped = matchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const anchored = list.locator('li').filter({
    hasText: new RegExp(`^${escaped}([,\\s]|$)`, 'i'),
  }).first();
  const loose = list.locator('li').filter({
    hasText: new RegExp(escaped, 'i'),
  }).first();
  const option = (await anchored.count()) ? anchored : loose;
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.dispatchEvent('mousedown');
  await page.waitForTimeout(200);
}

async function typeCheckoutAutocomplete(page, fieldSelector, searchText, matchName) {
  const field = page.locator(fieldSelector);
  await field.waitFor({ state: 'visible', timeout: 15000 });
  await field.click();
  await field.fill('');
  await field.pressSequentially(searchText, { delay: 60 });
  await pickVisibleAddressOption(page, matchName);
  await waitSimpleCheckoutIdle(page);
}

async function waitCheckoutDoorsFields(page, profile) {
  await page.waitForSelector('#shipping_address_zone_id', { state: 'visible', timeout: 20000 });
  await page.waitForSelector('#shipping_address_city', { state: 'visible', timeout: 15000 });
  const doorsSel = profile?.checkout?.doorsField || '#shipping_address_street';
  await page.waitForSelector(doorsSel, { state: 'visible', timeout: 20000 }).catch(() => {});
}

async function fillCheckoutRegionIfVisible(page, regionName, profile) {
  const usable = await page.evaluate(() => {
    const el = document.getElementById('shipping_address_zone_id');
    if (!el || el.tagName !== 'SELECT' || el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }).catch(() => false);
  if (usable) {
    await fillCheckoutRegion(page, regionName, false, profile);
  }
}

async function fillCheckoutRegion(page, regionName, waitDoors = true, profile = null) {
  const select = page.locator('#shipping_address_zone_id');
  await select.waitFor({ state: 'visible', timeout: 15000 });
  const value = await select.evaluate((sel, needle) => {
    for (const opt of sel.options) {
      if ((opt.textContent || '').includes(needle)) return opt.value;
    }
    return '';
  }, regionName);
  if (!value) {
    throw new Error(`Checkout region not found: ${regionName}`);
  }
  await select.selectOption(value);
  await waitSimpleCheckoutIdle(page);
  if (waitDoors) {
    await waitCheckoutDoorsFields(page, profile);
  }
}

async function fillCheckoutCity(page, cityName, searchText) {
  await typeCheckoutAutocomplete(
    page,
    '#shipping_address_city',
    searchText || cityName.toLowerCase(),
    cityName,
  );
}

async function openCheckoutAddressDropdown(page, selector = '#shipping_address_address_1') {
  await dismissAddressDropdowns(page);
  const field = page.locator(selector).filter({ visible: true }).first();
  await field.waitFor({ state: 'visible', timeout: 15000 });
  await field.click({ force: true });
  await field.fill('');
  await page.waitForTimeout(250);
  await field.dispatchEvent('input');
  await waitAddressDropdownItems(page);
}

async function openCheckoutStreetDropdown(page, query, selector = '#shipping_address_street') {
  const field = page.locator(selector);
  await field.waitFor({ state: 'visible', timeout: 20000 });
  await field.click();
  await field.fill('');
  await field.pressSequentially(query, { delay: 60 });
  await waitAddressDropdownItems(page);
}

async function waitOrderListShippingData(page, quickBtnSelector) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.fa-list-ul', { timeout: 30000 });
  if (quickBtnSelector) {
    await page.waitForSelector(quickBtnSelector, { timeout: 30000 });
  }
  await page.waitForTimeout(500);
}

async function showBootstrapTooltip(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el && window.jQuery && jQuery.fn.tooltip) {
      jQuery(el).tooltip('show');
    }
  }, selector);
}

const ACTIONS = {
  async settingsGeneralClearSave(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-general');
    await clickSettingsTab(page, '#tab-global');
    await clearFieldsQuiet(page, profile.clearCredentialFields);
    await page.locator('.page-header .btn-group .dropdown-toggle').click();
    await screenshot(page, outPath);
  },

  async settingsGeneralSub(page, baseUrl, token, profile, outPath, shot) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-general');
    await clickSettingsTab(page, shot.href);
    await screenshot(page, outPath);
  },

  async settingsTab(page, baseUrl, token, profile, outPath, shot) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, shot.href);
    await screenshot(page, outPath);
  },

  async database(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await activateTab(page, '#tab-database');
    const percentKeys = Object.keys(profile.dbPercentDeltas || {});
    const deltaKeys = Object.keys(profile.dbDeltas || {});
    const firstDbType = percentKeys[0] || deltaKeys[0];
    await page.waitForSelector(`#td-${firstDbType}_amount`, { state: 'visible', timeout: 10000 });
    const dbMock = await mockDatabaseTab(page, profile.dbDeltas || {}, profile.dbPercentDeltas || {});
    const expectedTypes = [...percentKeys, ...deltaKeys];
    const amountsOk = expectedTypes.every(
      (t) => dbMock?.amounts?.[t]?.includes('label-success'),
    );
    if (!dbMock?.tabActive || !dbMock?.alert || !amountsOk) {
      throw new Error(`DB tab mock failed: ${JSON.stringify(dbMock)}`);
    }
    await page.waitForTimeout(300);
    await screenshot(page, outPath, true);
  },

  async sender(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-sender');
    await waitAjaxQuiet(page);
    await clearFieldsQuiet(page, profile.clearSenderFields);
    await screenshot(page, outPath);
  },

  async departureMacros(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-departure');
    await openMacrosCollapse(page, profile.departureMacros);
    await screenshot(page, outPath);
  },

  async cronMacros(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-cron');
    await openMacrosCollapse(page, profile.cronMacros);
    await screenshot(page, outPath);
  },

  async cronTrackingAnnotated(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-cron');
    await page.locator('#input-key_cron').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#input-cron_departures_tracking').waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const hidden = await hideAfterCronTracking(page);
    if (!hidden?.ok) {
      throw new Error(`Cron tracking crop failed: ${hidden?.reason || 'unknown'}`);
    }
    await page.waitForTimeout(200);
    const overlay = await injectCronTrackingArrows(page);
    if (!overlay?.ok) {
      throw new Error(`Cron tracking overlay failed: ${overlay?.reason || 'unknown'}`);
    }
    await screenshotElement(page, '#content', outPath);
  },

  async trackingStatusesSettingsAnnotated(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    await clickSettingsTab(page, '#tab-cron');
    await page.locator('#input-cron_departures_tracking').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#input-tracking_statuses').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#table-tracking_statuses').waitFor({ state: 'visible', timeout: 15000 });
    await ensureMacrosCollapsed(page, profile.cronMacros || '#message-macros-collapse');
    await page.evaluate(() => {
      const tab = document.getElementById('tab-cron');
      const track = document.getElementById('input-cron_departures_tracking');
      if (!track || !tab) return;
      let group = track.parentElement;
      while (group && group !== tab) {
        if (group.parentElement === tab && group.classList.contains('form-group')) break;
        group = group.parentElement;
      }
      const legend = group?.previousElementSibling?.tagName === 'LEGEND' ? group.previousElementSibling : null;
      if (legend) {
        const y = legend.getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo(0, Math.max(0, y));
      }
    });
    await page.waitForTimeout(300);
    const clip = await getTrackingStatusesSettingsClip(page);
    if (!clip) {
      throw new Error('Tracking statuses clip failed: missing legend or #table-tracking_statuses');
    }
    await screenshotClipRect(page, outPath, clip, true);
  },

  async orderInfoCnAnnotated(page, baseUrl, token, profile, outPath) {
    const orderId = profile.orderId || 4;
    await removeMocks(page);
    await page.goto(`${baseUrl}/index.php?route=sale/order/info&user_token=${token}&order_id=${orderId}`);
    await waitOrderInfoShippingData(page);
    await page.evaluate(() => {
      document.querySelectorAll('.page-header .btn-group.open').forEach((g) => g.classList.remove('open'));
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    const hidden = await hideAfterOrderInfoContent(page);
    if (!hidden?.ok) {
      throw new Error(`Order info crop failed: ${hidden?.reason || 'unknown'}`);
    }
    const framed = await prepareOrderInfoShotFrame(page);
    if (!framed?.ok) {
      throw new Error(`Order info frame failed: ${framed?.reason || 'unknown'}`);
    }
    await page.waitForTimeout(200);
    const overlay = await injectOrderCnArrow(page);
    if (!overlay?.ok) {
      throw new Error(`Order CN overlay failed: ${overlay?.reason || 'unknown'}`);
    }
    await screenshotElement(page, '#content', outPath, 7);
  },

  async orderListCnAnnotated(page, baseUrl, token, profile, outPath) {
    await removeMocks(page);
    const orderId = String(profile.orderId || 4);
    const quickBtn = profile.orderListQuickCnButton || `#button-cn-q-${orderId}`;
    await page.addInitScript((oid) => {
      document.addEventListener('DOMContentLoaded', () => {
        const cb = document.querySelector(`input[name="selected[]"][value="${oid}"]`);
        if (cb) cb.checked = true;
      }, { once: true });
    }, orderId);
    await page.goto(`${baseUrl}/index.php?route=sale/order&user_token=${token}`);
    await waitOrderListShippingData(page, quickBtn);
    await page.evaluate(() => window.scrollTo(0, 0));
    const opened = await openOrderListCnDropdowns(page, orderId);
    if (!opened?.ok) {
      throw new Error(`Order list dropdowns failed: missing CN controls for order ${orderId}`);
    }
    await page.waitForTimeout(200);
    const overlay = await injectOrderListCnArrows(page, orderId);
    if (!overlay?.ok) {
      throw new Error(`Order list overlay failed: ${overlay?.reason || 'unknown'}`);
    }
    const clipBottom = await getOrderListClipBottom(page);
    if (clipBottom == null) {
      throw new Error('Order list clip bottom failed: missing #content');
    }
    await page.waitForTimeout(100);
    await screenshotElement(page, '#content', outPath, 7, clipBottom);
  },

  async support(page, baseUrl, token, profile, outPath) {
    await ensureSettingsPage(page, baseUrl, token, profile);
    const supportTab = page.locator('.nav-tabs > li.dropdown > a.dropdown-toggle').filter({ hasText: /Підтримка|Support/ });
    await supportTab.click();
    await page.locator('a[href="#tab-support"]').click();
    await page.waitForSelector('#tab-support.active', { timeout: 10000 });
    await page.waitForTimeout(200);
    await supportTab.click();
    await page.waitForSelector('.nav-tabs > li.dropdown.open', { timeout: 5000 });
    await screenshot(page, outPath);
  },

  async cnForm(page, baseUrl, token, profile, outPath) {
    await ensureCNForm(page, baseUrl, token, profile);
    await screenshot(page, outPath);
  },

  async cnFormTotals(page, baseUrl, token, profile, outPath) {
    await ensureCNForm(page, baseUrl, token, profile);
    await page.locator(profile.componentsListButton).click();
    await page.waitForSelector('#modal-totals-list.in, #modal-totals-list.show', { timeout: 5000 });
    await screenshot(page, outPath, false);
    await closeVisibleModals(page);
  },

  async cnFormSeatCalc(page, baseUrl, token, profile, outPath) {
    await ensureCNForm(page, baseUrl, token, profile);
    await closeVisibleModals(page);
    await dismissTooltips(page);
    await page.locator('#button-options_seat_calc').click();
    await page.waitForSelector('#modal-options-seat-calc.in, #modal-options-seat-calc.show', { timeout: 5000 });
    await page.locator('#modal-options-seat-calc button[onclick="addCalcSeat();"]').click();
    await page.waitForTimeout(400);
    await screenshot(page, outPath, false);
    await closeVisibleModals(page);
  },

  async cnListAlertGear(page, baseUrl, token, profile, outPath) {
    await ensureCNList(page, baseUrl, token, profile);
    if (profile.recipientContactColumnHeader && profile.recipientContactMockHtml) {
      const colMock = await mockRecipientContactColumn(
        page,
        profile.recipientContactColumnHeader,
        profile.recipientContactMockHtml,
      );
      if (!colMock?.updated) {
        throw new Error(`Recipient contact column mock failed: ${JSON.stringify(colMock)}`);
      }
    }
    const cnAlert = await injectSuccessAlert(page, ALERT_CN_OK);
    if (!cnAlert?.alert) {
      throw new Error(`CN list alert mock failed: ${JSON.stringify(cnAlert)}`);
    }
    await openFirstRowGear(page);
    await screenshot(page, outPath, true);
    await page.keyboard.press('Escape');
  },

  async cnListAddToGroup(page, baseUrl, token, profile, outPath) {
    await ensureCNList(page, baseUrl, token, profile);
    const addLink = page.locator('a[onclick="addToGroup(this);"]').first();
    if (!(await addLink.count())) {
      throw new Error('No CN row with «Add to group» action (all may already be in a group)');
    }
    const gearBtn = addLink.locator('xpath=ancestor::div[contains(@class,"btn-group")][1]').locator('button.dropdown-toggle');
    await gearBtn.click();
    await page.waitForTimeout(200);
    await addLink.click();
    await page.waitForSelector('#modal-add-to-group.in, #modal-add-to-group.show', { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, outPath, false);
    await closeVisibleModals(page);
  },

  async cnListAddToRegistry(page, baseUrl, token, profile, outPath) {
    await ensureCNList(page, baseUrl, token, profile);
    const addLink = page.locator('table tbody tr').first().locator('a[onclick*="addToRegistry"]');
    if (!(await addLink.count())) {
      throw new Error('No CN row with «Add to registry» action');
    }
    await openFirstRowGear(page);
    await addLink.click();
    await page.waitForSelector('#modal-add-to-registry.in, #modal-add-to-registry.show', { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, outPath, false);
    await closeVisibleModals(page);
  },

  async cnListPrintSettings(page, baseUrl, token, profile, outPath) {
    await ensureCNList(page, baseUrl, token, profile);
    const printLink = page.locator('table tbody tr').first().locator('a[onclick*="printSettings"]');
    if (!(await printLink.count())) {
      throw new Error('No CN row with «Print settings» action');
    }
    await openFirstRowGear(page);
    await printLink.click();
    await page.waitForSelector('#modal-print-settings.in, #modal-print-settings.show', { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, outPath, false);
    await closeVisibleModals(page);
  },

  async orderListCnShortcuts(page, baseUrl, token, profile, outPath) {
    await removeMocks(page);
    const orderId = String(profile.orderId || 4);
    const quickBtn = profile.orderListQuickCnButton || `#button-cn-q-${orderId}`;
    await page.addInitScript((oid) => {
      document.addEventListener('DOMContentLoaded', () => {
        const cb = document.querySelector(`input[name="selected[]"][value="${oid}"]`);
        if (cb) cb.checked = true;
      }, { once: true });
    }, orderId);
    await page.goto(`${baseUrl}/index.php?route=sale/order&user_token=${token}`);
    await waitOrderListShippingData(page, quickBtn);
    await showBootstrapTooltip(page, quickBtn);
    const listDropdown = page.locator('.page-header .pull-right .btn-group').filter({ has: page.locator('.fa-list-ul') }).locator('.dropdown-toggle').first();
    await listDropdown.click();
    await page.waitForSelector('.page-header .pull-right .btn-group.open .dropdown-menu', { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, outPath, true);
  },

  async registryList(page, baseUrl, token, profile, outPath) {
    await ensureRegistryList(page, baseUrl, token, profile);
    await screenshot(page, outPath, true);
  },

  async registryCreateModal(page, baseUrl, token, profile, outPath) {
    await ensureRegistryList(page, baseUrl, token, profile);
    await page.locator('button[onclick="createRegistry();"]').click();
    await page.waitForSelector('#modal-edit-registry.in, #modal-edit-registry.show', { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, outPath, false);
    await closeVisibleModals(page);
  },

  async checkoutDepartment(page, baseUrl, token, profile, outPath, shot = {}) {
    const checkout = profile.checkout || {};
    const comment = shot.comment || checkout.comments?.department;
    const shippingCode = shot.shippingCode || checkout.shippingCodes?.department || 'meest.department';
    await ensureCheckoutSession(page, profile);
    if (comment) {
      await page.fill('#comment', comment);
      await waitSimpleCheckoutIdle(page);
    }
    await selectCheckoutShipping(page, shippingCode);
    await fillCheckoutRegionIfVisible(page, checkout.region || 'Сумська область', profile);
    await fillCheckoutCity(page, checkout.city || 'Суми', checkout.citySearch);
    await openCheckoutAddressDropdown(page, '#shipping_address_address_1');
    await screenshot(page, outPath, true);
  },

  async checkoutPoshtomat(page, baseUrl, token, profile, outPath, shot = {}) {
    const checkout = profile.checkout || {};
    const comment = shot.comment || checkout.comments?.poshtomat;
    const shippingCode = shot.shippingCode || checkout.shippingCodes?.poshtomat || 'meest.poshtomat';
    await ensureCheckoutSession(page, profile);
    if (comment) {
      await page.fill('#comment', comment);
      await waitSimpleCheckoutIdle(page);
    }
    await selectCheckoutShipping(page, shippingCode);
    await fillCheckoutRegionIfVisible(page, checkout.region || 'Сумська область', profile);
    await fillCheckoutCity(page, checkout.city || 'Суми', checkout.citySearch);
    await openCheckoutAddressDropdown(page, '#shipping_address_address_1');
    await screenshot(page, outPath, true);
  },

  async checkoutDoors(page, baseUrl, token, profile, outPath, shot = {}) {
    const checkout = profile.checkout || {};
    const comment = shot.comment || checkout.comments?.doors;
    const shippingCode = shot.shippingCode || checkout.shippingCodes?.doors || 'meest.doors';
    const doorsField = checkout.doorsField || '#shipping_address_street';
    await ensureCheckoutSession(page, profile);
    if (comment) {
      await page.fill('#comment', comment);
      await waitSimpleCheckoutIdle(page);
    }
    await selectCheckoutShipping(page, shippingCode);
    await waitCheckoutDoorsFields(page, profile);
    await fillCheckoutRegion(page, checkout.region || 'Сумська область', true, profile);
    await fillCheckoutCity(page, checkout.city || 'Суми', checkout.citySearch);
    await waitCheckoutDoorsFields(page, profile);
    await openCheckoutStreetDropdown(page, checkout.streetQuery || 'Пере', doorsField);
    await screenshot(page, outPath, true);
  },
};

async function capture(page, baseUrl, token, id, outDir, profile) {
  const named = typeof id === 'string' ? profile.namedShots?.[id] : null;
  const shot = named || profile.shots?.[id];
  const fileName = named?.file || `screenshot_${id}.png`;
  const outPath = path.join(outDir, fileName);
  if (!shot?.action) {
    throw new Error(`Unknown target id: ${id} for this module (no shots[${id}] / namedShots)`);
  }
  const fn = ACTIONS[shot.action];
  if (!fn) {
    throw new Error(`Unknown action '${shot.action}' for shot ${id}`);
  }
  await fn(page, baseUrl, token, profile, outPath, shot);
}

async function main() {
  const { module, targets, baseUrl, catalogBaseUrl, outDir: outDirArg } = parseArgs(process.argv);
  const profile = getProfile(module);
  profile.catalogBaseUrl = catalogBaseFromAdmin(baseUrl, catalogBaseUrl);
  const maxTarget = profile.maxTarget || 14;
  const namedKeys = Object.keys(profile.namedShots || {});
  const ids = parseTargets(targets, maxTarget, namedKeys);
  const outDir = outDirArg
    ? path.resolve(outDirArg)
    : path.join(REPO_ROOT, 'docs', module, 'images');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`module=${module} targets=${ids.join(',')} out=${outDir} catalog=${profile.catalogBaseUrl}`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    await login(page, baseUrl, 'admin', 'admin');
    const token = await getUserToken(page);

    for (const id of ids) {
      console.log(`capturing ${id}...`);
      await capture(page, baseUrl, token, id, outDir, profile);
    }
  } finally {
    captureSession.settingsRoute = '';
    captureSession.cnFormRoute = '';
    captureSession.cnFormFieldsCleared = false;
    captureSession.cnListRoute = '';
    captureSession.registryRoute = '';
    captureSession.checkoutKey = '';
    captureSession.checkoutOnPage = false;
    await browser.close();
  }

  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
