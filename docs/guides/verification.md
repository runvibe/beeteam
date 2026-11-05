# Documentation verification — November 5, 2026

| Area | Exercised | Limit |
| --- | --- | --- |
| Windows x64 source installation | Built the 0.1.0 distribution, packaged a native ZIP, verified its SHA-256 and exact byte length, and extracted and started it on a free loopback port using temporary SQLite storage. | Local candidate only. |
| Runtime and persistence | Verified health, API info, the embedded `/app/`, default API-only startup, explicit disabled and embedded modes, invalid-mode rejection, and reads after restart. | Browser permission on a hosted deployment and upgrades between versions were not exercised. |
| MCP | Initialized streamable HTTP on the isolated server, discovered 81 tools, 17 resources and 2 prompts, and called `listBoards` on an empty database. The live Codex worker also read its assignment and persisted its execution record. | Counts describe this revision. Discover the actual running server. |
| Skills | Installed all three complete packages from the checkout using skills CLI 1.7.6 into separate temporary Codex, Claude Code and Copilot CLI projects. Get a Worker was invoked in the active Codex chat. | Native Claude Code and Copilot CLI chat connections, fresh invocation of each role in each client and tagged installation remain unverified. |
| Two independent tasks | Created a temporary team, board and two tasks with different worker profiles. Submitted both workers’ result comments concurrently. After restart, read each exact comment and confirmed its assigned executor. | API exercise. A new two-worker release conducted in separate live chats remains a manual acceptance check. |
| Backend | `cargo build --locked` passed. `cargo test --locked` passed 194 tests, using temporary SQLite files and a separate PostgreSQL 18 test container for tests that require PostgreSQL. | Shared HTTP/MCP tests used SQLite for this run. |
| README rendering | GitHub's Markdown API rendered the README. Chromium rendered the hexagon against light and dark GitHub background colors. Relative link targets and README fragment anchors were checked locally. | The repository’s final published page depends on merging the reviewed revision. |
| Publication | GitHub returned zero releases and zero candidate workflow runs. The manifest URL returned an HTML landing redirect. | There is no verified public binary, tagged skill bundle or hosted install manifest for this revision. |
| Other platforms | The workflow declares native Ubuntu and macOS runners as well as Windows. The packaging script derives the actual OS and CPU. | Linux x64/arm64, macOS x64/arm64 and Windows arm64 native build and smoke remain unverified here. |

The first-team scenario uses illustrative release work. Its generated records were confined to a temporary database. The [editorial inventory](editorial-inventory.md) preserves the prior documentation map and historical translation scope.
