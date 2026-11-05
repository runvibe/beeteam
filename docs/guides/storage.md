# Store, back up and restore work

With database settings omitted, Bee Team creates `~/.beeteam/beeteam.sql` under the service user's home when it opens SQLite. On Windows this is normally `$env:USERPROFILE\.beeteam\beeteam.sql`. SQLite enables WAL and foreign keys. Migrations apply when opening the selected database.

## Select another database

In PowerShell set the variables in the shell that launches the app:

```powershell
$env:DATABASE_DRIVER = 'sqlite'
$env:DATABASE_URL = 'sqlite://C:/bee-data/beeteam.sqlite'
```

On macOS or Linux, for example:

```sh
export DATABASE_DRIVER=sqlite
export DATABASE_URL="sqlite://$HOME/bee-data/beeteam.sqlite"
```

For PostgreSQL set `DATABASE_DRIVER=postgres` and supply a connection URL for the intended application database using your service manager’s secret configuration. If only the URL is set, the service infers PostgreSQL from its scheme. An explicit driver and URL must agree. Pointing to another database selects it for subsequent launches. Moving records between databases requires an explicit transfer. Maintain separate SQLite and PostgreSQL migrations.

## Back up and restore

For a file-level SQLite backup, stop the identified service cleanly and preserve the database and any sidecar files together, or use SQLite’s online backup mechanism. Copying a running WAL database's main file alone can lose committed work. For PostgreSQL use a database-native consistent backup. Test restoration into an isolated database.

For an application-level transfer, explicitly configure the [portable transfer service](../data-transfer-verification.md), a dedicated archive directory and allowed administrative origins. Export a consistent snapshot, retain the package and digest, then preview it against a separate **empty** destination. Check the proposed adapter and timestamp precision policy before authorizing restore. Import preserves identifiers, Markdown and replay history. A restore with unknown commit outcome requires reconciliation before retry. Verify the restored board, tasks and attachments before switching your service configuration. [Transfer API](../data-transfer-openapi.json).
