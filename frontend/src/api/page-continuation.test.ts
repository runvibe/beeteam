import { expect, it } from "vitest";
import { nextPageOffset } from "./page-continuation";
it("stops repeated, empty, regressing and exhausted pages", () => {
  const page = {
    items: [{ id: "a" }],
    offset: 0,
    limit: 1,
    total: 3,
    hasMore: true,
    nextOffset: 1,
  };
  const key = (item: { id: string }) => item.id;
  expect(nextPageOffset(page, [page], key)).toBe(1);
  const repeat = { ...page, offset: 1, nextOffset: 2 };
  expect(nextPageOffset(repeat, [page, repeat], key)).toBeUndefined();
  expect(nextPageOffset({ ...page, items: [] }, [page], key)).toBeUndefined();
  expect(
    nextPageOffset({ ...page, nextOffset: 0 }, [page], key),
  ).toBeUndefined();
  expect(
    nextPageOffset({ ...page, hasMore: false }, [page], key),
  ).toBeUndefined();
});
