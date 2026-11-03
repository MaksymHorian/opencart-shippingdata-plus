# shippingdata-plus instruction — multilingual single HTML

Source fragments for `instruction.html` (UA / EN / RU in one file).

**Shared workflow:** `@docs/instruction/workflow.md`  
**Agent:** `/instruction` → Technical Writer (route K)

Instruction version (navbar, changelog) is **separate** from any future `protected $version` in the admin controller. TW edits fragments only.

## Layout

```
instruction/
├── content.uk.html
├── content.en.html
├── content.ru.html
└── runtime.js
```

Screenshots spec: `../images/SCREENSHOTS.md` — PNG output → `OCMax\Shipping Data Plus\images\`.

## Build

```powershell
.\package\scripts\build-instruction.ps1 -Module shippingdata-plus
```

Output: `docs/shippingdata-plus/instruction.html`

## Public URLs

```
instruction.html
instruction.html?lang=uk
instruction.html?lang=en
instruction.html?lang=ru
```
