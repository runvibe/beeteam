# Diagnose a local setup

| Symptom | Check and expected result | Recovery |
| --- | --- | --- |
| Service unreachable | Read `/health` and `/api/v1/info` at the configured host and port. Both should identify Bee Team. | Inspect startup logs, working directory, environment and database access. Start the intended service once. |
| Port in use | On Windows use `Get-NetTCPConnection -LocalPort 59865 -State Listen`; on macOS/Linux use `lsof -nP -iTCP:59865 -sTCP:LISTEN` if installed. Check the owning process and service info. | Reuse an identified compatible instance. Otherwise choose a free `APP_PORT` and update the harness and panel target. |
| Browser cannot reach localhost | Check service info directly and inspect browser local-network permission. A successful HTTP probe from the shell only proves shell access. | Allow the intended site to reach the local service, then retry. Use the embedded panel when the hosted site is unavailable. |
| Panel reports incompatible versions | Compare the panel build with `apiVersion` in info, then inspect required contracts and capabilities. | Update the older component, reload and recheck. Use the embedded UI from the same build if necessary. |
| Local panel returns 404 | Check that the executable was built with `embedded-ui` and launched with `BEE_FRONTEND_MODE=embedded`. | Build the distribution and use `/app/`, or run Vite in development. |
| No matching download | Parse the manifest as JSON and find the exact OS/CPU and matching release asset. | Use the [source path](installation.md) if no verified archive exists. |
| MCP tools missing | Check server registration and discovery inside the intended chat, then call `listBoards`. | Confirm transport, URL, port and process location. Refresh the client after configuration changes. |
| Skill missing | Check the selected harness, project/user scope and complete package with its `SKILL.md`. | Reinstall from the reviewed source into the correct scope and refresh discovery. |
| Database open or migration failure | Identify the service account, SQLite parent permissions or PostgreSQL database privileges. Check driver and URL together. | Restore access or correct the configuration, then restart with the intended data location. Preserve existing data and investigate migration errors before retrying. |

For storage recovery use [backup and restore](storage.md). For integration diagnostics use [MCP discovery](mcp.md).
