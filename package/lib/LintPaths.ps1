# Resolve PHP lint paths for OC Max extension modules (admin/catalog/helper + package tooling).

function Get-OcmaxLintPaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,
        [string]$Module = ''
    )

    $paths = @(
        (Join-Path $RepoRoot 'package\lib'),
        (Join-Path $RepoRoot 'package\qa\lib')
    )

    if ($Module) {
        $m = $Module.ToLower()
        $modulePaths = @(
            "admin\controller\extension\shipping\$m.php",
            "admin\model\extension\shipping\$m.php",
            "admin\view\template\extension\shipping\$m.twig",
            "catalog\controller\extension\module\${m}_cron.php",
            "catalog\model\extension\shipping\$m.php",
            "system\helper\$m.php"
        )
        foreach ($rel in $modulePaths) {
            $full = Join-Path $RepoRoot $rel
            if (Test-Path $full) {
                $paths += $full
            }
        }
        $langDirs = @(
            "admin\language\en-gb\extension\shipping",
            "admin\language\uk-ua\extension\shipping",
            "catalog\language\en-gb\extension\shipping",
            "catalog\language\uk-ua\extension\shipping"
        )
        foreach ($dir in $langDirs) {
            $file = Join-Path $RepoRoot (Join-Path $dir "$m.php")
            if (Test-Path $file) {
                $paths += $file
            }
        }
    } else {
        $globRoots = @(
            'admin\controller\extension\shipping',
            'admin\model\extension\shipping',
            'catalog\model\extension\shipping',
            'catalog\controller\extension\module',
            'system\helper'
        )
        foreach ($root in $globRoots) {
            $full = Join-Path $RepoRoot $root
            if (Test-Path $full) {
                $paths += (Get-ChildItem -Path $full -Recurse -Include *.php -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
            }
        }
        $paths = $paths | Select-Object -Unique
    }

    return $paths | Where-Object { $_ -and (Test-Path $_) }
}
