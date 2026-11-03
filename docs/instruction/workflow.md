# Customer instruction — shared workflow

Universal workflow for **multilingual customer instruction HTML** (UA / EN / RU). Module-specific paths come from `package/modules/{module}/manifest.json` and `docs/{module}/instruction/README.md`.

Used by: **Technical Writer** subagent (route K), Release Engineer (build copies output to OCMax).

## Per-module layout

```
docs/{module}/
├── instruction/
│   ├── content.uk.html    # Ukrainian body (nav + sections)
│   ├── content.en.html    # English
│   ├── content.ru.html    # Russian
│   ├── runtime.js         # language switcher (rare edits)
│   └── README.md          # module notes
├── images/                # SCREENSHOTS.md spec only — PNGs → OCMax/{Product}/images/
│   ├── README.md
│   └── SCREENSHOTS.md
├── listing/
│   └── LISTING.md         # marketplace listing spec (forum + code)
└── instruction.html       # generated — do not hand-edit (under docs/{module}/)
```

## Two separate versions

| Version | Source | Used for |
|---------|--------|----------|
| **Instruction version** | `docs/{module}/instruction/content.*.html` (navbar, changelog, update blocks) | Customer `instruction.html`, oc-max.com docs |
| **Module release version** | `protected $version` in admin controller | OCMax build, encode, module admin UI |

They **may differ** until `/instruction sync` or explicit version bump. Technical Writer owns instruction version only.

**Never** change admin controller PHP to update instruction version.

### `/instruction sync` (default)

1. Read **target version** from controller `protected $version` (manifest `version.controller`) — **read only, do not edit PHP**
2. Set instruction version in fragments: navbar, update-block headers, latest changelog top block
3. Remove changelog blocks **newer** than target (test/orphan entries)
4. Rebuild `instruction.html`

Explicit target: user says «версію інструкції 2.3.2» → use that version instead of controller.

Build script (`build-instruction.ps1`) reads instruction version from fragments (latest `#changelog` block, else navbar). Override: `-Version "2.3.2"`.

Controller path in manifest (`version.controller`) is for **release build** and **gate comparison** only — not for TW edits.

## Build

```powershell
.\package\scripts\build-instruction.ps1 -Module {module}
.\package\scripts\build-instruction.ps1 -Module {module} -Version "2.3.2"   # optional override
```

Output: `docs/{module}/instruction.html`

Also runs at the start of `/release build` and is copied to `OCMax/{Product}/v. X.X.X/instruction.html`.

## Changelog format

Section id: `#changelog` in each `content.*.html`.

Add a new block **at the top** of the changelog card (newest first):

| Language | Header pattern |
|----------|----------------|
| uk | `<kbd>v. X.Y.Z від DD.MM.YYYY:</kbd>` |
| en | `<kbd>v. X.Y.Z from DD.MM.YYYY:</kbd>` |
| ru | `<kbd>v. X.Y.Z от DD.MM.YYYY:</kbd>` |

Follow with `<ul><li>…</li></ul>` bullets.

**Changelog sources (either or both):**

- Implement report / planner output from Tech Lead
- User-provided bullet list in chat

## Edit rules

- Edit **fragments only** (`content.*.html`, `runtime.js`) — never the assembled `instruction.html`
- **Never edit PHP**, Twig, OCMOD, or admin controller for instruction work
- Keep **structure aligned** across uk / en / ru (same sections, anchors, accordion ids)
- Match existing Bootstrap 4 markup and badge styles in neighbouring sections
- Reference shared assets consistently (`extra/`, modifiers, oc-max.com image URLs)
- All fragment content may be in target language; this workflow doc stays English

## Public URLs (after upload to oc-max.com)

```
instruction.html
instruction.html?lang=uk
instruction.html?lang=en
instruction.html?lang=ru
```

Upload to oc-max.com is **manual** (out of agent scope for now).

## Screenshots

| Item | Rule |
|------|------|
| Trigger | `/instruction screenshots [module] [targets]` — **manual only** |
| Tool | **Playwright** — `package/scripts/capture-image-screenshots.ps1` |
| Agent | **Technical Writer → tw-screenshot** subagent |
| Parent | Tech Lead invokes TW; TW passes only `module` + `targets` to tw-screenshot |
| Output | `OCMax/{Product}/images/screenshot_N.png` (manifest `screenshots`; not in git) |
| Spec | `docs/{module}/images/SCREENSHOTS.md` |
| DB tab (#4) | **DOM only** — mock amounts `+N` + alert «Дані успішно оновлено»; no update API |
| CN list (#14) | **DOM only** — alert «Накладна успішно збережена»; no save API |

Filenames: single language set (`screenshot_1.png` …). Overwrite on re-run.

## Brand assets (logo / favicon)

| Item | Rule |
|------|------|
| Trigger | `/instruction brand-assets [module]` — manual or explicit user request |
| Tool | **GenerateImage** (Cursor) — not Playwright, not Grok |
| Agent | **Technical Writer** — skill `.cursor/skills/tw-brand-assets/SKILL.md` |
| Parent | Tech Lead delegates TW; **no** GenerateImage in parent thread |
| Reference | Nova Poshta `OCMax/Nova poshta API/images/logo.png` + `favicon.ico` (layout only) |
| Output | `OCMax/{Product}/images/`, `images_en/`, `images_ru/` — each: `logo.png` 500×500, `favicon.ico` 48×48 |
| Spec | `docs/{module}/images/BRAND-ASSETS.md` |
| Git | Spec markdown only — PNG/ICO stay in OCMax |

## Instruction gate (soft)

Before `/release build`, Technical Writer should verify:

| Check | Action if fail |
|-------|----------------|
| Latest changelog block consistent across uk / en / ru | **Warn** |
| Navbar and update-block version match latest changelog | **Warn** |
| Instruction version vs controller `protected $version` | **Info only** — mismatch is OK until release; **warn** if releasing and user expects them aligned |
| New features/fixes from release described in changelog | **Warn** if missing |
| Admin UI / settings steps still accurate | **Warn** if implement touched UI |
| `build-instruction.ps1` succeeds | **Warn** with script error |

Soft gate: **does not block** release; Tech Lead surfaces warnings to user.

## Adding instruction to a new module

1. Create `docs/{module}/instruction/` with three `content.*.html` fragments + `runtime.js` (copy from ukrposhta as template)
2. Add `docs/{module}/instruction/README.md` (module-specific URLs, image paths)
3. Set `version.controller` in `package/modules/{module}/manifest.json` (release only)
4. Run `build-instruction.ps1 -Module {module}`
5. Document module functionality — see **Documenting functionality for a new module** below
6. Add `docs/{module}/images/SCREENSHOTS.md` and capture screenshots when admin UI is stable

## Documenting functionality for a new module

Technical Writer task after the skeleton exists. Invoke via **`/instruction update [module]`** with implement notes, or delegate TW after route A/B when admin UI is ready.

**Reference template:** `@docs/ukrposhta/instruction/` — copy section structure and markup patterns; replace carrier-specific text. Keep the **same section ids and accordion ids** across uk / en / ru.

### Inputs (read before writing)

| Source | Owner | Use for |
|--------|-------|---------|
| `docs/{module}/structure.md` | full-stack-developer | Tabs, features, config keys, workflows — **audit only**; do not invent fields |
| Implement report / planner output | Tech Lead → TW | What is new or changed in this release |
| Admin UI (sandbox) | TW verifies | Tab names, field labels, menu paths, save dropdown actions |
| `admin/language/*/extension/shipping/{module}.php` | reference | Exact customer-facing labels in each language |
| Legacy instruction HTML | optional | Content to port when migrating an existing module |

TW **does not** derive documentation from PHP logic alone. If `structure.md` or implement notes are missing, **ask** before describing settings.

### Standard section map

| Section id | Navbar group | Purpose |
|------------|--------------|---------|
| `#opportunities` | Опис | Customer benefits; short feature list; **detailed admin capabilities** in accordion |
| `#languages`, `#compatibility`, `#license`, `#requirements` | Опис | Module metadata (adapt per module) |
| `#installation` | Інструкція | First-time install + license + minimum config to go live |
| `#setting` | Інструкція | Checkout requirements, OCMOD list, compatibility with themes/checkout modules |
| `#update`, `#remove` | Інструкція | Version upgrade paths; uninstall |
| `#faq` | Підтримка | Troubleshooting, license, API keys, common errors |
| `#changelog` | Підтримка | Release bullets (uk/en/ru) |
| `#contacts` | Підтримка | Support links |

Jumbotron + demo buttons: adapt URLs to the new module admin routes and public demo site.

### Where to describe settings

Do **not** dump every form field into `#setting`. Split by audience:

| Content | Target section | Style |
|---------|----------------|-------|
| Marketing / why buy | `#opportunities` intro + bullet list | Short, customer-facing |
| Every admin tab and option group | `#opportunities` accordion (e.g. `opportunities-admin-accordion`) | Nested `<ul>`; group by **tab → field group → fields** |
| Order / CN / cron workflows | `#opportunities` second accordion or extra `<h6>` blocks | Task-oriented prose + bullets |
| Checkout address fields, OCMOD names | `#setting` | Cards with `<code>modification_id</code>`; step lists for third-party checkout setup |
| First-time wizard (license, API keys, import base settings) | `#installation` numbered `<ol>` | Step-by-step with alerts |
| “Why doesn’t X work?” | `#faq` accordion items | Question = link text; answer = short fix |

Match ukrposhta depth in the admin accordion: one bullet per meaningful option (toggle, select, template field), not one bullet per tab only.

### Tab-by-tab workflow (admin settings)

1. **Inventory tabs** — open `extension/shipping/{module}` in sandbox; list top-level tabs in display order (match admin Twig / `structure.md`).
2. **Map each tab** — for every tab, note: purpose (one sentence), field groups, dependencies (e.g. “visible when API calc enabled”).
3. **Draft uk first** — write `#opportunities` accordion bullets using **exact labels** from admin language files.
4. **Mirror en / ru** — same structure and anchors; translate labels consistently with `admin/language/en-gb/…` and `admin/language/ru-ru/…`.
5. **Installation steps** — only the minimum path to a working shop (license → credentials → base settings → save); link to `#setting` for OCMOD detail.
6. **FAQ** — add entries for license, credentials, empty quotes, cron, database sync, and top support questions from implement notes.
7. **Screenshots** — one shot per major tab or workflow screen; see below.

### Screenshots for a new module

1. Create `docs/{module}/images/SCREENSHOTS.md` (copy ukrposhta format: shot table, navigation, UI state, DOM-only rules).
2. List shots in **admin visit order** (settings tabs first, then order/CN flows if applicable).
3. Run `/instruction screenshots [module] [targets]` when UI is final (manual only).
4. Reference hosted or relative `images/screenshot_N.png` in `content.*.html` when embedding (PNGs live in OCMax product `images/`).
5. Document DOM-only mocks in `SCREENSHOTS.md` when a shot needs success UI without mutating data.

### TW command sequence (new module)

```
1. Scaffold dirs + copy ukrposhta template
2. /instruction update {module}  ← implement notes + structure.md audit
3. SCREENSHOTS.md + /instruction screenshots {module} …
4. Wire <img> paths in content.*.html
5. /instruction changelog {module}  ← first public version
6. /instruction gate {module}
7. /instruction build {module}
```

Before `/release build`: `/instruction sync` if instruction version should match controller for that release.

### New-module gate checklist (extends soft gate)

| Check | Action if fail |
|-------|----------------|
| uk / en / ru share same section ids and accordion structure | **Warn** |
| `#opportunities` accordion lists all admin tabs from `structure.md` | **Warn** |
| `#installation` matches real install + license flow | **Warn** |
| `#setting` lists only this module’s OCMODs (no ukrposhta leftovers) | **Warn** |
| FAQ covers license, credentials, and top 3 support topics | **Warn** |
| Screenshots referenced in HTML exist under `images/` | **Warn** |
| Demo / admin links in jumbotron point to `{module}` routes | **Warn** |
| No carrier-specific ukrposhta text left in copy-pasted template | **Warn** |

### Do not

- Invent API fields, config keys, or tabs not present in `structure.md` or admin UI
- Edit PHP, Twig, or OCMOD to “fix” instruction
- Put release changelog only in navbar without `#changelog` blocks
- Skip en / ru when adding a new uk section

## Related

- `@docs/agents/README.md` — doc-driven agent pattern
- `@docs/listing/workflow.md` — opencartforum / opencartcode listings
- `@docs/ukrposhta/instruction/README.md` — Ukrposhta-specific notes
- `@docs/ukrposhta/release-build.md` — instruction in OCMax layout
