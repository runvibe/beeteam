import type { Page } from "./types";
/** A broken/repeated page must never cause an unbounded autofill loop. */
export function nextPageOffset<T>(
  last: Page<T>,
  pages: Page<T>[],
  key: (item: T) => string,
): number | undefined {
  if (
    !last.hasMore ||
    last.nextOffset == null ||
    last.nextOffset <= last.offset ||
    !last.items.length
  )
    return;
  const seen = new Set(
    pages.slice(0, -1).flatMap((page) => page.items.map(key)),
  );
  if (pages.length > 1 && last.items.every((item) => seen.has(key(item))))
    return;
  if (pages.some((page) => page.offset === last.nextOffset)) return;
  return last.nextOffset;
}
