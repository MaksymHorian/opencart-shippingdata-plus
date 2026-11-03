# Multi-version OpenCart (OC Max pattern)

OC Max modules ship **one PHP source** for OpenCart 1.5.x through 3.x. Runtime behavior is selected with `version_compare(VERSION, …)`. The **install package** copies the same file into version-specific paths (see [File placement](#file-placement)).

Reference implementations in this repo:


| File                                                     | Role                                          |
| -------------------------------------------------------- | --------------------------------------------- |
| `admin/controller/extension/shipping/ukrposhta.php`      | Admin UI, install, settings, version branches |
| `catalog/model/extension/shipping/ukrposhta.php`         | `getQuote()`, catalog settings                |
| `catalog/controller/extension/module/ukrposhta_cron.php` | Cron controller + model name branching        |
| `system/helper/ukrposhta.php`                            | Shared helper — settings key only             |


---



## Dual class (same file)

OpenCart resolves the class from the file path. Put **all logic** in the legacy base class; keep the extension wrapper **empty**.

```php
<?php
class ControllerShippingExample extends Controller {
    protected $extension = 'example';

    public function index() {
        // all methods here
    }
}

class ControllerExtensionShippingExample extends ControllerShippingExample {
}
```

Models follow the same pattern:

```php
class ModelShippingExample extends Model {
    // ...
}

class ModelExtensionShippingExample extends ModelShippingExample {
}
```

Module (cron) controllers:

```php
class ControllerModuleExampleCron extends Controller {
    // ...
}

class ControllerExtensionModuleExampleCron extends ControllerModuleExampleCron {
}
```

**Do not** add logic to wrapper classes.

---



## Version breakpoints

Use the same thresholds as existing modules:


| Check                                   | When                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `version_compare(VERSION, '3', '>=')`   | OC3 settings prefix, `user_token`, marketplace routes, Twig, `total_{code}_*` keys |
| `version_compare(VERSION, '3', '<')`    | Manual `$data[...] = $this->language->get(...)` for admin templates (OC3 uses `event/language`) |
| `version_compare(VERSION, '2.3', '>=')` | `extension/` paths for shipping/module/language/model                              |
| `version_compare(VERSION, '2.2', '>=')` | Minor catalog differences                                                          |
| `version_compare(VERSION, '2', '>=')`   | OC2 vs OC1.5 (dashboard, redirect, `.tpl`)                                         |
| `version_compare(VERSION, '2', '<')`    | OC1.5 layout (`$this->template`, `$this->render()`)                                |


---



## File placement

Same file content, different paths in release packages:


| Component         | OC 3.x / 2.3.x                                          | OC 2.0–2.2                                    | OC 1.5.x                                      |
| ----------------- | ------------------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| Admin controller  | `admin/controller/extension/shipping/{name}.php`        | `admin/controller/shipping/{name}.php`        | `admin/controller/shipping/{name}.php`        |
| Admin model       | `admin/model/extension/shipping/{name}.php`             | `admin/model/shipping/{name}.php`             | `admin/model/shipping/{name}.php`             |
| Admin view        | `admin/view/template/extension/shipping/{name}.twig`    | `admin/view/template/shipping/{name}.tpl`     | `admin/view/template/shipping/{name}.tpl`     |
| Admin language    | `admin/language/{locale}/extension/shipping/{name}.php` | `admin/language/{locale}/shipping/{name}.php` | `admin/language/{locale}/shipping/{name}.php` |
| Catalog model     | `catalog/model/extension/shipping/{name}.php`           | `catalog/model/shipping/{name}.php`           | `catalog/model/shipping/{name}.php`           |
| Module controller | `catalog/controller/extension/module/{name}.php`        | same                                          | `catalog/controller/module/{name}.php`        |
| Helper            | `system/helper/{name}.php`                              | same                                          | same                                          |


This sandbox uses **OC3 paths only** (`extension/`). Edits here are copied to legacy paths when building releases.

---

## Propagate template pipeline

Legacy `.tpl` for OC 2.3 / 2.1 / 1.5 are **generated from OC3 `.twig`** in the dev sandbox — not hand-maintained in oc23/oc21/oc15.

**Goal:** `propagate.ps1` is the single source of truth: edit `.twig` in oc3 → correct `.tpl` in legacy sandboxes.

### Pipeline

| Step | File | Role |
| ---- | ---- | ---- |
| 1 | `package/lib/TwigToTpl.ps1` | Twig → PHP `.tpl` conversion |
| 2 | `package/lib/TplAdaptations.ps1` | Per-target post-convert fixes |
| 3 | `package/lib/ReleaseModule.ps1` | Copy PHP/lang + convert templates + `tplReplacements` |
| 4 | `package/modules/{module}/manifest.json` | `propagate.tplReplacements`, `propagate.tplAdaptations` |
| 5 | `package/tests/TwigToTpl.tests.ps1` | Pester unit tests for the converter |

Module-specific rules: `manifest.json` → `propagate.tplAdaptations` (structural) and `propagate.tplReplacements` (string/token swaps). Template change tracking: `package/modules/{module}/.propagate-state.json`.

### Commands

```powershell
# Changed twig only (default)
powershell -NoProfile -ExecutionPolicy Bypass -File package\scripts\propagate.ps1 -Module ukrposhta

# All module templates
powershell -NoProfile -ExecutionPolicy Bypass -File package\scripts\propagate.ps1 -Module ukrposhta -Templates full
```

After **TwigToTpl.ps1** changes, run `-Templates full` so legacy sandboxes pick up converter output even when twig sources did not change.

### TwigToTpl conversion rules

Write twig so the converter emits **legacy-style PHP** (see tests in `TwigToTpl.tests.ps1`).

| Twig pattern | Generated PHP (typical) |
| ------------ | ----------------------- |
| `{% for item in items %}` (no loop vars) | `foreach ($items as $item)` |
| `{% for k, v in parcels %}` | `foreach ($parcels as $k => $v)` |
| `{% for c, settings in ukrposhta['…'] %}` | `if (isset(...)) { foreach (... as $c => $settings) }` |
| `{% for cn in cns %} … {% else %} … {% endfor %}` | `if ($cns) { foreach … } else { … }` |
| `'x' in displayed_information` / `not in` | `in_array('x', $displayed_information)` — simple var, no safe-array wrapper |
| `{{ x not in arr ? ' attr' }}` (column hide) | `<?php if (!in_array(...)) { echo ' attr'; } ?>` |
| `{{ x ? ' checked' }}` / comparisons in attributes | `<?php echo $x ? ' checked' : ''; ?>` — no extra parens; **not** `if { echo }` except `in`/`not in` |
| `{{ a ~ b ~ c }}` | `$a . $b . $c` — parens only on complex sub-expressions |
| `{% if total.status %}` | `if ($total['status'])` — no `isset()` wrapper on simple property |
| `parcels[k] ? parcels[k]['field'] : default` | `(isset($k, $parcels[$k])) ? $parcels[$k]['field'] : default` |
| `loop.index0` in body | `$__loopN` counter only when loop metadata is referenced; prefer `{% for k, v %}` + `{{ k }}` |
| `{% if k == ukrposhta['key'] %}` | Safe read for bracket settings keys in conditions |

**Prefer in twig:** keyed loops (`k, v`), explicit counter var (`c, settings`) instead of `loop.index0` / `loop.parent.loop.index0`; `{% for k, v in totals %}` with `{{ k }}` in JS embeds instead of `loop.index0`.

### Per-target adaptations (TplAdaptations.ps1)

| Target | Rule |
| ------ | ---- |
| oc23, oc21, oc15 | jQuery `.container-fluid:eq(2)` → `eq(1)` |
| oc21, oc15 | Remove `&type=shipping` from save-exit redirect to `extension/shipping` |
| oc15 only | Strip `<?php echo $column_left; ?>` — OC 1.5 admin layout has no sidebar column |
| oc15 only | Pagination row: OC3 two-column `pagination` + `results` → single `col-sm-12 text-right` with `$pagination` only (OC 1.5 embeds “Showing X to Y of Z” inside `$pagination->render()`, no separate `$results`) |
| oc15 only | Replace `data-toggle="image"` block with `package/modules/ukrposhta/tpl-snippets/oc15-image-picker.tpl`; inject `image_upload()` JS if missing |

### OC 1.5 admin static assets

Separate from twig→tpl: `package/assets/oc15-admin/` → oc15 sandbox on propagate → OCMax `OpenCart 1.5.X.X/upload/admin/view/{javascript,stylesheet}/ocmax/`. Enable via manifest `sharedLayers.oc15AdminAssets: true` (auto propagate + build paths).

Required because OC 1.5 admin controller methods rewrite header to reference `view/javascript/ocmax/*` and `view/stylesheet/ocmax/*` (Bootstrap 3 + datetimepicker). See `@docs/ukrposhta/release-build.md`.

**Admin autocomplete (OC 1.5):** stock `admin/view/javascript/common.js` has **no** `$.fn.autocomplete` (OC 2.x/3 do). Shared shim `ocmax.js` defines `$.fn.autocompleteOM` and assigns `$.fn.autocomplete` to it. Header rewrite loads `ocmax.js` **before** CDN jQuery UI, which would otherwise steal `.autocomplete` (widget API ≠ OpenCart `source(string)` / `select(item)`). `ocmax.js` re-asserts the alias on `$(document).ready` so module scripts bind the OC Max shim. Keep `.autocomplete({…})` in OC3 twig — do **not** rewrite tpl to `autocompleteOM` via `TplAdaptations`.

### Verification

```powershell
Invoke-Pester -Path package\tests\TwigToTpl.tests.ps1, package\tests\TplAdaptations.tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File package\scripts\propagate.ps1 -Module ukrposhta -Templates full
```

Acceptance: no `$loop[`, no invalid `'not in` twig syntax in `.tpl`, Pester green, functional parity with reference templates (cn_list columns, tracking indices, OC15 image picker, alerts placement). OC 1.5 `.tpl`: no `$column_left`, list pagination without undefined `$results`.

### Out of scope

- Hand-editing legacy `.tpl` (fix twig or converter, then propagate)
- OC3 `.twig` changes only when the feature requires it; converter fixes do not need twig edits
- PHP controller multi-version branching (see sections above)
- Other modules: converter is generic; each module adds manifest entries when adopted

---



## Copy-paste snippets

Replace `{name}` with the extension code (e.g. `ukrposhta`).

### Settings read (helper, model, cron)

```php
if (version_compare(VERSION, '3', '>=')) {
    $this->settings = $this->config->get('shipping_{name}');
} else {
    $this->settings = $this->config->get('{name}');
}
```

License key:

```php
if (version_compare(VERSION, '3', '>=')) {
    $this->license = $this->config->get('shipping_{name}_license');
} else {
    $this->license = $this->config->get('{name}_license');
}
```

Single config value (e.g. sort order):

```php
if (version_compare(VERSION, '3', '>=')) {
    $sort_order = $this->config->get('shipping_{name}_sort_order');
} else {
    $sort_order = $this->config->get('{name}_sort_order');
}
```



### Load language

```php
if (version_compare(VERSION, '2.3', '>=')) {
    $this->load->language('extension/shipping/{name}');
} else {
    $this->load->language('shipping/{name}');
}
```



### Language variables into template data

Distinct from [Load language](#load-language) above — the language **file** must still be loaded on every version. This block passes keys into `$data` for the admin view.

```php
/* Initialization of language variables */
if (version_compare(VERSION, '3', '<')) {
    $data['heading_title'] = $this->language->get('heading_title');
    $data['button_filter'] = $this->language->get('button_filter');
    // ... every key the template uses
}
```

On OC3, `system/config/admin.php` registers `event/language` on `view/*/before` (priority 999). `admin/controller/event/language.php` `index()` copies every key from `$this->language->all()` into template args, skipping keys already in `$args` (`!isset`). Explicit `$data['key']` assignments therefore always win; assigning unconditionally on OC3 is harmless but diverges from convention.

OC 2.x and OC1.5 have no such event — the controller must assign every key manually. Release builds copy PHP verbatim (`ReleaseModule.ps1`); only templates are converted, so the same controller ships to all OpenCart versions. **Do not remove this gate** — legacy admin pages would break.

**Debugging:** the hook is wired in config (`$_['action_event']`), not the `oc_event` table. Querying `oc_event` returns nothing for it.

All OC Max shipping admin controllers use this pattern (typically under `/* Initialization of language variables */` in `index()` and `getCNList()`).



### Load model (admin install / uninstall)

```php
if (version_compare(VERSION, '2.3', '>=')) {
    $this->load->model('extension/shipping/{name}');
    $this->{'model_extension_shipping_' . $this->extension}->creatTables();
} else {
    $this->load->model('shipping/{name}');
    $this->{'model_shipping_' . $this->extension}->creatTables();
}
```



### Load model (module cron) + dynamic property name

```php
if (version_compare(VERSION, '2.3', '>=')) {
    $this->load->model('extension/module/{name}_cron');
    $model_name = 'model_extension_module_{name}_cron';
} else {
    $this->load->model('module/{name}_cron');
    $model_name = 'model_module_{name}_cron';
}

$result = $this->$model_name->getOrders();
```



### Save settings (admin POST)

```php
if (version_compare(VERSION, '3', '>=')) {
    $this->model_setting_setting->editSetting('shipping_' . $this->extension, $this->request->post, $this->request->post['store_id']);
} elseif (version_compare(VERSION, '2.3', '>=')) {
    $this->model_setting_setting->editSetting($this->extension, $this->request->post, $this->request->post['store_id']);
} else {
    $this->model_setting_setting->editSetting($this->extension, $this->request->post, $this->request->post['store_id']);
}
```



### Admin URLs, token, extension prefix (set once in `index()`)

```php
if (version_compare(VERSION, '3', '>=')) {
    $data['action'] = $this->url->link('extension/shipping/' . $this->extension, 'user_token=' . $this->session->data['user_token'], true);
    $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=shipping', true);
    $data['user_token'] = $this->session->data['user_token'];
    $extension_code = 'shipping_' . $this->extension;
    $extension_path = 'extension/';
} elseif (version_compare(VERSION, '2.3', '>=')) {
    $data['action'] = $this->url->link('extension/shipping/' . $this->extension, 'token=' . $this->session->data['token'], true);
    $data['cancel'] = $this->url->link('extension/extension', 'token=' . $this->session->data['token'] . '&type=shipping', true);
    $data['token'] = $this->session->data['token'];
    $extension_code = $this->extension;
    $extension_path = 'extension/';
} else {
    $data['action'] = $this->url->link('extension/shipping/' . $this->extension, 'token=' . $this->session->data['token'], 'SSL');
    $data['cancel'] = $this->url->link('extension/shipping', 'token=' . $this->session->data['token'], 'SSL');
    $data['token'] = $this->session->data['token'];
    $extension_code = $this->extension;
    $extension_path = '';
}
```

Use `$extension_path` for catalog cron/front routes:

```php
$route = $extension_path . 'module/{name}_cron/update';
// OC3/2.3+: extension/module/...
// OC1.5:     module/...
```



### Render admin template

```php
if (version_compare(VERSION, '2.3', '>=')) {
    $data['header'] = $this->load->controller('common/header');
    $data['column_left'] = $this->load->controller('common/column_left');
    $data['footer'] = $this->load->controller('common/footer');
    $this->response->setOutput($this->load->view('extension/shipping/' . $this->extension, $data));
} elseif (version_compare(VERSION, '2', '>=')) {
    $data['header'] = $this->load->controller('common/header');
    $data['column_left'] = $this->load->controller('common/column_left');
    $data['footer'] = $this->load->controller('common/footer');
    $this->response->setOutput($this->load->view('shipping/' . $this->extension . '.tpl', $data));
} else {
    $data['header'] = $this->getChild('common/header');
    $data['footer'] = $this->getChild('common/footer');
    $this->template = 'shipping/' . $this->extension . '.tpl';
    $this->data = $data;
    $this->response->setOutput($this->render());
}
```



### Twig AJAX URL (OC3 admin)

```javascript
url: 'index.php?route=extension/shipping/{name}/update&type=departments&user_token={{ user_token }}'
```

OC 2.3 uses `token={{ token }}` instead of `user_token`.

Propagate rewrites the echo form (`&user_token=<?php echo $user_token; ?>`) in `tplReplacements` and, for `{% set %} ~ user_token` concat, `Apply-OcLegacySessionTokenAdaptation` in `package/lib/TplAdaptations.ps1`. Do not globally replace `&user_token=` — Ukrposhta settings JS posts the API credential as `user_token`.

### Extension / total modules (catalog totals loop)

```php
if (version_compare(VERSION, '2', '<') || version_compare(VERSION, '3', '>=')) {
    $this->load->model('setting/extension');
    $result = $this->model_setting_extension->getExtensions('total');
} else {
    $this->load->model('extension/extension');
    $result = $this->model_extension_extension->getExtensions('total');
}

foreach ($result as $v) {
    if (version_compare(VERSION, '3', '>=')) {
        if ($this->config->get('total_' . $v['code'] . '_status')) {
            // ...
        }
    } else {
        if ($this->config->get($v['code'] . '_status')) {
            // ...
        }
    }
}
```

---



## Editing checklist

When adding or changing extension code:

- [ ] Logic stays in the **base class**; wrapper remains empty
- [ ] New admin template language keys go **inside** the `version_compare(VERSION, '3', '<')` block with neighbouring keys, not outside it
- [ ] Settings, routes, tokens, and model paths use `version_compare` — match neighbouring code in the same file
- [ ] No OC3-only shortcuts unless dropping old OC support is explicitly requested
- [ ] Helper changes: branch settings keys if reading `config`
- [ ] New admin AJAX/route: OC3 `user_token`, OC2 `token`, correct `extension/` prefix
- [ ] Sandbox edit under `extension/` paths; release build copies to legacy paths

---



## Related


| Doc                                | Contents                                   |
| ---------------------------------- | ------------------------------------------ |
| `@docs/ukrposhta/workflow.md`      | When to propagate, release steps           |
| `@docs/shippingdata/structure.md`  | Shared checkout layer (also multi-version) |
| `@docs/ocmax-license/structure.md` | License UI across OC versions              |


