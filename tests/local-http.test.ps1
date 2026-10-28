$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/local-http.ps1')
$original = [Environment]::GetEnvironmentVariable('APP_PORT')
try {
    Remove-Item Env:APP_PORT -ErrorAction SilentlyContinue
    if ((Get-LocalHttpConfiguration).BaseUrl -ne 'http://127.0.0.1:59865') { throw 'Incorrect default URL' }
    $env:APP_PORT = '23456'
    if ((Get-LocalHttpConfiguration).BaseUrl -ne 'http://127.0.0.1:23456' -or $env:APP_PORT -ne '23456') { throw 'Explicit port was not preserved' }
    foreach ($invalid in @('abc', '0', '65536')) {
        $env:APP_PORT = $invalid
        $rejected = $false
        try { Get-LocalHttpConfiguration | Out-Null } catch { $rejected = $true }
        if (-not $rejected) { throw "Accepted invalid port $invalid" }
    }
    Write-Output 'Local HTTP configuration: default, explicit override and invalid ports passed.'
} finally {
    [Environment]::SetEnvironmentVariable('APP_PORT', $original)
}
