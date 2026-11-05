import { expect, it, vi } from "vitest";
import { createHttpApi } from "./http";
import { fromLegacyWorker } from "./legacy-worker";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const modern = {
  apiVersion: "2.0",
  supportedContractVersions: ["v1", "v2"],
  capabilities: ["roles.worker", "teams.role-icons"],
};
it("bounds pending discovery by the transport timeout and recovers on explicit refresh", async () => {
  vi.useFakeTimers();
  try {
    let stalled = true;
    let discoverySignal: AbortSignal | null | undefined;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith("/info")) return json({ items: [] });
      if (!stalled) return json(modern);
      discoverySignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    const api = createHttpApi({ fetch: fetcher as typeof fetch, timeoutMs: 50 });
    const discovery = api.info().catch((error: unknown) => error);
    const reading = api.list("agents");
    await vi.advanceTimersByTimeAsync(50);
    expect(discoverySignal?.aborted).toBe(true);
    expect(await discovery).toMatchObject({ status: 0, code: "network_error" });
    await reading;
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v1/agents");
    stalled = false;
    await api.info();
    await api.list("agents");
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v2/agents");
  } finally {
    vi.useRealTimers();
  }
});
it("negotiates Worker v2 once for concurrent reads and preserves auxiliary URLs", async () => {
  const fetcher = vi.fn(async (url: string) =>
    json(url.endsWith("/info") ? modern : { items: [] }),
  );
  const api = createHttpApi({
    baseUrl: "https://example.test/prefix/api/v1/",
    fetch: fetcher as typeof fetch,
  });
  await Promise.all([
    api.info(),
    api.list("agents", "", { role: "worker" }),
    api.get("teams", "t"),
  ]);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "https://example.test/prefix/api/v1/info",
    "https://example.test/prefix/api/v2/agents?role=worker",
    "https://example.test/prefix/api/v2/teams/t",
  ]);
  await api.openProject("task", "project", "vscode");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
    "https://example.test/prefix/api/v1/tasks/task/projects/project/open",
  );
});
it.each([
  { ...modern, capabilities: [] },
  { ...modern, supportedContractVersions: ["v1"] },
])("requires both the v2 contract and Worker capability", async (info) => {
  const fetcher = vi.fn(async (url: string) =>
    json(url.endsWith("/info") ? info : {}),
  );
  await createHttpApi({ fetch: fetcher as typeof fetch }).get("teams", "t");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v1/teams/t");
});
it("cancels one waiting consumer without cancelling shared discovery", async () => {
  let release!: (response: Response) => void;
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/info")
      ? new Promise<Response>((resolve) => {
          release = resolve;
        })
      : json({ items: [] }),
  );
  const api = createHttpApi({ fetch: fetcher as typeof fetch });
  const controller = new AbortController();
  const cancelled = api.list("agents", "", {}, controller.signal);
  const surviving = api.list("teams");
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
  release(json(modern));
  await surviving;
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "/api/v1/info",
    "/api/v2/teams",
  ]);
});
it("projects historical structured evidence only, preserving IDs and arbitrary event payloads", () => {
  const entry = {
    id: "same-id",
    evidenceKey: "same-hash",
    observation: {
      actorRole: "collaborator",
      evidenceId: "collaborator-evidence",
      discovery: { reason: "collaborator" },
    },
  };
  const report = { entries: [entry] };
  const original = {
    latestExecutionSummary: { summary: "colaborador", usageReport: report },
    usage: { timeline: { items: [{ usageReport: report }] } },
    recentEvents: {
      items: [{ data: { actorRole: "collaborator", collaboratorCount: 99 } }],
    },
  };
  const projected = fromLegacyWorker(
    "/tasks/t/overview",
    original,
  ) as typeof original;
  expect(
    projected.latestExecutionSummary.usageReport.entries[0].observation
      .actorRole,
  ).toBe("worker");
  expect(
    projected.usage.timeline.items[0].usageReport.entries[0].observation
      .actorRole,
  ).toBe("worker");
  expect(projected.latestExecutionSummary.summary).toBe("colaborador");
  expect(projected.recentEvents).toBe(original.recentEvents);
  expect(
    projected.latestExecutionSummary.usageReport.entries[0].evidenceKey,
  ).toBe("same-hash");
  expect(
    projected.latestExecutionSummary.usageReport.entries[0].observation
      .evidenceId,
  ).toBe("collaborator-evidence");
  expect(
    original.latestExecutionSummary.usageReport.entries[0].observation
      .actorRole,
  ).toBe("collaborator");
  const interval = {
    counters: [{ segments: [{ start: entry, latest: entry }] }],
  };
  const intervals = fromLegacyWorker("/tasks/t/execution-intervals", {
    items: [interval],
  }) as { items: (typeof interval)[] };
  expect(
    intervals.items[0].counters[0].segments[0].latest.observation.actorRole,
  ).toBe("worker");
  const revisions = fromLegacyWorker(
    "/tasks/t/execution-intervals/i/revisions",
    { items: [{ interval }] },
  ) as { items: { interval: typeof interval }[] };
  expect(
    revisions.items[0].interval.counters[0].segments[0].start.observation
      .actorRole,
  ).toBe("worker");
});
it("keeps canonical null authoritative when a legacy response also includes the old key", () => {
  expect(
    fromLegacyWorker("/agents/a", {
      bindings: { workerTeamId: null, collaboratorTeamId: "old" },
    }),
  ).toEqual({ bindings: { workerTeamId: null } });
});
it("adapts legacy structured roles, fields and writes without rewriting authored data", async () => {
  const original = {
    id: "t",
    name: "Collaborator",
    description: "colaborador",
    collaboratorCount: 2,
    collaboratorIconId: "wrench",
    roleIcons: { collaborator: { id: "wrench" } },
  };
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith("/info")) return json({}, 404);
    if (url.includes("/agents"))
      return json({
        items: [
          {
            bindings: { collaboratorTeamId: "t", leaderTeamId: null },
            name: "Collaborator",
          },
        ],
      });
    if (url.endsWith("/members"))
      return json({ items: [{ role: "collaborator", agentId: "a" }] });
    return json(original);
  });
  const api = createHttpApi({ fetch: fetcher as typeof fetch });
  expect(await api.get("teams", "t")).toEqual({
    id: "t",
    name: "Collaborator",
    description: "colaborador",
    workerCount: 2,
    workerIconId: "wrench",
    roleIcons: { worker: { id: "wrench" } },
  });
  expect(
    (await api.list("agents", "", { role: "worker" })).items[0].bindings
      .workerTeamId,
  ).toBe("t");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
    "/api/v1/agents?role=collaborator",
  );
  expect((await api.list("members", "t")).items[0].role).toBe("worker");
  await api.patch(
    "teams",
    "t",
    { name: "Collaborator", workerIconId: "music" },
    7,
  );
  expect(JSON.parse(fetcher.mock.calls.at(-1)?.[1]?.body as string)).toEqual({
    name: "Collaborator",
    collaboratorIconId: "music",
  });
  expect(
    new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers).get("If-Match"),
  ).toBe('"7"');
  expect(original.collaboratorCount).toBe(2);
});
it("retains verified v2 across transient discovery failures and refreshes from legacy", async () => {
  let state = 404;
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/info") ? json(modern, state) : json({}),
  );
  const api = createHttpApi({ fetch: fetcher as typeof fetch });
  await api.get("teams", "t");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v1/teams/t");
  state = 200;
  await api.info();
  await api.get("teams", "t");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v2/teams/t");
  state = 503;
  await expect(api.info()).rejects.toMatchObject({ status: 503 });
  await api.get("teams", "t");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/v2/teams/t");
});
