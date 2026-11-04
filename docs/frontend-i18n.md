# Frontend internationalization

The production interface is tokenized in English and Portuguese with i18next and
react-i18next. Catalogs are partitioned into agents, boards, common, errors,
execution, files, settings, tasks, teams, transfer and usage. English is both the
default and missing-key fallback. Portuguese includes browser dialects such as
pt-BR, pt-PT and pt-AO.

## Preference and live updates

`src/i18n/preference.ts` resolves the saved `auto/en/pt` preference before the
browser's first preferred language. Invalid/missing storage values resolve to
automatic. Access and persistence failures are handled without preventing app
startup or a session-only choice. Settings exposes the choice through the existing
Choice control, with the storage key `bee-locale`.

`src/i18n/index.ts` owns the instance, document language/title, cross-tab storage
updates, automatic browser-language updates, subscriptions and formatting.
Components subscribe with `useLocale()` without changing React keys or remounting
forms. No navigation, query key or autosave state depends on the display language.
Module label records use getters; task-section arrays are constructed when read.
Module-owned Intl formatters are rebuilt lazily after a language change.

Use `formatNumber`/`formatPercent` for displayed numbers and `locale()` for other
Intl formatters. `tokenCount` and `observedDuration` retain BigInt arithmetic;
large counters are never converted through Number. `tokenAmount` selects singular/plural
from exact BigInt comparisons and formats the original amount independently. Translation interpolation
keeps the numeric count for plural selection and formats the displayed value
separately. Full count phrases use `_zero`, `_one`, `_other` and `_many` entries in
both catalogs, including zero and Portuguese million-category behavior.

Use `message(key, options)` with `LocalizedError`/`ApiError` for application-owned
errors. The message is resolved when rendered, so cached errors follow live locale
changes. Store operation codes, rather than translated copy, in asynchronous busy
state. Transfer job persistence is optional and safely tolerates denied reads/writes,
so the actual global Settings dialog remains usable without browser storage. Transfer state/stage/error codes use explicit mappings. The two known
backend-owned resumption notices use exact protocol-template mappings; unknown
notices and external errors remain verbatim.

## Coverage and audit

Run `npm run audit:i18n` from `frontend`. The TypeScript AST guard scans every
production TS/TSX module, including helpers, API adapters and the i18n runtime.
It checks JSX text; accessible labels/titles/placeholders; label records; helper
and default literals; lowercase display branches; and interpolated UI templates.
Translation keys, CSS/cva classes, type declarations, imports, technical
comparisons and punctuation-only composition are distinguished structurally.

The audit currently covers 165 production modules with zero unresolved candidates.
Its 51 exceptions are exact **file + literal + reason** entries in
`scripts/i18n-exceptions.json`; there are no ordinary UI file exemptions. The
exceptions are product/provider brands, keyboard/HTML/directive tokens, MIME and
extension examples, the person-avatar initial, a historical selector query identifier, a developer invariant, a mock file's
fixture content, and exact system-notice protocol templates rendered through
semantic translation keys. Stale exceptions fail the test.

Tests, generated API type contracts, `api/seed.ts` and `execution-fixtures.ts`
are outside the production UI literal scan: they contain test data, generated
contract syntax or authored demonstration data. Catalog JSON is checked separately
for complete key/interpolation/plural parity. The AST guard is backed by regression
cases for JSX, attributes, lowercase branches, defaults, helpers, errors and
templates. It supplements review of production strings; it does not translate
arbitrary content or inspect/replace DOM text.

The migration covers navigation and breadcrumbs; boards, tasks, agents and teams;
settings/status creation and editing; filters and summaries; Markdown wrappers;
plans/revisions; conversations and author fallbacks; attachments/download states;
execution/timeline views and SVG labels; progress/overview charts; usage,
checkpoints and provenance; transfer controls; loading/empty/error states; and
date/number/relative-time helpers.

## Preservation boundary

User/API records are not dictionaries. Titles, names, user-defined status names,
descriptions, Markdown, plans, summaries, comments, filenames, paths, model/provider
identifiers, UUIDs, slugs, URLs, query parameters and technical evidence remain as
authored. Unknown future enum/error/notice values retain their original value for
forward compatibility. No translation library rewrites user data, API DTOs,
network payloads or DOM nodes. APIs and backend persistence remain unchanged.

Both status completion switches use the shared strings:

| Locale | Label | Help |
| --- | --- | --- |
| English | Counts as completed | Tasks in this status are considered completed. |
| Portuguese | Conta como concluído | Tarefas neste status são consideradas concluídas. |

## Validation and maintenance

Run `npm test -- --maxWorkers=2` and `npm run build`. Existing tests explicitly
select Portuguese in `src/test/setup.ts`; production detection remains automatic.
The locale regressions cover precedence/dialects/invalid and unavailable storage,
automatic/browser/cross-tab behavior, selector persistence, live form identity,
draft/focus/URL preservation, shared completion labels, cached errors, module
labels, Intl helpers, icon identity, an in-flight transfer and large counters.

The controller also verified browser widths 1440 and 390 in both languages,
detection/fallback/persistence, user-content preservation, live switching of a
focused unsaved status form and absence of viewport overflow/runtime errors in the
isolated mock environment. Browser evidence is retained locally under
`.local/qa/i18n`. No product data or active product services were changed.

Before adding UI copy, add a semantic key in both area catalogs, retain placeholder
names and all plural variants, subscribe its rendering component, and extend
meaningful behavior tests where needed. Do not key icons or mutations by displayed
labels. Do not introduce broad audit exclusions to make ordinary UI copy pass.
