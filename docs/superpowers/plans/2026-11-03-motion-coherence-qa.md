# Motion coherence: review scenarios

Task: `01a189de-f0fd-7e10-92d1-5bc61be7cfba`.

The interaction changes reuse existing controls and data. Motion owns filter
position/tag springs, search glyph/input fades, popover transitions and surface
entrances. Responsive capsule width stays in CSS; dialog dismissal stays in
Radix Presence with a CSS fade so modal focus/scroll cleanup has one owner.
All timings come from `motion-presets.ts`; reduced motion removes transitions.

## Automated coverage

- Filter search open/type/Escape/reopen retains the URL value and input focus.
- Individual removal preserves unrelated URL filters and transfers keyboard focus.
- Tag Escape returns focus to the toggle before the list becomes inert/aria-hidden.
- Popover Escape restores focus; switching popovers does not steal newer focus.
- Dialog rerenders preserve the input DOM, draft and focus; Escape restores opener.
- Page identity changes animate; query-only updates do not remount or reanimate.
- Reduced-motion presets have no displacement, scale change, delay or duration.
- Existing task dock and infinite-list tests remain part of the full suite.

## Visual acceptance after integration (Leader/user)

Pending, not claimed as performed by the collaborator. Use the existing preview
and real registered data, without seed/reset or service restarts.

1. Desktop and 390px viewport, light/dark: open/close search quickly, type, Escape,
   reopen; check unchanged text, focus, glyph alignment and no horizontal overflow.
2. Add/remove several filters; hover the stack repeatedly, remove by keyboard,
   press Escape from a tag. Check stable hit areas and no hidden focus target.
3. Scroll task filters into/out of the mobile dock while search or tags are open;
   verify same input, focus, values and scroll position.
4. Switch between filter popovers during exit; verify only the new one owns focus.
5. Open/close settings or an agent/team context panel, including rapid reopening;
   verify draft stability during updates, Escape focus return and scroll unlock.
6. Navigate pages and browser back/forward; query edits must not fade the page.
7. Repeat with OS reduced motion enabled: no spring/resize/fade delay, same keyboard
   and pointer behavior. Existing source/output build warning is not visual acceptance.
