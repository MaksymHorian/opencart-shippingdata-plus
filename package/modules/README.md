# Module release manifests (Variant A)

One folder per OC Max module. Each module owns a `manifest.json`; scripts in `package/scripts/` are shared.

| Module | Manifest | REPO | OCMax product |
|--------|----------|------|---------------|
| ukrposhta | `ukrposhta/manifest.json` | `REPO/opencart-ukrposhta` | `OCMax/Ukrposhta API` |
| rozetka_delivery | `rozetka_delivery/manifest.json` | `REPO/opencart-rozetka-delivery` | `OCMax/ROZETKA Delivery` |

## Add a new module

1. Copy `_template/manifest.json` → `{module}/manifest.json`
2. Set `paths.repoName`, `paths.ocMaxProduct`, `paths.docsRelative`
3. Define `propagate.php` and `build.upload` file lists; set `sharedLayers.oc15AdminAssets: true` when the module ships OC 1.5 admin UI
4. Set `sharedLayers` (`shippingdata` only for delivery modules)
5. Register in Release Engineer docs / default `-Module` when working in that module's sandbox

Payment or other modules **do not** include `shippingdata` in manifest unless they patch checkout the same way.
