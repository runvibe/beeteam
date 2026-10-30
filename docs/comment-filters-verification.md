# Comment filter verification — 2026-10-30

## Contract and implementation

HTTP `GET /api/v1/tasks/{taskId}/comments` and MCP `listComments` share optional `text`, `actorKind` and existing `actorId` filters. All filters combine with AND. `text` is a literal case-sensitive, accent-sensitive substring of the stored Markdown body; whitespace is preserved, empty text matches all, and `%`, `_`, backslash and regex syntax have no pattern meaning. Maximum 1024 Unicode characters / 4096 UTF-8 bytes; NUL is rejected. Repository predicates bind the value into PostgreSQL `strpos` and SQLite `instr`, avoiding LIKE wildcard semantics. Both count and page use the same filtered CTE and snapshot; existing stable ordering is unchanged. No migration or data mutation is needed.

Frontend coordination confirmed query names and semantics; UI URL state uses comments.text, comments.actorKind and comments.actorId. Selecting human omits actorId; selecting an agent uses actorKind=agent plus actorId. HTTP/MCP response remains CommentPage. actorId retains existing UUID/existence validation.

## Checks

- `cargo build --locked --features mcp -j 1`: passed.
- New `backend_comment_filters` integration test passed against temporary SQLite through both HTTP and MCP: authors, human/null ID, combined filters, literal wildcard/SQL/regex characters, case and accents, whitespace, empty search, full-dataset filtering beyond the initial page, total/offset/hasMore/nextOffset, reverse ordering and invalid inputs.
- `cargo test --locked --features mcp -j 1 --no-fail-fast` with BEE_TEST_DRIVER=sqlite: 65 passed, 26 failed in 10 targets. All failures occurred while obtaining PostgreSQL test infrastructure: missing BEE_TEST_DATABASE_URL or unavailable native Docker endpoint for Testcontainers. Isolated port 55481 was unreachable. No product database was used; no Docker container was successfully started or changed. The PostgreSQL query implementation compiles but execution against PostgreSQL remains unverified.
- Final focused rerun: backend_comment_filters and the two SQLite MCP tests all passed, including NUL rejection, exact comment lookup and bundled resource/catalog hashes. Catalog regenerated and listComments query schema verified.
- The full test log is ignored local evidence at `.local/comment-filters-full-tests.log`.

## Runtime boundary

Read-only inspection of SQLite API 59865 found 66 tools and getComment present, but live listComments did not yet advertise text or actorKind. This implementation does not replace/restart that process. A new artifact built from the integrated source and manual activation are required; the previous automatic activation restriction must not be bypassed. No real comment content, IDs or authorship were modified.
