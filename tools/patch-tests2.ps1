Set-Location 'k:\f-drive\workspace\ai-tools'

foreach ($f in @('packages/server/src/routes/registry-exploration.test.ts','packages/server/src/routes/org.test.ts')) {
    $c = [System.IO.File]::ReadAllText((Join-Path $PWD $f))
    $c = $c.Replace("url: '/tools'", "url: '/api/tools'")
    $c = $c.Replace("url: '/tools/", "url: '/api/tools/")
    [System.IO.File]::WriteAllText((Join-Path $PWD $f), $c)
    Write-Host "OK: $f"
}

$f = 'packages/server/src/routes/registry.test.ts'
$c = [System.IO.File]::ReadAllText((Join-Path $PWD $f))
$c = $c.Replace("url: '/upstream'", "url: '/api/upstream'")
$c = $c.Replace("GET /upstream", 'GET /api/upstream')
[System.IO.File]::WriteAllText((Join-Path $PWD $f), $c)
Write-Host "OK: $f"

Write-Host "All done"
