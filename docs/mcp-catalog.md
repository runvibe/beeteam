# Bee Team MCP catalog

Use runtime `tools/list`, `resources/list` and `prompts/list` to inspect the running server. The [generated JSON catalog](mcp-catalog.json) documents this checkout’s tools, arguments, resources and prompts. Generate it with `cargo run --locked --features mcp --example mcp_catalog`.

The server uses streamable HTTP at the configured MCP path. Simple tools adapt the same validated DTOs and business services as HTTP. Use the advertised operation spelling, including `listExecutionSummarys`. Reads return data plus applicable version information. Writes require the declared actor, idempotency key and the operation's applicable version. A compound write uses one transaction and one idempotency key.

Resources expose explicitly bundled materials. Prompts prepare context; the harness runs the agent. To connect and make the first read, follow [MCP setup](guides/mcp.md).
