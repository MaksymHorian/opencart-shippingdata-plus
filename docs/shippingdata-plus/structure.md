# Shipping Data Plus

oc3-only admin module. It shows consignment numbers with a public tracking link, adds a truck menu for API checks and city/department refresh, and keeps one spare copy of each carrier directory. It does not change Shipping Data or carrier module PHP.

## Files

| File | Role |
|------|------|
| `admin/controller/extension/module/shippingdata_plus.php` | Settings form, install/uninstall, JSON `orders`, `ping`, `update`, `backup`, `restore` |
| `admin/model/extension/module/shippingdata_plus.php` | Carrier whitelist, consignment resolve, tracking URLs, shadow-table SQL, counts |
| `admin/view/template/extension/module/shippingdata_plus.twig` | Module switch, four surface switches, per-carrier backup panel |
| `admin/language/{en-gb,uk-ua,ru-ru}/extension/module/shippingdata_plus.php` | Admin and account strings |
| `system/shippingdata_plus.ocmod.xml` | UI hooks only. Author Prorab337 |

There is no catalog controller. Account pages load the admin model with `require_once` and `dirname(DIR_APPLICATION)`.

After the OCMOD file is in place: Extensions → Modifications → Refresh.

## Settings

Code `module_shippingdata_plus`. A surface is shown only when `status` is `1` and that surface key is `1`.

| Key | After install |
|-----|----------------|
| `module_shippingdata_plus_status` | `0` |
| `module_shippingdata_plus_order_list` | `1` |
| `module_shippingdata_plus_order_info` | `1` |
| `module_shippingdata_plus_account` | `1` |
| `module_shippingdata_plus_navbar` | `1` |
| `module_shippingdata_plus_backup_{carrier}` | empty until a backup succeeds (`Y-m-d H:i:s`), cleared on restore |
| `module_shippingdata_plus_navbar_{carrier}_{cities\|departments}` | last successful refresh count |

`{carrier}` is `novaposhta`, `rozetka_delivery`, `ukrposhta`, or `meest`.

Saving the form writes the five switches and keeps backup and navbar keys. `editSetting` would otherwise delete every key for this code.

## Directory whitelist

Shadow table `{DB_PREFIX}{table}__sdp`. During restore the live table is renamed to `{table}__aside`, then that aside table is dropped. Names come only from this list.

| Carrier | Tables |
|---------|--------|
| novaposhta | `novaposhta_regions`, `novaposhta_cities`, `novaposhta_departments`, `novaposhta_references` |
| rozetka_delivery | `rozetka_delivery_cities`, `rozetka_delivery_departments`, `rozetka_delivery_references` |
| ukrposhta | `ukrposhta_regions`, `ukrposhta_cities`, `ukrposhta_departments`, `ukrposhta_references` |
| meest | `meest_regions`, `meest_cities`, `meest_departments`, `meest_references` |

Backup replaces the spare (`DROP` `__sdp`, `CREATE LIKE`, `INSERT SELECT`). Restore requires every spare for that carrier to exist. One `RENAME TABLE` moves each live table to `__aside` and each spare to the live name. Then `__aside` is dropped. A failed rename leaves the live names in place.

Uninstall drops only `__sdp` and `__aside` tables for this whitelist and deletes `module_shippingdata_plus` settings. Live `novaposhta_*`, `ukrposhta_*`, `meest_*`, and `rozetka_delivery_*` tables stay.

Consignment tables, registries, and `oc_order` columns are not copied.

## Consignment

Read from `oc_order`: `shipping_code`, `shipping_method`, and `{carrier}_cn_number` when that column exists.

Match the same way as Shipping Data Admin: enabled carrier, `shipping_{carrier}.compatible_shipping_method` contains the full `shipping_code` or the part before `.` (an empty `shipping_code` matches too). First non-empty number wins, in order: Nova Poshta, Rozetka Delivery, Ukrposhta, Meest.

A digit-only number is shown in groups of four from the right, joined by a space: `20451529414638` → `20 4515 2941 4638`, `0505660067080` → `0 5056 6006 7080`, `101551810821` → `1015 5181 0821`. Meest stays as stored (`722-8040237`). The copy button still copies the raw number. On success the clipboard icon becomes a check and returns after about 2 seconds, with no copied tooltip. `number` in the orders JSON is raw; `display` is the grouped text.

The tracking control is a `btn btn-xs` in the carrier colour. Tooltip text is `text_track`, via `data-toggle="tooltip"`. Ukrposhta and Meest use dark icon and text. Account tracking links also use `sdp-btn-xs` (padding 1px 5px, font-size 9px, line-height 1.5).

| Carrier | Button | Text |
|---------|--------|------|
| novaposhta | `#ff392e` | `#ffffff` |
| ukrposhta | `#FFBE21` | `#1e1e1e` |
| rozetka_delivery | `#00A046` | `#ffffff` |
| meest | `#deebf5` | `#1e1e1e` |

| Carrier | Tracking |
|---------|----------|
| novaposhta | `https://novaposhta.ua/tracking/{ttn}/` |
| ukrposhta | `https://track.ukrposhta.ua/tracking_UA.html?barcode={ttn}` |
| rozetka_delivery | `https://rozetka.delivery/tracking/parcel?parcel_id={ttn}` |
| meest | `https://ua.meest.com/parcel-track?parcel_number={ttn}` |

The admin order list loads numbers with `POST extension/module/shippingdata_plus/orders`. The order card and both account pages call `getOrdersTtn()` in the controller hook.

Admin order list column title is `text_shipment` (uk Відправлення, en Shipment, ru Отправление). When Nova Poshta PRO is enabled, the current user can access it, and `oc_event.code` `novaposhta_pro_order_list` is on, this module does not add a column. It fills empty `.npp-ol-cell` cells and skips a row that already has `.npp-ol`. Otherwise it adds the column before Action. Copy stays on the admin list.

Admin order card: the grouped number, copy button, and tracking button stay on the same line as the shipping method. The number and both buttons sit in one nowrap span. They are left out when the resolved carrier is Nova Poshta and PRO owns that order: PRO is enabled, the user can access it, `novaposhta_pro_order_info` is on, and the order is `novaposhta_pro.*`, a PRO compatible method, or has a live `npp_shipment` row. The shipping-method cell markup that PRO splices is left intact.

Account order list column title stays `text_shipment`. The list cell and the order-info row show the carrier heading with a trailing ` API` removed, then the grouped number and the tracking button. They do not repeat `text_shipment`. No copy. Navbar and backup panels keep the full module heading.

## Truck menu

`fa-truck` in the admin header, next to any existing database icon. Listed carriers are the four whose `shipping_{carrier}_status` is on. Each has an API check, cities, and branches. Each of those rows is three columns: label, status (ping time, or count and signed delta; errors in that column), and the action button. The button shows a spinner and stays disabled while the request runs. Settings opens this module.

Ping is one read and does not call `update()`:

| Carrier | Call |
|---------|------|
| novaposhta | `apiRequest('Common', 'getServiceTypes')` |
| ukrposhta | `setApp('address-classifier-ws')` then `apiRequest('get_regions_by_region_ua')` |
| meest | `getSenderData()` |
| rozetka_delivery | `verify()` |

Green under 400 ms, orange from 400 through 1000, red above 1000 or on failure.

Refresh calls the carrier helper `update('cities'|'departments')` and reports the stored count after the call minus the count before it. `set_time_limit(0)` runs on refresh, backup, and restore. A `false` return from `update()` is an error and does not store a success delta.

## OCMOD targets

| File | Hook |
|------|------|
| `admin/controller/sale/order.php` | Order list flag; order card consignment, skipped when PRO owns that Nova Poshta order |
| `admin/view/template/sale/order_list.twig` | Column before Action, or fill of an empty PRO cell; copy and tracking button |
| `admin/view/template/sale/order_info.twig` | Inline number, copy, and tracking button in the shipping-method cell |
| `catalog/controller/account/order.php` | Account list and info |
| `catalog/view/theme/default/template/account/order_list.twig` | Column title, carrier name, grouped number, extra-small tracking button |
| `catalog/view/theme/default/template/account/order_info.twig` | Carrier name, grouped number, extra-small tracking button |
| `admin/controller/common/header.php` | Truck menu data |
| `admin/view/template/common/header.twig` | `fa-truck` dropdown |

JSON routes require `modify` on `extension/module/shippingdata_plus`. Contract: `specs/011-shipping-data-plus/contracts/admin-actions.md`.
