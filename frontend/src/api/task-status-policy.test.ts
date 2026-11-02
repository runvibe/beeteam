import { expect, it } from "vitest";
import { createMockApi } from "./mock";
import { makeSeed } from "./seed";
import type { Patches } from "./types";
it("rejects status bypass through demo patch without mutating the task", async () => {
  const seed = makeSeed();
  const task = seed.tasks[0];
  const api = createMockApi({ delay: 0 });
  const before = await api.get("tasks", task.id);
  await expect(
    api.patch(
      "tasks",
      task.id,
      { statusId: "another-status" } as unknown as Patches["tasks"],
      before.version,
    ),
  ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
  const after = await api.get("tasks", task.id);
  expect(after.statusId).toBe(before.statusId);
  expect(after.version).toBe(before.version);
});
