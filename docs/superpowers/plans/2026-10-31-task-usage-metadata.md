# Optional execution usage metadata

Authorized scope: historical execution-summary metadata and task Overview only. Existing summary Markdown, header, charts, sidebar, comments and scroll behavior remain independent.

## Implementation plan

1. Synchronize the stable backend OpenAPI and generate types. Usage is optional; legacy records and failed collection remain valid.
2. Add focused semantic renderers for summary usage entries and backend-owned overview aggregation. Never sum snapshots/pages in the client or interpret absence as zero.
3. Show model/harness identities, actor, reported token quantities, quality and provenance according to DTO. Label checkpoint time as report time and status as observed; do not infer usage time.
4. Render complete backend model/harness lists, known accumulated totals, coverage/gaps/estimated/mixed states and checkpoint timeline. Preserve bounded feed disclosure if the DTO paginates.
5. Test legacy/absent/zero/mixed/snapshot/delta and accessible responsive content with fixture-only data. No product demo metrics, credentials, collector or runtime restart.
6. Build, test, document and commit/push the frontend branch. Only claim live QA after the real endpoint supports the schema.

## Current dependency

Backend schema synchronized and 69 schemas generated. No client-side substitute aggregation introduced.

## Delivery validation

- Full frontend suite: 257 tests / 71 files passed; an additional focusable-disclosure/unavailable-source regression was added and focused usage tests rerun afterward.
- TypeScript/production build passed (existing main bundle warning, about 907 kB); Rust build and 20 library tests passed.
- Real API at 59865 still omits overview.usage. Browser preview confirms the legacy Overview fallback and historical summaries preserve text while explaining missing metrics. Live populated metrics, pagination and responsive acceptance remain pending backend deployment/operator activation. No restart or product metrics created.
- Tests cover exact bigint formatting, genuine zero versus absence, legacy summaries/checkpoints, original baseline versus null delta, mixed quality, backend-authoritative totals across pages, dimension/timeline pagination, failure retaining prior rows, safe plain-text provenance and focusable native disclosures.
