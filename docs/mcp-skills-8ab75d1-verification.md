# MCP Skills snapshot verification — 2026-10-29

Approved source: `8ab75d1c422c41a1a66ca82166c209063c50d760`.
Nine copied files are byte-identical to that commit. The tenth, Codex guidance,
retains three existing SQLite-aware startup/readiness paragraphs from c1fd823;
all approved communication changes are present. Source and bundle hashes are
recorded in resources/bee-team/provenance.json. Other bundled resources were
preserved. No global skills or personal Codex configuration were modified here.

The 13 resources and three prompts retain their names and arguments. Resource
listing provenance identifies the source commit and local overlay. Skill links
map explicitly to beeteam://skills/leader or collaborator; other relative links
map by basename to listed references. All relative Markdown links were checked.
No filesystem resource or tool capability was added.

The MCP integration test checks the hashes returned by resources/read against
the pinned bundle manifest, and prompts/get includes the new read-only versus
notification guidance. Its initial red run failed against the previous snapshot.
These checks establish content delivery, not behavioral compliance by an AI.

The first full compile found a new-test hash formatting error and Windows error
1455 (paging-file exhaustion) during parallel compilation. The formatting was
fixed and subsequent validation uses one Cargo job. No timeout or test assertion
was relaxed. Integration uses only the isolated PostgreSQL 18 test instance on
55481, never the product PostgreSQL or SQLite database.

The existing executable under target/release and PID 101568 on port 59865 were
preserved. Building a new artifact does not update the running MCP snapshot.
No restart, activation, product-data change, push, merge or deployment occurred.

Validation completed: cargo build and cargo test --locked --features mcp,embedded-ui -j 1 passed; 91 tests, zero failures. MCP catalog regenerated with cargo run --locked --features mcp --example mcp_catalog -j 1; 13 resources and three prompts, updated provenance.

Final release build passed with mcp,embedded-ui and one Cargo job. Separate artifact: `.local/distribution/artifacts/beeteam-skills-8ab75d1.exe` (39970304 bytes). SHA-256: `9c3c7e1a224d43b53fd8cf8b1ea697cec9648c910484d3b047fd01abc25d4e8f`. Build target: `.local/distribution/port-target`, with frontend dist under `.local/distribution/frontend/dist`. The new executable has not been activated.
