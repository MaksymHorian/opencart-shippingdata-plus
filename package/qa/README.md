# OC Max QA Suites

Automated regression for shipping modules — **three layers**:

| Suite | What it tests | Entry |
|-------|---------------|--------|
| **cart** | Settings → `getQuote` (filters, API/tariff, free shipping, COD, tariffs) | snapshot/restore + OTA |
| **cn-form** | TTN form validation (`validateCNForm`) | admin bootstrap + reflection |
| **cn-list** | TTN list filters, print format resolution, label smoke | DB seed + model/helper probes |

## Commands

```powershell
.\package\scripts\qa-settings-matrix.ps1 -Module meest -Suite all
.\package\scripts\qa-settings-matrix.ps1 -Module meest -Suite cart
.\package\scripts\qa-settings-matrix.ps1 -Module meest -Suite cn-form
.\package\scripts\qa-settings-matrix.ps1 -Module meest -Suite cn-list
```

Cursor: `/qa meest matrix` (phase 3 of `full`) or `/qa meest full` (all 4 phases). Glossary: `docs/qa/README.md`.

## Schemas

```
package/qa/schemas/meest/
  cart.json      # getQuote matrix (116+ settings, critical pairs)
  cn-form.json   # CN form validation cases
  cn-list.json   # list filters + print settings
```

Legacy fallback: `schemas/{module}.json` = cart suite.

## Safety

- **cart / cn-list:** snapshot `shipping_{module}` → patch → assert → restore (per case + finally)
- **cn-list:** seeds `QA-MATRIX-*` rows, deletes after run
- **cn-form:** read-only validation (no saveCN / no API create)
- Reports: `package/qa/reports/` (gitignored)

## Add module

1. Copy `schemas/_template.json` → expand cart paths
2. Add `schemas/{module}/cn-form.json` with `valid_post` + cases
3. Add `schemas/{module}/cn-list.json` with `seed_rows` + filter/print cases

## Not covered here (browser)

- UI copy / tabs — `/qa {module} smoke` (audit)
- User actions (CN CRUD, checkout orders) — `/qa-browser {module} e2e` + `docs/qa/{module}-e2e.md`
- shippingdata AJAX — exercised in E2E checkout steps
