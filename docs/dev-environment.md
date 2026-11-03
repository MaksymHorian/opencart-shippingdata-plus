# Development Environment

OpenCart OC Max Ukrposhta — local sandboxes, release paths, and tooling.

## Directory layout

| Path | Role |
|------|------|
| `c:\OpenServer\home\oc3` | **Primary dev** — PHP, twig, OC3 OCMOD (`system/shippingdata_*.ocmod.xml`) |
| `c:\OpenServer\home\oc23` | Manual test OC 2.3 — tpl, own OCMOD in `system/` |
| `c:\OpenServer\home\oc21` | Manual test OC 2.1 — tpl, own OCMOD in `system/` |
| `c:\OpenServer\home\oc15` | Manual test OC 1.5 — tpl, VQMod in `vqmod/xml/` |
| `c:\OpenServer\home\OCMax` | Customer release archives (`Ukrposhta API\v. X.X.X\original\`; product `images\` for instruction PNGs) |
| `c:\OpenServer\home\REPO` | Git module repos (version control) — `opencart-ukrposhta` |
| `c:\OpenServer\home\storage_oc3` | External `DIR_STORAGE` for oc3 |

**Note:** `REPO` is intentionally uppercase — visually distinct from technical domains (`oc3`, `oc23`, …).

## Domains

| URL | OpenCart | Purpose |
|-----|----------|---------|
| `http://oc3/` | 3.0.4.x ocStore | Daily development + Cursor workspace |
| `http://oc23/` | 2.3.0.2.4 | Legacy checkout/admin test |
| `http://oc21/` | 2.1.0.2.1 | Legacy test (duplicate lang folders) |
| `http://oc15/` | 1.5.5.1.2 | Legacy test (VQMod) |

## Admin access (local sandboxes)

**Same credentials on every dev domain** (oc3, oc23, oc21, oc15, and any future sandbox under `c:\OpenServer\home\`):

| | Value |
|--|--------|
| Admin URL | `http://{domain}/admin/` |
| Username | `admin` |
| Password | `admin` |

Examples:

| Sandbox | Admin URL |
|---------|-----------|
| oc3 | `http://oc3/admin/` |
| oc23 | `http://oc23/admin/` |
| oc21 | `http://oc21/admin/` |
| oc15 | `http://oc15/admin/` |

Local dev only — not for production or public demos.

Used by **qa-browser**, **qa-engineer**, and manual testing. If the browser agent hits a login wall, log in with the credentials above (or confirm session is active).

## Catalog checkout (oc3)

**Simple Checkout** is the default storefront test path for **all** shipping modules on oc3 (qa-browser, qa-engineer, manual).

| Step | URL |
|------|-----|
| Test product | `http://oc3/index.php?route=product/product&product_id=40` |
| Checkout | `http://oc3/index.php?route=checkout/simplecheckout` |

Single-page checkout: shipping methods, city/department pickers (shippingdata), payment — no multi-step OC checkout on oc3 unless Simple is missing.

Legacy sandboxes (oc23/oc21/oc15) use each domain’s native checkout unless Simple is installed there.

## Source of truth

| Artifact | Source |
|----------|--------|
| PHP (all versions) | **oc3** — identical content, different paths on legacy sandboxes |
| OC3 templates | oc3 `.twig` |
| OC2.x / OC1.5 templates | **each legacy sandbox** `.tpl` — maintained per domain |
| OCMOD (OC3, 2.3, 2.1) | **each sandbox** `system/shippingdata_*.ocmod.xml` |
| VQMod (OC1.5) | **oc15** `vqmod/xml/` |
| Customer package | **OCMax** `original/` — built from sandboxes |
| Git **`dev`** | REPO **`dev`** — oc3 source + `system/` OCMOD + `docs/` (ukrposhta, shippingdata, ocmax-license, multi-version, …) + `package/` |
| Git **`release`** | REPO **`release`** — OCMax customer layout, no ZIP (`publish-repo.ps1`) |

**`propagate.ps1` does not copy OCMOD/VQMod.** It syncs module PHP, language, and templates (Twig→tpl) only. A shippingdata modifier fix must be applied in **oc3 + oc23 + oc21** (`system/shippingdata_*.ocmod.xml`) and **oc15** (`vqmod/xml/shippingdata*.xml`) separately — including every checkout variant file that shares the same snippet. Then Refresh Modifications (or clear `vqmod/vqcache`).

## Modifier dev notes (OC1.5)

In oc15 sandbox, Simple checkout variants for OC2/OC3 are **disabled** by trailing `_` in filename:

- `shippingdata_simple_v_2.X.X_.xml`
- `shippingdata_simple_v_3.X.X_.xml`

`build-ocmax.ps1` strips the trailing `_` when copying to `OCMax/.../OpenCart 1.5.X.X/modification/`.

## Scripts

Located in `oc3/package/` — **shared scripts**, **per-module manifest** (`modules/ukrposhta/manifest.json`). See `package/README.md`.

```powershell
.\package\scripts\propagate.ps1 -Module ukrposhta
.\package\scripts\build-ocmax.ps1 -Module ukrposhta
.\package\scripts\sync-repo-dev.ps1 -Module ukrposhta
.\package\scripts\publish-repo.ps1 -Module ukrposhta
```

## Related

- `@docs/ukrposhta/workflow.md` — release pipeline
- `@docs/ukrposhta/release-build.md` — sandbox → OCMax mapping
- `@docs/ukrposhta/structure.md` — file tree per OC version
