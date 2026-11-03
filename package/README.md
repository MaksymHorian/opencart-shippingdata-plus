# Release package (Variant A)

Per-module release tooling for OC Max extensions. **Not** the customer zip — that is `OCMax/.../original/`.

## Layout

```
extra/                        # shared release assets (SQL dumps) — oc3 root, all delivery modules
package/
├── README.md                 # this file
├── bin/
│   └── php-cs-fixer.phar     # committed on REPO dev (lint variant A)
├── phpstan.neon              # PHPStan level 4 + unused-public (helpers)
├── phpstan-baseline.neon     # known legacy suppressions (committed)
├── composer.json / lock      # lint deps (unused-public); run composer install
├── phpstan/                  # OpenCart stubs for analyse
├── php-cs-fixer.extension.php
├── .php-cs-fixer.dist.php
├── assets/                   # shared static assets (e.g. oc15-admin JS/CSS)
│   └── oc15-admin/
├── lib/
│   └── ReleaseModule.ps1     # shared logic (module-agnostic)
├── qa/                       # settings → catalog quote matrix (OTA + restore)
│   ├── README.md
│   ├── run-settings-matrix.php
│   ├── lib/
│   └── schemas/              # meest full; NP/ukrposhta/rozetka stubs
├── scripts/                  # entry points — require -Module
│   ├── release-all.ps1
│   ├── propagate.ps1
│   ├── lint-php.ps1          # PHPStan + CS-Fixer (always both)
│   ├── qa-settings-matrix.ps1
│   ├── build-ocmax.ps1
│   ├── build-instruction.ps1
│   ├── encode-ocmax.ps1
│   └── publish-repo.ps1
└── modules/
    ├── _template/            # copy when adding a new module
    │   └── manifest.json
    ├── ukrposhta/
    ├── rozetka_delivery/
    └── novaposhta/
        └── manifest.json     # paths, file lists, OCMax mapping
```

## Usage

```powershell
.\package\scripts\propagate.ps1 -Module ukrposhta
.\package\scripts\lint-php.ps1 -Module meest
.\package\scripts\qa-settings-matrix.ps1 -Module meest
.\package\scripts\propagate.ps1 -Module rozetka_delivery
.\package\scripts\propagate.ps1 -Module novaposhta
.\package\scripts\propagate.ps1 -Module ukrposhta -Templates full   # reconvert all tpl
.\package\scripts\build-ocmax.ps1 -Module ukrposhta
.\package\scripts\sync-repo-dev.ps1 -Module ukrposhta
.\package\scripts\publish-repo.ps1 -Module ukrposhta
```

Slash commands (`/release propagate`) pass `-Module`; supported: `ukrposhta`, `rozetka_delivery`, `novaposhta`.

**Templates:** by default only twig files with changed SHA256 are converted (state: `modules/{name}/.propagate-state.json`). Use `-Templates full` to reconvert all.

## New module

1. Copy `modules/_template/` → `modules/{name}/`
2. Fill `manifest.json` (paths, php maps, upload lists, modifiers)
3. Create `REPO/opencart-{name}/` and `OCMax/{Product}/` on disk
4. Run scripts with `-Module {name}`

Each module has **its own manifest** in git (`REPO/.../package/modules/{name}/` after publish). Scripts stay **shared**.

## Related

- `@docs/dev-environment.md`
- `@docs/ukrposhta/workflow.md`
