param()
Set-Location 'k:\f-drive\workspace\ai-tools'

function Patch([string]$rel, [hashtable]$replacements) {
    $path = Join-Path $PWD $rel
    $c = [System.IO.File]::ReadAllText($path)
    foreach ($kv in $replacements.GetEnumerator()) {
        $c = $c -replace [regex]::Escape($kv.Key), $kv.Value
    }
    [System.IO.File]::WriteAllText($path, $c)
    Write-Host "OK: $rel"
}

# registry.ts
Patch 'packages/server/src/routes/registry.ts' @{
    "'/upstream'" = "'/api/upstream'"
}

# registry-exploration.ts
Patch 'packages/server/src/routes/registry-exploration.ts' @{
    "new URL('/tools'," = "new URL('/api/tools',"
}

# registry-client.ts - template literal paths and URL construction
$f = 'packages/cli/src/utils/registry-client.ts'
$c = [System.IO.File]::ReadAllText((Join-Path $PWD $f))
# `/tools/${encoded}/${version}` -> `/api/tools/${encoded}/${version}`
$c = $c.Replace('`/tools/', '`/api/tools/')
# `/search?q=` -> `/api/search?q=`
$c = $c.Replace("'/search?q=", "'/api/search?q=")
# `${base}/tools` -> `${base}/api/tools`
$c = $c.Replace('base}/tools`', 'base}/api/tools`')
[System.IO.File]::WriteAllText((Join-Path $PWD $f), $c)
Write-Host "OK: $f"

# Test files
Patch 'packages/server/src/routes/tools.test.ts' @{
    "url: '/tools'" = "url: '/api/tools'"
    "url: '/search" = "url: '/api/search"
    "url: '/me'" = "url: '/api/me'"
    "url: '/tools/" = "url: '/api/tools/"
}

Patch 'packages/server/src/routes/portal.test.ts' @{
    "url: '/portal'" = "url: '/'"
    "url: '/portal/skills/" = "url: '/skills/"
    "url: '/portal/admin/login'" = "url: '/admin/login'"
    "url: '/portal/admin/logout'" = "url: '/admin/logout'"
    "url: '/portal/admin'" = "url: '/admin'"
    "toBe('/portal/admin/login')" = "toBe('/admin/login')"
    "toBe('/portal/admin')" = "toBe('/admin')"
}

Patch 'packages/server/src/routes/admin.test.ts' @{
    "'/portal/admin'" = "'/admin'"
    "'/portal/admin/login'" = "'/admin/login'"
    "/portal/admin/login" = "/admin/login"
}

Patch 'packages/cli/src/utils/registry-client.test.ts' @{
    "'/tools/my-skill/latest'" = "'/api/tools/my-skill/latest'"
    "'/tools/my-skill/versions'" = "'/api/tools/my-skill/versions'"
    "'/search?q=" = "'/api/search?q="
    "'/tools'" = "'/api/tools'"
}

Write-Host "All done"
