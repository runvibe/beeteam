# Connect a local harness over MCP

Run the harness where it can reach the Bee Team service. Loopback points to the machine running the client. Confirm the service identity at `http://127.0.0.1:59865/api/v1/info` and the configured MCP path. The default streamable HTTP endpoint is `http://127.0.0.1:59865/mcp`.

## Register one connection

Inspect existing connections first. Preserve the configured endpoint if your port or path differs. These commands target the named CLI. IDE settings and cloud-hosted sessions have different configuration and network scopes.

| Client | Command for a new registration | Check |
| --- | --- | --- |
| Codex CLI, user configuration | `codex mcp add beeteam --url http://127.0.0.1:59865/mcp` | `codex mcp list` |
| Claude Code CLI, local project scope | `claude mcp add --scope local --transport http beeteam http://127.0.0.1:59865/mcp` | `claude mcp list`, then `/mcp` in the session |
| GitHub Copilot CLI, personal configuration | Use the interactive `/mcp add` dialog, name it `beeteam`, choose HTTP and enter the endpoint | Open `/mcp` and inspect the server and tools |

## Verify the session

Open a session that has loaded the registration. Ask it to discover MCP tools, resources and prompts. Select a bundled resource and prompt by the identifiers actually returned. Ask it to call `listBoards` without creating a board. An empty collection is a successful read on a fresh database. If the server is healthy but the tool is unavailable, inspect client scope, HTTP transport, path and project trust, then refresh the session.

The [catalog](../mcp-catalog.json) describes the checked-in server. Runtime discovery identifies what the running instance offers. Declared actors record authorship. Access control belongs to the deployment and harness. Keep the default listener on loopback for a personal installation.

See the [verification matrix](verification.md) for the combinations exercised. Client references: [Codex MCP](https://developers.openai.com/codex/mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [GitHub Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers).
