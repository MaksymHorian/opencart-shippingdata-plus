# Twig to OpenCart .tpl converter for OC Max propagate workflow.

function Test-TwigTernaryBranchNeedsParens {
    param([string]$TwigBranch)

    $t = $TwigBranch.Trim()
    if ($t -match "^'[^']*'$") { return $false }
    if ($t -match '^\d+$') { return $false }
    return $true
}

function Format-TwigTernaryBranchPhp {
    param([string]$TwigBranch)

    $php = Convert-TwigExprToPhp $TwigBranch.Trim()
    if (Test-TwigTernaryBranchNeedsParens -TwigBranch $TwigBranch) {
        return '(' + $php + ')'
    }
    return $php
}

function Protect-PhpBracketReadsInExpr {
    param([string]$PhpExpr)

    # Wrap $arr['key'] reads so legacy PHP does not notice on missing indexes (Twig is silent).
    $pattern = '\$[a-zA-Z_][a-zA-Z0-9_]*(?:\[[^\]]+\])+'
    $sb = [System.Text.StringBuilder]::new()
    $pos = 0
    foreach ($m in [regex]::Matches($PhpExpr, $pattern)) {
        $before = $PhpExpr.Substring(0, $m.Index)
        if ($before -match '(isset|empty)\s*\(\s*$') {
            [void]$sb.Append($PhpExpr.Substring($pos, $m.Index + $m.Length - $pos))
            $pos = $m.Index + $m.Length
            continue
        }
        [void]$sb.Append($PhpExpr.Substring($pos, $m.Index - $pos))
        $access = $m.Value
        [void]$sb.Append("(isset($access) ? $access : null)")
        $pos = $m.Index + $m.Length
    }
    [void]$sb.Append($PhpExpr.Substring($pos))
    return $sb.ToString()
}

function Format-TwigTernaryCondPhp {
    param(
        [string]$TwigCond,
        [string]$PhpCond
    )

    if ($TwigCond -match '(==|!=|>=|<=|<>|\band\b|\bor\b|\snot in\s|\sin\s|\sis not\s|\sis\s|\?|\|)') {
        return $PhpCond
    }
    return '(' + $PhpCond + ')'
}

function Format-TwigTernaryPhp {
    param(
        [string]$Cond,
        [string]$IfTrue,
        [string]$IfFalse
    )

    $phpCondRaw = Convert-TwigExprToPhp $Cond
    # Comparisons with $arr['key'] — protect reads (selected/active/checked attributes)
    if ($Cond -match '(==|!=|>=|<=|<>)') {
        $phpCondRaw = Protect-PhpBracketReadsInExpr $phpCondRaw
    }
    $phpCond = Format-TwigTernaryCondPhp -TwigCond $Cond -PhpCond $phpCondRaw
    $phpTrue = Format-TwigTernaryBranchPhp -TwigBranch $IfTrue
    $phpFalse = Format-TwigTernaryBranchPhp -TwigBranch $IfFalse
    return $phpCond + ' ? ' + $phpTrue + ' : ' + $phpFalse
}

function Split-TwigTernaryExpr {
    param([string]$Expr)

    $s = $Expr
    $len = $s.Length
    if ($len -le 0) { return $null }

    $inQuote = $false
    $depth = 0
    $qPos = -1
    for ($i = 0; $i -lt $len; $i++) {
        $ch = $s[$i]
        if ($ch -eq "'") { $inQuote = -not $inQuote; continue }
        if ($inQuote) { continue }
        if ($ch -eq '(') { $depth++; continue }
        if ($ch -eq ')') { if ($depth -gt 0) { $depth-- }; continue }
        if ($depth -eq 0 -and $ch -eq '?') { $qPos = $i; break }
    }
    if ($qPos -lt 0) { return $null }

    $inQuote = $false
    $depth = 0
    $cPos = -1
    for ($i = $qPos + 1; $i -lt $len; $i++) {
        $ch = $s[$i]
        if ($ch -eq "'") { $inQuote = -not $inQuote; continue }
        if ($inQuote) { continue }
        if ($ch -eq '(') { $depth++; continue }
        if ($ch -eq ')') { if ($depth -gt 0) { $depth-- }; continue }
        if ($depth -eq 0 -and $ch -eq ':') { $cPos = $i; break }
    }
    if ($cPos -lt 0) {
        $cond = $s.Substring(0, $qPos).Trim()
        $ifTrue = $s.Substring($qPos + 1).Trim()
        if (-not $cond -or -not $ifTrue) { return $null }
        return @{
            Cond           = $cond
            IfTrue         = $ifTrue
            IfFalse        = "''"
            ImplicitFalse  = $true
        }
    }

    $cond = $s.Substring(0, $qPos).Trim()
    $ifTrue = $s.Substring($qPos + 1, $cPos - $qPos - 1).Trim()
    $ifFalse = $s.Substring($cPos + 1).Trim()
    if (-not $cond -or -not $ifTrue) { return $null }
    if (-not $ifFalse) { $ifFalse = "''" }

    return @{
        Cond           = $cond
        IfTrue         = $ifTrue
        IfFalse        = $ifFalse
        ImplicitFalse  = $false
    }
}

function Convert-TwigTernaryToPhp {
    param([string]$Expr)

    $split = Split-TwigTernaryExpr -Expr $Expr
    if (-not $split) { return $null }

    $sameDefault = Convert-TwigSameExprDefaultTernaryToPhp -Cond $split.Cond -IfTrue $split.IfTrue -IfFalse $split.IfFalse
    if ($sameDefault) { return $sameDefault }

    $existence = Convert-TwigExistenceTernaryToPhp -Cond $split.Cond -IfTrue $split.IfTrue -IfFalse $split.IfFalse
    if ($existence) { return $existence }

    return Format-TwigTernaryPhp -Cond $split.Cond -IfTrue $split.IfTrue -IfFalse $split.IfFalse
}

function Convert-TwigSameExprDefaultTernaryToPhp {
    param(
        [string]$Cond,
        [string]$IfTrue,
        [string]$IfFalse
    )

    # Twig: {{ arr['key'] ? arr['key'] : 0 }} / {{ map[dyn] ? map[dyn] }}
    # PHP truthiness on missing index notices; !empty() does not.
    if ($Cond.Trim() -ne $IfTrue.Trim()) { return $null }

    $php = Convert-TwigExprToPhp $Cond
    if ($php -notmatch '\[') { return $null }

    $phpFalse = Convert-TwigExprToPhp $IfFalse
    return '(!empty(' + $php + ') ? ' + $php + ' : ' + $phpFalse + ')'
}

function Convert-TwigExistenceTernaryToPhp {
    param(
        [string]$Cond,
        [string]$IfTrue,
        [string]$IfFalse
    )

    if ($IfTrue -notmatch '^(.+)\[\s*''([^'']+)''\s*\]\s*$') { return $null }
    if ($Matches[1].Trim() -ne $Cond.Trim()) { return $null }

    $phpCond = Convert-TwigExprToPhp $Cond
    $phpTrue = Convert-TwigExprToPhp $IfTrue
    $phpFalse = Convert-TwigExprToPhp $IfFalse

    if ($Cond -match '^(\w+)\[(\w+)\]$' -and $Matches[2] -notmatch '^\d+$') {
        $idxPhp = Convert-TwigExprToPhp $Matches[2]
        if ($phpFalse -eq "''") {
            return '(isset(' + $idxPhp + ', ' + $phpCond + ', ' + $phpTrue + ')) ? ' + $phpTrue + ' : ' + $phpFalse
        }
        return '(isset(' + $idxPhp + ', ' + $phpCond + ')) ? ' + $phpTrue + ' : ' + $phpFalse
    }

    if ($phpFalse -eq "''") {
        return '(isset(' + $phpCond + ', ' + $phpTrue + ')) ? ' + $phpTrue + ' : ' + $phpFalse
    }
    return '(isset(' + $phpCond + ')) ? ' + $phpTrue + ' : ' + $phpFalse
}

function Find-TwigInOperatorAtDepthZero {
    param(
        [string]$Expr,
        [string]$Operator
    )

    $s = $Expr
    $len = $s.Length
    if ($len -le 0) { return $null }

    $opLen = $Operator.Length
    $inQuote = $false
    $depth = 0

    for ($i = 0; $i -lt $len; $i++) {
        $ch = $s[$i]
        if ($ch -eq "'") { $inQuote = -not $inQuote; continue }
        if ($inQuote) { continue }
        if ($ch -eq '(') { $depth++; continue }
        if ($ch -eq ')') { if ($depth -gt 0) { $depth-- }; continue }
        if ($depth -ne 0) { continue }

        if ($i + $opLen -gt $len) { continue }
        if ($s.Substring($i, $opLen) -ne $Operator) { continue }

        $beforeOk = ($i -eq 0) -or ($s[$i - 1] -match '\s')
        if (-not $beforeOk) { continue }

        if ($Operator -eq 'in') {
            $before = $s.Substring(0, $i).TrimEnd()
            if ($before.EndsWith('not')) { continue }
        }

        $afterIdx = $i + $opLen
        if ($afterIdx -ge $len) { continue }
        if ($s[$afterIdx] -notmatch '\s') { continue }

        $left = $s.Substring(0, $i).Trim()
        $rightStart = $afterIdx
        while ($rightStart -lt $len -and ($s[$rightStart] -match '\s')) { $rightStart++ }
        $right = $s.Substring($rightStart).Trim()

        if (-not $left -or -not $right) { continue }

        return @{
            Left       = $left
            Right      = $right
            LeftStart  = 0
            RightStart = $rightStart
        }
    }

    return $null
}

function Convert-TwigInArrayHaystackToPhp {
    param([string]$HaystackExpr)

    if ($HaystackExpr.Trim() -match '^[a-zA-Z_]\w*$') {
        return Convert-TwigExprToPhp $HaystackExpr.Trim()
    }
    return Convert-TwigSafeArrayExprToPhp $HaystackExpr
}

function Convert-TwigSafeArrayExprToPhp {
    param([string]$Expr)

    $php = Convert-TwigExprToPhp $Expr
    return '((isset(' + $php + ') && is_array(' + $php + ')) ? ' + $php + ' : array())'
}

function Convert-TwigNotInOperatorToPhp {
    param([string]$Expr)

    $match = Find-TwigInOperatorAtDepthZero -Expr $Expr -Operator 'not in'
    if (-not $match) { return $null }

    return '!in_array(' + (Convert-TwigExprToPhp $match.Left) + ', ' + (Convert-TwigInArrayHaystackToPhp $match.Right) + ')'
}

function Convert-TwigInOperatorToPhp {
    param([string]$Expr)

    $match = Find-TwigInOperatorAtDepthZero -Expr $Expr -Operator 'in'
    if (-not $match) { return $null }

    return 'in_array(' + (Convert-TwigExprToPhp $match.Left) + ', ' + (Convert-TwigInArrayHaystackToPhp $match.Right) + ')'
}

function Split-TwigExprByTilde {
    param([string]$Expr)

    $parts = [System.Collections.Generic.List[string]]::new()
    $inQuote = $false
    $depth = 0
    $start = 0
    $len = $Expr.Length

    for ($i = 0; $i -lt $len; $i++) {
        $ch = $Expr[$i]
        if ($ch -eq "'") { $inQuote = -not $inQuote; continue }
        if ($inQuote) { continue }
        if ($ch -eq '(') { $depth++; continue }
        if ($ch -eq ')') { if ($depth -gt 0) { $depth-- }; continue }
        if ($depth -eq 0 -and $ch -eq '~') {
            $parts.Add($Expr.Substring($start, $i - $start))
            $start = $i + 1
        }
    }
    if ($start -lt $len) {
        $parts.Add($Expr.Substring($start))
    }
    if ($parts.Count -le 1) { return $null }
    return $parts
}

function Test-TwigConcatPartNeedsParens {
    param([string]$TwigPart)

    $t = $TwigPart.Trim()
    if (-not $t) { return $false }
    if ($t -match "^'[^'\\]*(?:\\.[^'\\]*)*'$") { return $false }
    if ($t -match '^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$') { return $false }
    if ($t -match '^[a-zA-Z_]\w*(\[''[^'']*''\])+$') { return $false }
    return $true
}

function Format-TwigConcatPartPhp {
    param([string]$TwigPart)

    $php = Convert-TwigExprToPhp $TwigPart.Trim()
    if (Test-TwigConcatPartNeedsParens -TwigPart $TwigPart) {
        return '(' + $php + ')'
    }
    return $php
}

function Convert-TwigConcatToPhp {
    param([string]$Expr)

    $parts = Split-TwigExprByTilde $Expr
    if (-not $parts) { return $null }

    $converted = [System.Collections.Generic.List[string]]::new()
    foreach ($part in $parts) {
        $trimmed = $part.Trim()
        if (-not $trimmed) { continue }
        $converted.Add((Format-TwigConcatPartPhp $trimmed))
    }
    if ($converted.Count -le 1) { return $null }
    return ($converted -join ' . ')
}

function Convert-TwigIsTestToPhp {
    param([string]$Expr)

    $e = $Expr.Trim()
    if (-not $e) { return $null }

    if ($e -match '^(.*?)\s+is\s+iterable$') {
        $left = $Matches[1].Trim()
        if (-not $left) { return $null }
        return 'is_array(' + (Convert-TwigExprToPhp $left) + ')'
    }
    if ($e -match '^(.*?)\s+is\s+not\s+iterable$') {
        $left = $Matches[1].Trim()
        if (-not $left) { return $null }
        return '!is_array(' + (Convert-TwigExprToPhp $left) + ')'
    }

    return $null
}

function Convert-TwigDottedIdentifiersToPhp {
    param([string]$Expr)

    return [regex]::Replace($Expr, '(?<![\w$])([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)(?![\w''])', {
        param($m)
        $segments = $m.Groups[1].Value.Split('.')
        $result = '$' + $segments[0]
        for ($i = 1; $i -lt $segments.Count; $i++) {
            $result += "['$($segments[$i])']"
        }
        return $result
    })
}

function Convert-TwigLoopReferencesInText {
    param(
        [string]$Text,
        [int]$CurrentDepth,
        [string]$KeyVar = $null
    )

    $indexExpr = if ($KeyVar) { "`$$KeyVar" } else { "`$__loop$CurrentDepth" }

    $out = $Text

    $out = [regex]::Replace($out, 'loop(?:\.parent)+\.loop\.index0(\s*\+\s*(\d+))?', {
        param($m)
        $parentCount = ([regex]::Matches($m.Value, '\.parent')).Count
        $depth = [Math]::Max(0, $CurrentDepth - $parentCount)
        $idx = if ($KeyVar -and $depth -eq $CurrentDepth) { "`$$KeyVar" } else { "`$__loop$depth" }
        $suffix = if ($m.Groups[1].Success) { $m.Groups[1].Value } else { '' }
        "$idx$suffix"
    })

    $out = [regex]::Replace($out, 'loop(?:\.parent)+\.loop\.index(?!0)(\s*\+\s*(\d+))?', {
        param($m)
        $parentCount = ([regex]::Matches($m.Value, '\.parent')).Count
        $depth = [Math]::Max(0, $CurrentDepth - $parentCount)
        $idx = if ($KeyVar -and $depth -eq $CurrentDepth) { "`$$KeyVar" } else { "`$__loop$depth" }
        $suffix = if ($m.Groups[1].Success) { " $($m.Groups[1].Value)" } else { '' }
        "($idx + 1$suffix)"
    })

    $out = [regex]::Replace($out, '(?<![\w$])loop\.index0(\s*\+\s*(\d+))?', {
        param($m)
        $suffix = if ($m.Groups[1].Success) { $m.Groups[1].Value } else { '' }
        "$indexExpr$suffix"
    })

    $out = [regex]::Replace($out, '(?<![\w$])loop\.index(?!0)(\s*\+\s*(\d+))?', {
        param($m)
        $suffix = if ($m.Groups[1].Success) { " $($m.Groups[1].Value)" } else { '' }
        "($indexExpr + 1$suffix)"
    })

    return $out
}

function Test-TwigForBodyUsesLoopIndex {
    param([string]$Body)

    return $Body -match '\[\s*loop(?:\.parent)*\.index0\s*\]' -or
           $Body -match '\[\{\{\s*loop(?:\.parent)*\.index0\s*\}\]' -or
           $Body -match '(?<![\w$])loop(?:\.parent)*\.index0\s*\+'
}

function Test-TwigForBodyUsesLoopCounter {
    param([string]$Body)

    return $Body -match 'loop(?:\.parent)*\.index0\b' -or
           $Body -match 'loop(?:\.parent)*\.index(?!0)\b'
}

function Find-TwigEndfor {
    param(
        [string]$Content,
        [int]$Start
    )

    $depth = 1
    $pos = $Start
    $len = $Content.Length

    while ($pos -lt $len) {
        $remainder = $Content.Substring($pos)
        if ($remainder -match '^\{%\s*for\s+') {
            $depth++
            $pos += $Matches[0].Length
            continue
        }
        if ($remainder -match '^\{%\s*endfor\s*%\}') {
            $depth--
            if ($depth -eq 0) {
                return $pos
            }
            $pos += $Matches[0].Length
            continue
        }
        $pos++
    }

    throw 'Unmatched {% for %} — missing {% endfor %}'
}

function Split-TwigForBodyAtElse {
    param([string]$Body)

    $forDepth = 0
    $ifDepth = 0
    $pos = 0
    $len = $Body.Length

    while ($pos -lt $len) {
        $remainder = $Body.Substring($pos)

        if ($remainder -match '^\{%\s*for\s+') {
            $forDepth++
            $pos += $Matches[0].Length
            continue
        }
        if ($remainder -match '^\{%\s*endfor\s*%\}') {
            $forDepth--
            $pos += $Matches[0].Length
            continue
        }
        if ($remainder -match '^\{%\s*if\s+') {
            $ifDepth++
            $pos += $Matches[0].Length
            continue
        }
        if ($remainder -match '^\{%\s*endif\s*%\}') {
            $ifDepth--
            $pos += $Matches[0].Length
            continue
        }
        if ($remainder -match '^\{%\s*elseif\s+') {
            $pos += $Matches[0].Length
            continue
        }
        if ($remainder -match '^\{%\s*else\s*%\}') {
            if ($forDepth -eq 0 -and $ifDepth -eq 0) {
                return @{
                    Main    = $Body.Substring(0, $pos)
                    Else    = $Body.Substring($pos + $Matches[0].Length)
                    HasElse = $true
                }
            }
            $pos += $Matches[0].Length
            continue
        }

        $pos++
    }

    return @{
        Main    = $Body
        Else    = ''
        HasElse = $false
    }
}

function Test-TwigRangeExpr {
    param([string]$Expr)

    return [bool]($Expr.Trim() -match '^-?\d+\s*\.\.\s*-?\d+$')
}

function Convert-TwigRangeToPhp {
    param([string]$Expr)

    $trim = $Expr.Trim()
    if ($trim -match '^(-?\d+)\s*\.\.\s*(-?\d+)$') {
        return "range($($Matches[1]), $($Matches[2]))"
    }
    return $null
}

function Test-TwigCollectionNeedsForeachGuard {
    param([string]$CollExpr)

    # Always guard: Twig {% for %} on undefined/null is a no-op; bare PHP foreach notices on legacy OC.
    if (-not $CollExpr.Trim()) { return $false }
    # Twig range 1..6 → PHP range(); never isset()/is_array() on literals
    if (Test-TwigRangeExpr $CollExpr) { return $false }
    return $true
}

function Convert-TwigForeachCollectionToPhp {
    param([string]$CollExpr)

    $trim = $CollExpr.Trim()
    if (Test-TwigRangeExpr $trim) {
        return Convert-TwigExprToPhp $trim
    }
    if ($trim -match '^[a-zA-Z_]\w*$') {
        return Convert-TwigExprToPhp $trim
    }
    return Convert-TwigSafeArrayExprToPhp $CollExpr
}

function Get-TwigForeachCollectionPhpExpr {
    param([string]$CollExpr)

    return Convert-TwigExprToPhp $CollExpr.Trim()
}

function Get-TwigForElseCollectionIfPhp {
    param(
        [string]$CollExpr,
        [bool]$NeedsGuard,
        [string]$CollPhpRaw,
        [string]$CollPhp
    )

    if ($NeedsGuard) {
        return "isset($collPhpRaw) && is_array($collPhpRaw) && $collPhpRaw"
    }
    return $CollPhp
}

function Convert-SingleTwigForBlock {
    param(
        [string]$Header,
        [string]$Body,
        [int]$Depth,
        [string]$ElseBody = $null
    )

    $counter = "__loop$Depth"
    $keyVar = "${counter}_k"
    $useKeyed = Test-TwigForBodyUsesLoopIndex -Body $Body
    $useCounter = Test-TwigForBodyUsesLoopCounter -Body $Body

    $header = $Header.Trim()
    $keyName = $null
    $valName = $null
    $collExpr = $null

    if ($header -match '^(\w+)\s*,\s*(\w+)\s+in\s+(.+)$') {
        $keyName = $Matches[1]
        $valName = $Matches[2]
        $collExpr = $Matches[3].Trim()
    }
    elseif ($header -match '^(\w+)\s+in\s+(.+)$') {
        $valName = $Matches[1]
        $collExpr = $Matches[2].Trim()
    }
    else {
        throw "Unsupported for-loop header: $Header"
    }

    $bodyWithLoop = Convert-TwigLoopReferencesInText -Text $Body -CurrentDepth $Depth -KeyVar $(if ($useKeyed) { $keyVar } else { $null })
    $needsGuard = Test-TwigCollectionNeedsForeachGuard -CollExpr $collExpr
    $collPhpRaw = Get-TwigForeachCollectionPhpExpr -CollExpr $collExpr
    $collPhp = if ($needsGuard) { $collPhpRaw } else { Convert-TwigForeachCollectionToPhp $collExpr }

    $sb = [System.Text.StringBuilder]::new()
    if ($ElseBody) {
        $ifCond = Get-TwigForElseCollectionIfPhp -CollExpr $collExpr -NeedsGuard $needsGuard -CollPhpRaw $collPhpRaw -CollPhp $collPhp
        [void]$sb.Append("<?php if ($ifCond) { ?>")
    }
    elseif ($needsGuard) {
        [void]$sb.Append("<?php if (isset($collPhpRaw) && is_array($collPhpRaw)) { ?>")
    }
    if ($keyName) {
        [void]$sb.Append("<?php foreach ($collPhp as `$$keyName => `$$valName) { ?>")
    }
    elseif ($useKeyed) {
        [void]$sb.Append("<?php foreach ($collPhp as `$$keyVar => `$$valName) { ?>")
    }
    elseif ($useCounter) {
        [void]$sb.Append("<?php `$$counter = -1; ?>")
        [void]$sb.Append("<?php foreach ($collPhp as `$$valName) { `$$counter++; ?>")
    }
    else {
        [void]$sb.Append("<?php foreach ($collPhp as `$$valName) { ?>")
    }
    [void]$sb.Append($bodyWithLoop)
    [void]$sb.Append('<?php } ?>')
    if ($ElseBody) {
        [void]$sb.Append('<?php } else { ?>')
        [void]$sb.Append($ElseBody)
        [void]$sb.Append('<?php } ?>')
    }
    elseif ($needsGuard) {
        [void]$sb.Append('<?php } ?>')
    }
    return $sb.ToString()
}

function Convert-TwigForLoopsStructured {
    param(
        [string]$Content,
        [int]$Depth = 0
    )

    $result = [System.Text.StringBuilder]::new()
    $pos = 0
    $len = $Content.Length

    while ($pos -lt $len) {
        $nextTag = $Content.IndexOf('{%', $pos)
        if ($nextTag -lt 0) {
            [void]$result.Append($Content.Substring($pos))
            break
        }

        [void]$result.Append($Content.Substring($pos, $nextTag - $pos))
        $remainder = $Content.Substring($nextTag)

        if ($remainder -match '^\{%\s*for\s+(.+?)\s*%\}') {
            $header = $Matches[1]
            $tagLen = $Matches[0].Length
            $bodyStart = $nextTag + $tagLen
            $bodyEnd = Find-TwigEndfor -Content $Content -Start $bodyStart
            $endMatch = [regex]::Match($Content.Substring($bodyEnd), '^\{%\s*endfor\s*%\}')
            $rawBody = $Content.Substring($bodyStart, $bodyEnd - $bodyStart)
            $split = Split-TwigForBodyAtElse -Body $rawBody

            $innerMain = Convert-TwigForLoopsStructured -Content $split.Main -Depth ($Depth + 1)
            $innerElse = $null
            if ($split.HasElse) {
                $innerElse = Convert-TwigForLoopsStructured -Content $split.Else -Depth ($Depth + 1)
            }
            [void]$result.Append((Convert-SingleTwigForBlock -Header $header -Body $innerMain -Depth $Depth -ElseBody $innerElse))
            $pos = $bodyEnd + $endMatch.Length
        }
        else {
            [void]$result.Append('{%')
            $pos = $nextTag + 2
        }
    }

    return $result.ToString()
}

function Convert-TwigExprChunkToPhp {
    param([string]$Chunk)
    $e = $Chunk.Trim()
    if (-not $e) { return $e }

    if ($e -match '^(.*?)\s+is\s+iterable$') {
        $left = $Matches[1].Trim()
        if ($left) { return 'is_array(' + (Convert-TwigExprToPhp $left) + ')' }
    }
    if ($e -match '^(.*?)\s+is\s+not\s+iterable$') {
        $left = $Matches[1].Trim()
        if ($left) { return '!is_array(' + (Convert-TwigExprToPhp $left) + ')' }
    }

    if ($e -match '^not\s+(.+)$') {
        return '!(' + (Convert-TwigExprChunkToPhp $Matches[1].Trim()) + ')'
    }

    if ($e -match '^(\w+)\s*!=\s*true$') { return '!$' + $Matches[1] }
    if ($e -match '^(\w+)\s*==\s*false$') { return '!$' + $Matches[1] }

    if ($e -match '^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)$') {
        return (Convert-TwigDottedIdentifiersToPhp $e)
    }

    $e = Convert-TwigDottedIdentifiersToPhp $e

    $keywords = '^(true|false|null|in|is|iterable|not|and|or|loop)$'
    $e = [regex]::Replace($e, '(?<![\w$])([a-zA-Z_][a-zA-Z0-9_]*)(?![\w''])', {
        param($m)
        if ($m.Groups[1].Value -match $keywords) { return $m.Groups[1].Value }
        '$' + $m.Groups[1].Value
    })

    return (Convert-TwigLogicalOpsToPhp $e)
}

function Convert-TwigLogicalOpsToPhp {
    param([string]$Expr)
    $e = $Expr
    $e = [regex]::Replace($e, '\bnot\s+(\((?:[^()]|\([^()]*\))*\)|\$[a-zA-Z_][\w]*(?:\[[^\]]+\])*)', '!($1)')
    $e = [regex]::Replace($e, '\band\b', '&&')
    $e = [regex]::Replace($e, '\bor\b', '||')
    return $e
}

function Convert-TwigLengthFilterInExpr {
    param([string]$Expr)

    $out = $Expr
    $prev = ''
    while ($out -ne $prev) {
        $prev = $out
        $out = [regex]::Replace($out, '(\((?:[^()]|\([^()]*\))*\)|[a-zA-Z_][a-zA-Z0-9_.]*)\s*\|\s*length\b', {
            param($m)
            $inner = $m.Groups[1].Value.Trim()
            if ($inner.StartsWith('(') -and $inner.EndsWith(')')) {
                $inner = $inner.Substring(1, $inner.Length - 2).Trim()
            }
            'count(' + (Convert-TwigExprToPhp $inner) + ')'
        })
    }
    return $out
}

# Leaf-filter operand: a call emitted by an earlier filter pass (filter chains such as
# `|trim|e`), a parenthesised group, or a plain/dotted identifier.
$script:TwigFilterOperandPattern = '([a-zA-Z_][a-zA-Z0-9_]*\((?:[^()]|\([^()]*\))*\)|\((?:[^()]|\([^()]*\))*\)|[a-zA-Z_][a-zA-Z0-9_.]*)'

function Resolve-TwigFilterOperand {
    param([string]$Operand)

    $inner = $Operand.Trim()

    # Already PHP from an earlier pass — Convert-TwigExprToPhp is not idempotent and would
    # turn `trim(...)` into `$trim(...)`.
    if ($inner -match '^[a-zA-Z_][a-zA-Z0-9_]*\(') { return $inner }

    if ($inner.StartsWith('(') -and $inner.EndsWith(')')) {
        $inner = $inner.Substring(1, $inner.Length - 2).Trim()
    }
    return Convert-TwigExprToPhp $inner
}

function Convert-TwigRawFilterInExpr {
    param([string]$Expr)

    # Twig `|raw` is a no-op in OC .tpl (echo is already unescaped). Strip it so
    # `(a ~ b)|raw` can unwrap and convert concat; otherwise `~` and `|$raw` leak into PHP.
    $out = $Expr
    $prev = ''
    while ($out -ne $prev) {
        $prev = $out
        $out = [regex]::Replace($out, $script:TwigFilterOperandPattern + '\s*\|\s*raw\b', {
            param($m)
            Resolve-TwigFilterOperand $m.Groups[1].Value
        })
    }
    return $out
}

function Convert-TwigSimpleFilterInExpr {
    param([string]$Expr)

    $map = [ordered]@{ lower = 'strtolower'; upper = 'strtoupper'; trim = 'trim' }

    $out = $Expr
    foreach ($filter in $map.Keys) {
        $phpFunc = $map[$filter]
        $pattern = $script:TwigFilterOperandPattern + '\s*\|\s*' + $filter + '\b'
        $prev = ''
        while ($out -ne $prev) {
            $prev = $out
            $out = [regex]::Replace($out, $pattern, {
                param($m)
                $phpFunc + '(' + (Resolve-TwigFilterOperand $m.Groups[1].Value) + ')'
            })
        }
    }
    return $out
}

function Convert-TwigEscapeFilterInExpr {
    param([string]$Expr)

    $out = $Expr
    $prev = ''
    while ($out -ne $prev) {
        $prev = $out
        $out = [regex]::Replace($out, $script:TwigFilterOperandPattern + '\s*\|\s*e\b', {
            param($m)
            'htmlspecialchars(' + (Resolve-TwigFilterOperand $m.Groups[1].Value) + ', ENT_QUOTES, ''UTF-8'')'
        })
    }
    return $out
}

function Convert-TwigDefaultFilterInExpr {
    param([string]$Expr)

    $out = $Expr
    $prev = ''
    while ($out -ne $prev) {
        $prev = $out
        $out = [regex]::Replace($out, '(\((?:[^()]|\([^()]*\))*\)|(?:[a-zA-Z_$][\w$]*(?:\[[^\]]+\])+|[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*))\s*\|\s*default\s*\(\s*([^)]+?)\s*\)', {
            param($m)
            $inner = $m.Groups[1].Value.Trim()
            if ($inner.StartsWith('(') -and $inner.EndsWith(')')) {
                $inner = $inner.Substring(1, $inner.Length - 2).Trim()
            }
            $phpInner = Convert-TwigExprToPhp $inner
            $default = Convert-TwigExprToPhp $m.Groups[2].Value.Trim()
            '(isset(' + $phpInner + ') ? (' + $phpInner + ') : (' + $default + '))'
        })
    }
    return $out
}

function Convert-PhpSafeArrayKeyReadsInExpr {
    param([string]$PhpExpr)

    if (-not $PhpExpr -or $PhpExpr -notmatch '\$[a-zA-Z_][a-zA-Z0-9_]*\[') { return $PhpExpr }

    $pattern = '(?<![\w''"])(\$[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\[\''(?:[^''\\]|\\.)*''\]|\["(?:[^"\\]|\\.)*"\])+))'

    return [regex]::Replace($PhpExpr, $pattern, {
        param($m)
        $access = $m.Groups[1].Value
        if ($PhpExpr -match ('\(isset\(' + [regex]::Escape($access) + '\)')) {
            return $access
        }
        '(isset(' + $access + ') ? ' + $access + " : '')"
    })
}

function Convert-TwigIfExprToPhp {
    param([string]$Expr)

    $trim = $Expr.Trim()
    $php = Convert-TwigExprToPhp $Expr
    if ($trim -match '^[\w.]+$' -and $trim -notmatch '(==|!=|>=|<=|>|<|\band\b|\bor\b|\snot in\s|\sin\s)') {
        # Legacy PHP notices on missing array keys — Twig {% if %} is truthiness, same as !empty()
        if ($php -match '\[') { return '!empty(' + $php + ')' }
        return $php
    }
    return Convert-PhpSafeArrayKeyReadsInExpr $php
}

function Test-TwigExprFullyWrappedInParens {
    param([string]$Expr)

    $t = $Expr.Trim()
    if ($t.Length -lt 2 -or $t[0] -ne '(' -or $t[$t.Length - 1] -ne ')') { return $false }

    $inQuote = $false
    $depth = 0
    $len = $t.Length
    for ($i = 0; $i -lt $len; $i++) {
        $ch = $t[$i]
        if ($ch -eq "'") { $inQuote = -not $inQuote; continue }
        if ($inQuote) { continue }
        if ($ch -eq '(') { $depth++ }
        elseif ($ch -eq ')') {
            $depth--
            if ($depth -eq 0 -and $i -lt $len - 1) { return $false }
        }
    }
    return $depth -eq 0
}

function Convert-TwigExprToPhp {
    param([string]$Expr)
    $trim = $Expr.Trim()
    # Unwrap only when grouping hid `~` / `?`. Keep `(count($x) + 2)`-style parens.
    if (Test-TwigExprFullyWrappedInParens $trim) {
        $inner = $trim.Substring(1, $trim.Length - 2).Trim()
        if ((Split-TwigExprByTilde $inner) -or (Split-TwigTernaryExpr $inner)) {
            return Convert-TwigExprToPhp $inner
        }
    }
    # Structural ops before leaf filters: `|e` on a concat operand must not short-circuit tilde → `.`
    $range = Convert-TwigRangeToPhp $Expr
    if ($range) { return $range }
    $ternary = Convert-TwigTernaryToPhp $Expr
    if ($ternary) { return $ternary }
    $notIn = Convert-TwigNotInOperatorToPhp $Expr
    if ($notIn) { return $notIn }
    $inOp = Convert-TwigInOperatorToPhp $Expr
    if ($inOp) { return $inOp }
    $isTest = Convert-TwigIsTestToPhp $Expr
    if ($isTest) { return $isTest }
    $concat = Convert-TwigConcatToPhp $Expr
    if ($concat) { return $concat }
    $filtered = Convert-TwigEscapeFilterInExpr (Convert-TwigDefaultFilterInExpr (Convert-TwigSimpleFilterInExpr (Convert-TwigLengthFilterInExpr (Convert-TwigRawFilterInExpr $Expr))))
    if ($filtered -ne $Expr) { return $filtered }

    # Quote-split must not tear apart ident['key'] / ident["key"] — protect bracket keys first.
    $keyState = @{ Map = @{}; Index = 0 }
    $protected = [regex]::Replace($Expr, '\[(\''(?:[^''\\]|\\.)*''|"(?:[^"\\]|\\.)*")\]', {
        param($m)
        $token = '§K' + $keyState.Index + '§'
        $keyState.Map[$token] = $m.Groups[1].Value
        $keyState.Index++
        '[' + $token + ']'
    })

    $quotePattern = @'
('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")
'@
    $parts = [regex]::Split($protected, $quotePattern)
    $out = @()
    for ($i = 0; $i -lt $parts.Length; $i++) {
        if ($parts[$i] -match "^['""]") {
            $out += $parts[$i]
        }
        else {
            $out += (Convert-TwigExprChunkToPhp $parts[$i])
        }
    }
    $joined = ($out -join '')
    foreach ($token in @($keyState.Map.Keys)) {
        $joined = $joined.Replace($token, $keyState.Map[$token])
    }
    return $joined
}

function Test-TwigEchoTernaryUsesIfEcho {
    param([string]$CondTwig)

    if (Find-TwigInOperatorAtDepthZero -Expr $CondTwig -Operator 'not in') { return $true }
    if (Find-TwigInOperatorAtDepthZero -Expr $CondTwig -Operator 'in') { return $true }
    return $false
}

function Test-TwigEchoTernaryUsesEmptyIf {
    param([string]$CondTwig)

    $t = $CondTwig.Trim()
    if (-not $t) { return $false }
    # Comparisons / logic stay as ternary (or in/not-in if-echo above)
    if ($t -match '(==|!=|>=|<=|<>|\band\b|\bor\b|\snot in\s|\sin\s|\sis not\s|\sis\s|\?|\|)') {
        return $false
    }
    # Simple truthiness: var / dotted / bracket path (checkboxes, toggles)
    return $true
}

function Test-PhpExprNeedsEmptyEchoGuard {
    param([string]$PhpExpr)

    $e = $PhpExpr.Trim()
    if (-not $e) { return $false }
    # Already guarded / complex PHP
    if ($e -match '^\(?\s*!?\s*empty\s*\(') { return $false }
    if ($e -match '^\(?\s*isset\s*\(') { return $false }
    if ($e -match '\?') { return $false }
    if ($e -match '\s\.\s') { return $false }
    if ($e -match '^(htmlspecialchars|count|in_array|!in_array)\s*\(') { return $false }
    # Nested or flat array key read — may be undefined on legacy OC
    if ($e -match '\$[a-zA-Z_][a-zA-Z0-9_]*\[') { return $true }
    return $false
}

function Convert-TwigEchoExprToPhp {
    param([string]$Expr)

    $split = Split-TwigTernaryExpr -Expr $Expr
    if ($split) {
        $ifFalseTwig = $split.IfFalse.Trim()
        $ifTrueTwig = $split.IfTrue.Trim()
        if (($ifFalseTwig -eq "''" -or $ifFalseTwig -eq '') -and ($ifTrueTwig -match "^'[^']*'$")) {
            $truePhp = Convert-TwigExprToPhp $ifTrueTwig
            if (Test-TwigEchoTernaryUsesIfEcho -CondTwig $split.Cond) {
                $condPhp = Convert-TwigExprToPhp $split.Cond
                return '<?php if (' + $condPhp + ') { echo ' + $truePhp + '; } ?>'
            }
            if (Test-TwigEchoTernaryUsesEmptyIf -CondTwig $split.Cond) {
                $condPhp = Convert-TwigExprToPhp $split.Cond
                return '<?php if (!empty(' + $condPhp + ')) { echo ' + $truePhp + '; } ?>'
            }
            return '<?php echo ' + (Format-TwigTernaryPhp -Cond $split.Cond -IfTrue $ifTrueTwig -IfFalse $ifFalseTwig) + '; ?>'
        }
    }

    $php = Convert-TwigExprToPhp $Expr
    if (Test-PhpExprNeedsEmptyEchoGuard -PhpExpr $php) {
        return '<?php if (!empty(' + $php + ')) { echo ' + $php + '; } ?>'
    }
    return '<?php echo ' + $php + '; ?>'
}

function Convert-TwigEchoTagsToPhp {
    param([string]$Content)

    $result = [System.Text.StringBuilder]::new()
    $pos = 0
    $len = $Content.Length

    while ($pos -lt $len) {
        $start = $Content.IndexOf('{{', $pos)
        if ($start -lt 0) {
            [void]$result.Append($Content.Substring($pos))
            break
        }

        [void]$result.Append($Content.Substring($pos, $start - $pos))
        $i = $start + 2

        while ($i -lt $len -and [char]::IsWhiteSpace($Content[$i])) {
            $i++
        }

        $exprStart = $i
        $inSingle = $false
        $inDouble = $false
        $matched = $false

        while ($i -lt $len) {
            $ch = $Content[$i]

            if (-not $inDouble -and $ch -eq [char]39) {
                if ($inSingle -and $i + 1 -lt $len -and $Content[$i + 1] -eq [char]39) {
                    $i += 2
                    continue
                }
                $inSingle = -not $inSingle
                $i++
                continue
            }

            if (-not $inSingle -and $ch -eq [char]34) {
                if ($inDouble -and $i + 1 -lt $len -and $Content[$i + 1] -eq [char]34) {
                    $i += 2
                    continue
                }
                $inDouble = -not $inDouble
                $i++
                continue
            }

            if (-not $inSingle -and -not $inDouble -and $i + 1 -lt $len -and $Content[$i] -eq '}' -and $Content[$i + 1] -eq '}') {
                $expr = $Content.Substring($exprStart, $i - $exprStart).Trim()
                [void]$result.Append((Convert-TwigEchoExprToPhp $expr))
                $i += 2
                $pos = $i
                $matched = $true
                break
            }

            $i++
        }

        if (-not $matched) {
            [void]$result.Append($Content.Substring($start))
            break
        }
    }

    return $result.ToString()
}

function Get-TwigLeadingCommentAsPhpHeader {
    param([string]$Content)

    if ($Content -match '^\s*\{#([\s\S]*?)#\}') {
        $commentBody = $Matches[1].Trim()

        if ($commentBody) {
            return "<?php /* $commentBody */ ?>`r`n"
        }
    }

    return ''
}

function Convert-OcmaxTwigToTpl {
    param([string]$Content)

    $tplHeader = Get-TwigLeadingCommentAsPhpHeader -Content $Content
    $out = $Content
    $out = [regex]::Replace($out, '\{#[\s\S]*?#\}', '')

    $out = Convert-TwigForLoopsStructured -Content $out -Depth 0

    $out = [regex]::Replace($out, '\{%\s*set\s+(\w+)\s*=\s*(.+?)\s*%\}', {
        param($m)
        '<?php $' + $m.Groups[1].Value + ' = ' + (Convert-TwigExprToPhp $m.Groups[2].Value) + '; ?>'
    })

    $out = [regex]::Replace($out, '\{%\s*elseif\s+(.+?)\s*%\}', {
        param($m)
        '<?php } elseif (' + (Convert-TwigIfExprToPhp $m.Groups[1].Value) + ') { ?>'
    })
    $out = [regex]::Replace($out, '\{%\s*else\s*%\}', '<?php } else { ?>')
    $out = [regex]::Replace($out, '\{%\s*if\s+(.+?)\s*%\}', {
        param($m)
        '<?php if (' + (Convert-TwigIfExprToPhp $m.Groups[1].Value) + ') { ?>'
    })
    $out = [regex]::Replace($out, '\{%\s*endif\s*%\}', '<?php } ?>')

    $out = Convert-TwigEchoTagsToPhp -Content $out

    return $tplHeader + $out
}

function Apply-TplReplacements {
    param(
        [string]$Content,
        [array]$Replacements
    )
    $out = $Content
    foreach ($pair in $Replacements) {
        if ($pair.Count -ge 2) {
            $out = $out.Replace($pair[0], $pair[1])
        }
    }
    return $out
}
