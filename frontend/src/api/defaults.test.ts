import { it, expect } from "vitest";
import { createMockApi } from "./mock";
import { ids } from "./seed";
it("omitted archived filter means active only as in the OpenAPI default", async () => {
  const api = createMockApi({ delay: 0 });
  await api.patch("boards", ids.board, { archived: true }, 1);
  expect((await api.list("boards")).items.some((b) => b.id === ids.board)).toBe(
    false,
  );
  expect((await api.list("boards", "", { archived: true })).items[0].id).toBe(
    ids.board,
  );
});
