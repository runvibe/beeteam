# Task header narrative

Authorized layout: title, description, progress, optional block, current synthesis, tabs. Keep Markdown and reliable summary metadata. Remove overview duplication; retain progress note and charts.

Implementation uses the existing hero intersection observer. Shared narrative components render header and expandable compact sidebar prose. Compact content is hidden/inert when absent; native details supports keyboard expansion. Sidebar remains independently scrollable; no form remounts or product mutations. Mobile retains its existing flow.

Verification: all tabs/order, blocked/empty/Markdown, desktop observer round trip and form identity, mobile observer exclusion, full frontend tests/build and Rust build/unit tests. Live browser verification recorded at delivery.

Results: 250 frontend tests across 70 files passed, production build passed (existing bundle-size warning), Rust build and 20 library tests passed. Browser preview on 5176 with live API data verified desktop header order, compact summary expansion/provenance, return-to-top hiding, and 390px mobile flow. API overview is now available after external operator activation; no restart or data writes performed here.
