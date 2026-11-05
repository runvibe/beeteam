# Choose a runtime

| Mode | How to start | Where to open the panel |
| --- | --- | --- |
| Local API and MCP | Run the distribution with its default environment, or `cargo run --locked` from source | Use a compatible separately hosted or Vite panel |
| Embedded UI | Build the distribution, set `BEE_FRONTEND_MODE=embedded` and start the binary | `http://127.0.0.1:59865/app/` |
| Frontend development | Start the API, then run `npm ci` and `npm run dev` inside `frontend` | `http://127.0.0.1:5173/app/` |

The hosted-site design connects the browser to the user's local service. Grant the browser local-network permission when prompted. On November 5 the reference domain did not provide a valid installation manifest. Use the embedded panel for a same-version local installation.

| Setting | Default | Effect |
| --- | --- | --- |
| `APP_HOST`, `APP_PORT` | `127.0.0.1`, `59865` | Bind address and port |
| `BEE_FRONTEND_MODE` | `embedded` with bundled UI, otherwise `disabled` | `embedded` requires a build containing the UI |
| `MCP_ENABLED`, `MCP_PATH` | `true` with MCP compiled, `/mcp` | Enable and route MCP |
| `OTEL_ENABLED` | `false` | Opt in to telemetry with an available collector |
| `BEE_API_TARGET` | `http://127.0.0.1:59865` | Vite's development proxy target for `/api` |
| `DATABASE_DRIVER`, `DATABASE_URL` | SQLite in the service user's home | [Storage configuration](storage.md) |

Read `/health` and `/api/v1/info` independently. Info reports the app version, supported contracts and capabilities. Canonical Worker operations are under `/api/v2`; discovery and some auxiliary endpoints retain `/api/v1`. The panel compares its full build version with the API. When versions differ, update the older component and recheck. If the API is newer, reload or update the panel. A newer stable release for an already matching pair is optional. See the [installation manifest](../install-manifest.md) for promotion rules.
