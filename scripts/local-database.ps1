# Select storage before any Docker or process operations. No credentials are logged.
function Get-LocalDatabaseConfiguration {
    $driver = if ([string]::IsNullOrWhiteSpace($env:DATABASE_DRIVER)) { 'postgres' } else { $env:DATABASE_DRIVER.Trim().ToLowerInvariant() }
    if ($driver -notin @('postgres', 'sqlite')) { throw 'DATABASE_DRIVER must be postgres or sqlite.' }
    $url = $env:DATABASE_URL
    if ([string]::IsNullOrWhiteSpace($url)) {
        if ($driver -eq 'sqlite') { throw 'SQLite requires an explicit DATABASE_URL (for example sqlite://.local/beeteam.sqlite).' }
        return [pscustomobject]@{ Driver = $driver; Url = $null; ManagedPostgres = $true }
    }
    if (($driver -eq 'sqlite' -and -not $url.StartsWith('sqlite:')) -or
        ($driver -eq 'postgres' -and $url -notmatch '^postgres(ql)?://')) {
        throw 'DATABASE_URL does not match DATABASE_DRIVER.'
    }
    return [pscustomobject]@{ Driver = $driver; Url = $url; ManagedPostgres = $false }
}
