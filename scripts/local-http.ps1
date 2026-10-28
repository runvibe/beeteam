function Get-LocalHttpConfiguration {
    $port = 59865
    if (Test-Path Env:APP_PORT) {
        $configuredPort = 0
        if (-not [int]::TryParse($env:APP_PORT, [ref]$configuredPort) -or $configuredPort -lt 1 -or $configuredPort -gt 65535) {
            throw 'APP_PORT must be an integer between 1 and 65535 for the local launcher.'
        }
        $port = $configuredPort
    }
    [pscustomobject]@{ Port = $port; BaseUrl = "http://127.0.0.1:$port" }
}
