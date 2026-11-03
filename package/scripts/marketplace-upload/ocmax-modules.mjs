/**
 * Shared oc-max.com catalog specs. Category is the existing
 * Модули → Доставка (id 60). Never create a top-level Доставка.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../..');

export const CATEGORY = {
  id: '60',
  label: 'Модули > Доставка',
  parentNeedle: /модул/i,
  nameNeedle: /доставк/i,
};

export const MODULES = {
  novaposhta: {
    model: 'novaposhta',
    slug: 'nova-poshta-api',
    price: '28.89',
    manufacturer: 'OC Max',
    zip: 'c:\\OpenServer\\home\\OCMax\\Nova poshta API\\v. 4.1.1\\novaposhta_api_v_4.1.1.zip',
    galleryDir: 'c:\\OpenServer\\home\\OCMax\\Nova poshta API\\images',
    listingDir: path.join(REPO, 'docs/novaposhta/listing'),
    folder: 'novaposhta',
    dlName: 'novaposhta_api_v_4.1.1.zip',
    dlMatch: 'novaposhta_api',
    productId: '53',
    version: '4.1.1',
    compat: 'OpenCart 2.1–3.0, ocStore 2.3–3.0',
    names: {
      uk: '"Нова пошта API" - модуль доставки для OpenCart',
      en: '"Nova Poshta API" - shipping module for OpenCart',
      ru: '"Новая почта API" - модуль доставки для OpenCart',
    },
    meta: {
      uk: 'Модуль доставки Нова пошта для OpenCart: відділення, поштомат, кур\'єр, ТТН, API.',
      en: 'Nova Poshta shipping module for OpenCart: branch, parcel locker, courier, waybills, API.',
      ru: 'Модуль доставки Новая почта для OpenCart: отделение, почтомат, курьер, ТТН, API.',
    },
    tags: {
      uk: 'нова пошта, доставка, opencart, oc-max',
      en: 'nova poshta, shipping, opencart, oc-max',
      ru: 'новая почта, доставка, opencart, oc-max',
    },
    descFiles: {
      uk: 'description.forum.uk.html',
      en: 'description.forum.en.html',
      ru: 'description.forum.ru.html',
    },
  },
  meest: {
    model: 'meest',
    slug: 'meest-poshta',
    price: '28.89',
    manufacturer: 'OC Max',
    zip: 'c:\\OpenServer\\home\\OCMax\\Meest POSHTA\\v. 0.1.0\\meest_poshta_v_0.1.0.zip',
    galleryDir: 'c:\\OpenServer\\home\\OCMax\\Meest POSHTA\\images',
    listingDir: path.join(REPO, 'docs/meest/listing'),
    folder: 'meest',
    dlName: 'meest_poshta_v_0.1.0.zip',
    dlMatch: 'meest_poshta',
    productId: '54',
    version: '0.1.0',
    compat: 'OpenCart 1.5–3.0, ocStore 1.5–3.0',
    names: {
      uk: '"Meest ПОШТА" - модуль доставки для OpenCart',
      en: '"Meest POSHTA" - shipping module for OpenCart',
      ru: '"Meest ПОШТА" - модуль доставки для OpenCart',
    },
    meta: {
      uk: 'Модуль доставки Meest ПОШТА для OpenCart: відділення, поштомат, кур\'єр, ТТН, реєстри, друк і трекінг через API.',
      en: 'Meest POSHTA shipping module for OpenCart: branch, parcel locker, courier, CN, registries, printing and API tracking.',
      ru: 'Модуль доставки Meest ПОШТА для OpenCart: отделение, почтомат, курьер, ТТН, реестры, печать и отслеживание через API.',
    },
    tags: {
      uk: 'meest, доставка, opencart, oc-max',
      en: 'meest, shipping, opencart, oc-max',
      ru: 'meest, доставка, opencart, oc-max',
    },
    descFiles: {
      uk: 'description.forum.uk.html',
      en: 'description.forum.en.html',
      ru: 'description.forum.ru.html',
    },
  },
  ukrposhta: {
    model: 'ukrposhta',
    slug: 'ukrposhta-api',
    price: '28.89',
    manufacturer: 'OC Max',
    zip: 'c:\\OpenServer\\home\\OCMax\\Ukrposhta API\\v. 2.3.1\\ukrposhta_api_v_2.3.1.zip',
    galleryDir: 'c:\\OpenServer\\home\\OCMax\\Ukrposhta API\\images',
    listingDir: path.join(REPO, 'docs/ukrposhta/listing'),
    folder: 'ukrposhta',
    dlName: 'ukrposhta_api_v_2.3.1.zip',
    dlMatch: 'ukrposhta_api',
    productId: '55',
    version: '2.3.1',
    compat: 'OpenCart 2.1–3.0, ocStore 2.3–3.0',
    names: {
      uk: '"Укрпошта API" - модуль доставки для OpenCart',
      en: '"Ukrposhta API" - shipping module for OpenCart',
      ru: '"Укрпочта API" - модуль доставки для OpenCart',
    },
    meta: {
      uk: 'Модуль доставки Укрпошта для OpenCart: відділення, кур\'єр, ТТН, API.',
      en: 'Ukrposhta shipping module for OpenCart: branch, courier, waybills, API.',
      ru: 'Модуль доставки Укрпочта для OpenCart: отделение, курьер, ТТН, API.',
    },
    tags: {
      uk: 'укрпошта, доставка, opencart, oc-max',
      en: 'ukrposhta, shipping, opencart, oc-max',
      ru: 'укрпочта, доставка, opencart, oc-max',
    },
    descFiles: {
      uk: 'description.forum.uk.html',
      en: 'description.forum.en.html',
      ru: 'description.forum.ru.html',
    },
  },
  rozetka_delivery: {
    model: 'rozetka_delivery',
    slug: 'rozetka-delivery',
    price: '28.89',
    manufacturer: 'OC Max',
    zip: 'c:\\OpenServer\\home\\OCMax\\ROZETKA Delivery\\v. 1.2.0\\rozetka_delivery_v_1.2.0.zip',
    galleryDir: 'c:\\OpenServer\\home\\OCMax\\ROZETKA Delivery\\images',
    listingDir: path.join(REPO, 'docs/rozetka_delivery/listing'),
    folder: 'rozetka_delivery',
    dlName: 'rozetka_delivery_v_1.2.0.zip',
    dlMatch: 'rozetka_delivery',
    productId: '56',
    version: '1.2.0',
    compat: 'OpenCart 2.1–3.0, ocStore 2.3–3.0',
    names: {
      uk: '"ROZETKA Delivery" - модуль доставки для OpenCart',
      en: '"ROZETKA Delivery" - shipping module for OpenCart',
      ru: '"ROZETKA Delivery" - модуль доставки для OpenCart',
    },
    meta: {
      uk: 'Модуль доставки ROZETKA Delivery для OpenCart: відділення, кур\'єр, ТТН, API.',
      en: 'ROZETKA Delivery shipping module for OpenCart: branch, courier, waybills, API.',
      ru: 'Модуль доставки ROZETKA Delivery для OpenCart: отделение, курьер, ТТН, API.',
    },
    tags: {
      uk: 'rozetka delivery, доставка, opencart, oc-max',
      en: 'rozetka delivery, shipping, opencart, oc-max',
      ru: 'rozetka delivery, доставка, opencart, oc-max',
    },
    descFiles: {
      uk: 'description.forum.uk.html',
      en: 'description.forum.en.html',
      ru: 'description.forum.ru.html',
    },
  },
};

export function shippingProducts() {
  return Object.keys(MODULES).map((key) => ({
    key: key,
    id: MODULES[key].productId,
    name: MODULES[key].names.ru,
    model: MODULES[key].model,
  })).filter((row) => row.id);
}

export function relatedFor(key) {
  return shippingProducts().filter((row) => row.key !== key);
}
