# Per-target .tpl post-convert adaptations for OC Max propagate workflow.

function Get-TplAdaptationSnippetPath {
    param(
        $Manifest,
        [string]$SnippetKey
    )
    $packageRoot = Get-ReleasePackageRoot
    $relative = $Manifest.propagate.tplAdaptations.snippets.$SnippetKey
    if (-not $relative) {
        $relative = "modules\$($Manifest.module)\tpl-snippets\$SnippetKey.tpl"
    }
    return Join-Path $packageRoot $relative
}

function Read-TplSnippetSections {
    param([string]$SnippetPath)

    if (-not (Test-Path $SnippetPath)) {
        throw "Tpl snippet not found: $SnippetPath"
    }
    $raw = Get-Content $SnippetPath -Raw -Encoding UTF8
    $html = $raw
    $js = $null

    if ($raw -match '(?s)<!--\s*OC15_IMAGE_HTML\s*-->(.*?)(?:<!--\s*OC15_IMAGE_JS\s*-->(.*))?$') {
        $html = $Matches[1].Trim()
        if ($Matches[2]) {
            $js = $Matches[2].Trim()
        }
    }

    return [PSCustomObject]@{
        Html = $html
        Js   = $js
    }
}

function Apply-Oc15StripColumnLeft {
    param([string]$Content)

    return $Content.Replace('<?php echo $column_left; ?>', '')
}

function Apply-Oc15PaginationAdaptation {
    param([string]$Content)

    $pattern = '(?s)<div class="row">\s*<div class="col-sm-6 text-left">\s*<\?php echo \$pagination; \?>\s*</div>\s*<div class="col-sm-6 text-right">\s*<\?php echo \$results; \?>\s*</div>\s*</div>'
    $replacement = @'
<div class="row">
					<div class="col-sm-12 text-right"><?php echo $pagination; ?></div>
				</div>
'@

    if ($Content -match $pattern) {
        return [regex]::Replace($Content, $pattern, $replacement, 1)
    }

    return $Content
}

function Apply-Oc15ImagePickerAdaptation {
    param(
        [string]$Content,
        $Manifest
    )

    $snippetKey = 'oc15-image-picker'
    if ($Manifest.propagate.tplAdaptations.oc15.imagePickerSnippet) {
        $snippetKey = $Manifest.propagate.tplAdaptations.oc15.imagePickerSnippet
    }

    $out = $Content

    $pattern = '(?s)(<div\s+class="col-sm-4">\s*<a\s+[^>]*data-toggle="image"[^>]*>.*?</a>\s*<input\b[\s\S]*?id="input-image"[\s\S]*?/>\s*</div>)'
    $needsImagePicker = $out -match $pattern
    $needsImageJs = $out -notmatch 'function\s+image_upload\s*\('

    if (-not $needsImagePicker -and -not $needsImageJs) {
        return $out
    }

    $snippetPath = Get-TplAdaptationSnippetPath -Manifest $Manifest -SnippetKey $snippetKey
    $snippet = Read-TplSnippetSections -SnippetPath $snippetPath

    if ($needsImagePicker) {
        $out = [regex]::Replace($out, $pattern, {
            param($m)
            return $snippet.Html
        }, 1)
    }

    if ($snippet.Js -and $out -notmatch 'function\s+image_upload\s*\(') {
        if ($out -match '(<script\s+type="text/javascript"><!--)') {
            $out = [regex]::Replace($out, '(<script\s+type="text/javascript"><!--)', {
                param($m)
                return $m.Groups[1].Value + "`r`n`t" + ($snippet.Js -replace "`r?`n", "`r`n`t") + "`r`n`t"
            }, 1)
        }
        else {
            $out += "`r`n<script type=`"text/javascript`"><!--`r`n" + $snippet.Js + "`r`n//--></script>`r`n"
        }
    }

    return $out
}

function Apply-TplTargetAdaptations {
    param(
        [string]$Content,
        [string]$Target,
        $Manifest
    )

    $out = $Content
    $rules = $Manifest.propagate.tplAdaptations

    $containerTargets = @('oc23', 'oc21', 'oc15')
    if ($rules.containerFluidEq.from -and $rules.containerFluidEq.to) {
        if ($Target -in @($rules.containerFluidEq.targets)) {
            $out = $out.Replace($rules.containerFluidEq.from, $rules.containerFluidEq.to)
        }
    }
    elseif ($Target -in $containerTargets) {
        $out = $out.Replace('.container-fluid:eq(2)', '.container-fluid:eq(1)')
    }

    $stripTypeTargets = @('oc21', 'oc15')
    $saveExitFrom = 'route=extension/shipping&token=<?php echo $token; ?>&type=shipping'
    $saveExitTo = 'route=extension/shipping&token=<?php echo $token; ?>'
    if ($rules.saveExitRedirect.stripTypeShipping -contains $Target) {
        $out = $out.Replace($saveExitFrom, $saveExitTo)
    }
    elseif ($Target -in $stripTypeTargets) {
        $out = $out.Replace($saveExitFrom, $saveExitTo)
    }

    if ($Target -in @('oc23', 'oc21', 'oc15')) {
        $out = Apply-OcLegacySessionTokenAdaptation -Content $out
    }

    if ($Target -eq 'oc15') {
        $out = Apply-Oc15StripColumnLeft -Content $out
        $out = Apply-Oc15PaginationAdaptation -Content $out
        $out = Apply-Oc15ImagePickerAdaptation -Content $out -Manifest $Manifest
    }

    return $out
}

# OC 2.x / 1.5 session query param is `token`, not OC3 `user_token`.
# Manifest tplReplacements already rewrite the echo form:
#   &user_token=<?php echo $user_token; ?>  →  &token=<?php echo $token; ?>
# Twig `{% set url = '...&user_token=' ~ user_token %}` converts to PHP concat
# (`'...&user_token=' . $user_token`) and misses that pair.
# Do not rewrite JS `+ '&user_token=' + user_token` (Ukrposhta API credential).
function Apply-OcLegacySessionTokenAdaptation {
    param([string]$Content)

    $out = $Content
    $out = $out.Replace('&user_token=<?php echo $user_token; ?>', '&token=<?php echo $token; ?>')
    $out = $out.Replace("&user_token=' . `$user_token", "&token=' . `$token")
    $out = $out.Replace('&user_token=" . $user_token', '&token=" . $token')
    # $$token → literal $token in .NET regex replacement (not a group).
    $out = [regex]::Replace($out, '\$user_token\b', '$$token')
    return $out
}
