# All local board tasks in Kanban

Include active subtasks at any depth in their own board columns and continuation pages. Preserve parentId, own status and movement semantics. No foreign-board children are imported. Backend board snapshot and frontend continuation must share scope and totals.

Parent reference uses optional backend-hydrated {id,title,slug}; old responses use parentId link without additional requests. Keep parent link outside the main card link, accessible and wrapped for mobile. Existing move-before constraints across different parents are not redesigned here.

Validate board totals/pagination, nested children, foreign-board exclusion, parent links and existing carousel/scroll tests. No data writes or service restart; real inclusion QA depends on updated backend.

## Evidence

- Full frontend suite passed: 262 tests in 72 files. Production build passed with existing bundle-size warning (~908 kB). Rust build and 20 library tests passed.
- Regression validates 9 local tasks across pages including children/grandchild, excludes foreign-board child, and preserves parentId. Parent reference tests cover root, legacy UUID fallback and hydrated name/slug. Existing carousel and viewport tests remain passing.
- Runtime board read at 59865 returned 34 tasks, zero children and no parentReference fields. Real desktop/mobile acceptance of new cards remains pending backend integration/operator activation. No service restart or product data mutation performed.
- Existing app-navigation test now matches the task title exactly to distinguish its main link from parent-reference links.
