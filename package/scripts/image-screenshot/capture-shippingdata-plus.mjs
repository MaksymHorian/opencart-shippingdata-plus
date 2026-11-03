#!/usr/bin/env node
/**
 * One-off capture for shippingdata-plus instruction (oc3 + oc15).
 * Output: OCMax/Shipping Data Plus/images/screenshot_N.png
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = 'c:\\OpenServer\\home\\OCMax\\Shipping Data Plus\\images';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';
const ORDER_ID = '3';
const CUSTOMER_EMAIL = 'test@test.test';
const CUSTOMER_PASS = 'test';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function adminLogin(page, adminBase) {
  await page.goto(`${adminBase}/index.php?route=common/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#input-username', ADMIN_USER);
  await page.fill('#input-password', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/user_token=/, { timeout: 60000 });
  const url = new URL(page.url());
  return url.searchParams.get('user_token');
}

function adminUrl(adminBase, route, token, extra = '', isOc15 = false) {
  const key = isOc15 ? 'token' : 'user_token';
  return `${adminBase}/index.php?route=${route}&${key}=${token}${extra}`;
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('Saved', file);
}

async function openSdpNavbarOc3(page) {
  const toggle = page.locator('#sdp-truck-toggle').first();
  if (await toggle.count()) {
    await toggle.click({ force: true });
    return;
  }
  await page.locator('a.dropdown-toggle:has(.fa-truck)').first().click({ force: true });
}

async function openSdpNavbarOc15(page) {
  await page.getByRole('link', { name: 'Shipping Data Plus', exact: true }).click();
}

async function customerLogin(catalogBase, page, isOc15 = false) {
  await page.goto(`${catalogBase}/index.php?route=account/login`, { waitUntil: 'domcontentloaded' });
  const emailSel = isOc15 ? 'input[name="email"], #input-email' : '#input-email';
  const passSel = isOc15 ? 'input[name="password"], #input-password' : '#input-password';
  await page.locator(emailSel).first().fill(CUSTOMER_EMAIL);
  await page.locator(passSel).first().fill(CUSTOMER_PASS);
  await page.locator('input[type="submit"], #button-login, .button').first().click();
  await page.waitForTimeout(2000);
}

async function captureSandbox(adminBase, catalogBase, isOc15, shotMap, loginFn = adminLogin) {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const token = await loginFn(page, adminBase);
  const moduleRoute = isOc15 ? 'module/shippingdata_plus' : 'extension/module/shippingdata_plus';

  await page.goto(adminUrl(adminBase, moduleRoute, token, '', isOc15), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, shotMap.settings);

  await page.goto(adminUrl(adminBase, 'sale/order', token, '', isOc15), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  if (isOc15) {
    await openSdpNavbarOc15(page);
  } else {
    await openSdpNavbarOc3(page);
  }
  await page.waitForTimeout(500);
  await shot(page, shotMap.orderListNavbar);

  await page.goto(adminUrl(adminBase, 'sale/order/info', token, `&order_id=${ORDER_ID}`, isOc15), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  if (isOc15) {
    const tab = page.locator('a[href="#tab-shipping"], a:has-text("Shipping")').first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(500);
    }
  }
  await shot(page, shotMap.orderInfo);

  await customerLogin(catalogBase, page, isOc15);
  await page.goto(`${catalogBase}/index.php?route=account/order`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, shotMap.accountList);

  await page.goto(`${catalogBase}/index.php?route=account/order/info&order_id=${ORDER_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, shotMap.accountInfo);

  await browser.close();
}

async function adminLoginOc15(page, adminBase) {
  await page.goto(`${adminBase}/index.php?route=common/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[name="username"]').first().fill(ADMIN_USER);
  await page.locator('input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('input[type="submit"], a.button, .button').first().click();
  await page.waitForTimeout(3000);
  const u = new URL(page.url());
  if (u.searchParams.get('token')) {
    return u.searchParams.get('token');
  }
  await page.waitForURL(/token=/, { timeout: 120000 });
  return new URL(page.url()).searchParams.get('token');
}

async function main() {
  const oc3Only = process.argv.includes('--oc3-only');
  const oc15Only = process.argv.includes('--oc15-only');

  if (!oc15Only) {
    await captureSandbox('http://oc3/admin', 'http://oc3', false, {
      settings: 'screenshot_1.png',
      orderListNavbar: 'screenshot_2.png',
      orderInfo: 'screenshot_3.png',
      accountList: 'screenshot_4.png',
      accountInfo: 'screenshot_5.png',
    }, adminLogin);
  }

  if (oc3Only) {
    return;
  }

  await captureSandbox('http://oc15/admin', 'http://oc15', true, {
    settings: 'screenshot_6.png',
    orderListNavbar: 'screenshot_7.png',
    orderInfo: 'screenshot_8.png',
    accountList: 'screenshot_9.png',
    accountInfo: 'screenshot_10.png',
  }, adminLoginOc15);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
