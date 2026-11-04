import { LocalizedError, message } from "@/i18n";
import type { BeeApi } from "@/api/types";
import { canonicalHarness } from "./harness-catalog";

export type UsagePresence = {
  harnesses: string[];
  models: { name: string; count: number }[];
  summaries: number;
};

/** Counts presence, never tokens. Publish only after complete, consistent pagination. */
export async function loadUsagePresence(
  api: BeeApi,
  taskId: string,
  signal: AbortSignal,
): Promise<UsagePresence> {
  const summaries = new Set<string>();
  const harnesses = new Map<string, string>();
  const models = new Map<string, number>();
  let offset = 0;
  let expected: number | undefined;
  for (;;) {
    signal.throwIfAborted();
    const { timeline: page } = await api.usage(
      taskId,
      { offset, limit: 100 },
      signal,
    );
    expected ??= page.total;
    if (page.total !== expected || page.offset !== offset)
      throw new LocalizedError(
        message("usage.couldNotCompleteTheReadRecordsChangedRefreshCards"),
      );
    for (const row of page.items) {
      if (summaries.has(row.summaryId))
        throw new LocalizedError(
          message("usage.couldNotCompleteTheReadWithoutDuplicateRecords"),
        );
      summaries.add(row.summaryId);
      const inSummary = new Set<string>();
      for (const { observation } of row.usageReport?.entries ?? []) {
        const harness = canonicalHarness(observation.harness);
        if (harness)
          harnesses.set(
            harness.toLocaleLowerCase(),
            harnesses.get(harness.toLocaleLowerCase()) ?? harness,
          );
        const model = observation.modelId?.trim();
        if (model) inSummary.add(model);
      }
      for (const model of inSummary)
        models.set(model, (models.get(model) ?? 0) + 1);
    }
    if (!page.truncated) {
      if (summaries.size !== expected)
        throw new LocalizedError(message("usage.couldNotLoadAllSummaries"));
      break;
    }
    if (!page.items.length || summaries.size >= expected)
      throw new LocalizedError(message("usage.couldNotCompletePagination"));
    offset += page.items.length;
  }
  return {
    harnesses: [...harnesses.values()].sort((a, b) => a.localeCompare(b)),
    models: [...models]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    summaries: summaries.size,
  };
}
