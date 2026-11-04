import { expect, it, vi } from "vitest";
import { loadUsagePresence } from "./usage-presence";
import { createMockApi } from "@/api/mock";
import { canonicalHarness, harnessIcon } from "./harness-catalog";

it("preserves unknown names even when they match object prototype keys", () => {
  for (const name of ["constructor", "__proto__"]) {
    expect(canonicalHarness(name)).toBe(name);
    expect(harnessIcon(name)).toBeUndefined();
  }
});

const row = (id: string, entries: [string, string][]) => ({
  summaryId: id,
  usageReport: {
    entries: entries.map(([harness, modelId]) => ({
      observation: { harness, modelId },
    })),
  },
});
it("counts each model once per summary across all pages and deduplicates harnesses", async () => {
  const api = createMockApi({ delay: 0 });
  const usage = vi.spyOn(api, "usage").mockImplementation(
    async (_id, f) =>
      ({
        timeline:
          f?.offset === 0
            ? {
                items: [
                  row("a", [
                    ["Codex", "m1"],
                    [" codex ", "m1"],
                  ]),
                ],
                offset: 0,
                limit: 1,
                total: 2,
                truncated: true,
              }
            : {
                items: [
                  row("b", [
                    ["Cursor", "m2"],
                    ["Codex", "m1"],
                  ]),
                ],
                offset: 1,
                limit: 1,
                total: 2,
                truncated: false,
              },
      }) as never,
  );
  const data = await loadUsagePresence(
    api,
    "task",
    new AbortController().signal,
  );
  expect(usage).toHaveBeenCalledTimes(2);
  expect(data.models).toEqual([
    { name: "m1", count: 2 },
    { name: "m2", count: 1 },
  ]);
  expect(data.harnesses).toEqual(["Codex", "Cursor"]);
  expect(data.summaries).toBe(2);
});
it("does not label interrupted or changing pagination as a complete total", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "usage").mockResolvedValue({
    timeline: { items: [], offset: 0, limit: 100, total: 2, truncated: true },
  } as never);
  await expect(
    loadUsagePresence(api, "task", new AbortController().signal),
  ).rejects.toThrow(/completar/);
});
it("keeps absent evidence empty, never zero-token inference", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "usage").mockResolvedValue({
    timeline: {
      items: [{ summaryId: "legacy", usageReport: null }],
      offset: 0,
      limit: 100,
      total: 1,
      truncated: false,
    },
  } as never);
  expect(
    await loadUsagePresence(api, "task", new AbortController().signal),
  ).toEqual({ models: [], harnesses: [], summaries: 1 });
});
