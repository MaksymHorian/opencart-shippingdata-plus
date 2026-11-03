# Instruction screenshots — shippingdata-plus

Fixed shot list for customer instruction HTML. **Manual invoke only** via `/instruction screenshots`. Spec text is **English only**.

| Path | Role |
|------|------|
| **PNG output** | `c:\OpenServer\home\OCMax\Shipping Data Plus\images\` (`screenshot_N.png`) |
| **This spec** | `docs/shippingdata-plus/images/SCREENSHOTS.md` (repo — no PNGs in git) |

| Setting | Value |
|---------|--------|
| Admin login (all sandboxes) | `admin` / `admin` |
| Smoke order (TTN) | `order_id=3` (Nova Poshta department, CN on order) |
| Filenames | `screenshot_1.png` … `screenshot_10.png` |

## Sandboxes (capture order)

1. **oc3** — `http://oc3/admin/` (admin), `http://oc3/` (catalog)
2. **oc15** — `http://oc15/admin/` (admin), `http://oc15/` (catalog)

On **oc3** the admin header uses a **truck icon** (`fa-truck`) dropdown for Shipping Data Plus. On **oc15** the same panel is opened from the text menu item **Shipping Data Plus** next to Logout (no truck icon). On **oc15** order-card TTN appears on the **shipping-address** tab.

## Capture tool

**Playwright** — `package/scripts/capture-image-screenshots.ps1` when a module profile exists. Until then: manual Playwright or approved browser capture per TW workflow.

```powershell
# oc3 batch (when profile wired):
.\package\scripts\capture-image-screenshots.ps1 -Module shippingdata-plus -Targets all -BaseUrl http://oc3/admin
# oc15 navbar + order card (separate base URL / profile flags when supported):
.\package\scripts\capture-image-screenshots.ps1 -Module shippingdata-plus -Targets 6-10 -BaseUrl http://oc15/admin
```

| Property | Value |
|----------|--------|
| Browser | Chromium maximized, `fullPage: true` unless noted |
| Module settings route | `index.php?route=extension/module/shippingdata_plus` |
| Module enabled | `module_shippingdata_plus_status=1`, all surface toggles on |

## Shot list — oc3 (IDs 1–5)

| ID | File | Navigation | UI state |
|----|------|------------|----------|
| 1 | `screenshot_1.png` | Module settings, tab **General** | Full page; module **Enabled**; all four surface toggles enabled |
| 2 | `screenshot_2.png` | `sale/order` (order list) | Truck menu dropdown **open** (API check / cities / departments panel visible) |
| 3 | `screenshot_3.png` | `sale/order/info&order_id=3` | Shipping method row shows grouped TTN, copy, carrier-colour **Track** button |
| 4 | `screenshot_4.png` | Catalog `account/order` (logged-in customer) | **Shipment** column with TTN + track button on a row with CN |
| 5 | `screenshot_5.png` | Catalog `account/order/info&order_id=3` | Shipment line under delivery (carrier name, grouped number, track) |

**Catalog login:** use an existing customer with order 3, or register/login a test customer on that shop if none works.

## Shot list — oc15 (IDs 6–10)

Same logical screens as oc3; differences called out below.

| ID | File | Navigation | UI state |
|----|------|------------|----------|
| 6 | `screenshot_6.png` | Module settings (General) | Same as #1 on oc15 |
| 7 | `screenshot_7.png` | `sale/order` | **Text** nav **Shipping Data Plus** menu **open** (not truck icon) |
| 8 | `screenshot_8.png` | `sale/order/info&order_id=3` | **Shipping address** tab active; TTN inline with shipping method |
| 9 | `screenshot_9.png` | Catalog account order list | Same as #4 |
| 10 | `screenshot_10.png` | Catalog account order info | Same as #5 |

## Instruction wiring

Primary HTML references use **oc3** shots **1–5**. FAQ / compatibility may reference **6–8** for OpenCart 1.5.x navbar and order-card layout.

Hosted URLs in fragments: `https://oc-max.com/docs/shippingdata-plus/images/screenshot_N.png`
