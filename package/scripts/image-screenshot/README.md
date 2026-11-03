# Image screenshot (Playwright)

Local Node tool for `/instruction screenshots`. Opens **real Chromium** maximized — not Cursor browser MCP.

## First run (slow, once)

1. `npm install` in this folder (`node_modules/`)
2. `npx playwright install chromium` — browser binaries to `%LOCALAPPDATA%\ms-playwright\` (~300 MB)

Marker file `.deps-installed` skips step 2 on this machine after success.

## Next runs (fast)

Only `node capture.mjs` — Chromium already on disk. Typical: few seconds per shot + browser open time.

## Manual

```powershell
cd c:\OpenServer\home\oc3
.\package\scripts\capture-image-screenshots.ps1 -Module ukrposhta -Targets 1
.\package\scripts\capture-image-screenshots.ps1 -Module ukrposhta -Targets all
```

Spec: `docs/ukrposhta/images/SCREENSHOTS.md`  
Output: `OCMax\Ukrposhta API\images\` (from module manifest)
