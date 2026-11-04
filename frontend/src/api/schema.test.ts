// @vitest-environment node
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, it, expect } from "vitest";
import { makeSeed, ids } from "./seed";
import { createMockApi } from "./mock";
const schemas: Record<string, string> = {
  boards: "Board",
  tasks: "Task",
  statuses: "Status",
  plans: "PlanRevision",
  comments: "Comment",
  attachments: "Attachment",
  summaries: "ExecutionSummary",
  timeline: "Event",
  agents: "Agent",
  teams: "Team",
  chats: "ChatReference",
};
describe("OpenAPI response conformance", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const domain of ["kanban", "ra"]) {
    const doc = parse(readFileSync(`contracts/${domain}-openapi.yaml`, "utf8"));
    ajv.addSchema({ $id: domain, components: doc.components });
  }
  for (const [resource, schema] of Object.entries(schemas))
    it(`${resource} fixtures match exact schema`, () => {
      const domain = ["agents", "teams", "chats"].includes(resource)
        ? "ra"
        : "kanban";
      const validate = ajv.getSchema(
        `${domain}#/components/schemas/${schema}`,
      )!;
      for (const row of makeSeed()[
        resource as keyof ReturnType<typeof makeSeed>
      ])
        expect(validate(row), JSON.stringify(validate.errors)).toBe(true);
    });
  it("requires project-only input for creation and keeps discovery server-owned", () => {
    const validate = ajv.getSchema("kanban#/components/schemas/CreateTask")!;
    const task = makeSeed().tasks[0];
    const input = {
      title: "Task",
      authorAgentId: task.authorAgentId,
      executorAgentId: task.executorAgentId,
      coordinationContext: {
        mode: "manual",
        conversationRef: "conversation",
        approvalRef: "approved",
      },
    };
    const project = { key: "app", name: "App", rootPath: "C:/worktrees/app" };
    expect(validate(input)).toBe(false);
    expect(
      validate({ ...input, workScope: { projects: [project] } }),
      JSON.stringify(validate.errors),
    ).toBe(true);
    for (const workScope of [
      { projects: [] },
      { projects: [project], repositories: [] },
      { projects: [project], status: "identified" },
      { projects: [{ ...project, discovery: { status: "not_git" } }] },
    ])
      expect(validate({ ...input, workScope })).toBe(false);
    const patch = ajv.getSchema("kanban#/components/schemas/PatchTask")!;
    expect(patch({ workScope: { projects: [project] } })).toBe(true);
    expect(
      patch({ workScope: { projects: [project], repositories: [] } }),
    ).toBe(false);
  });
  it("does not simulate local Git discovery in the demo adapter", async () => {
    const task = makeSeed().tasks[0];
    const api = createMockApi({ delay: 0 });
    await expect(
      api.patch(
        "tasks",
        task.id,
        {
          workScope: {
            projects: [{ key: "app", name: "App", rootPath: "C:/app" }],
          },
        },
        task.version,
      ),
    ).rejects.toMatchObject({ status: 501 });
    expect((await api.get("tasks", task.id)).workScope).toBeUndefined();
  });
  it("requires a non-null usage report when recording a new summary", () => {
    const validate = ajv.getSchema(
      "kanban#/components/schemas/RecordExecution",
    )!;
    const summary = makeSeed().summaries[0];
    const input = {
      currentSummary: "Current work synthesis",
      summary: summary.summary,
      outcome: summary.outcome,
      statusId: summary.statusId,
      deliverables: summary.deliverables,
      pending: summary.pending,
      executionContext: summary.executionContext,
    };
    expect(validate(input)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "required",
          params: { missingProperty: "usageReport" },
        }),
      ]),
    );
    expect(validate({ ...input, usageReport: null })).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: "/usageReport",
          keyword: "type",
        }),
      ]),
    );
  });
  it("bounds new usage reports while accepting historical missing reports", () => {
    const validate = ajv.getSchema(
      "kanban#/components/schemas/SummaryUsageInput",
    )!;
    expect(validate({ entries: [] })).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "minItems" }),
      ]),
    );
    expect(validate({ entries: Array.from({ length: 33 }, () => ({})) })).toBe(
      false,
    );
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "maxItems" }),
      ]),
    );
    const legacy = ajv.getSchema(
      "kanban#/components/schemas/ExecutionSummary",
    )!;
    const summary = makeSeed().summaries[0];
    expect(legacy(summary), JSON.stringify(legacy.errors)).toBe(true);
    expect(
      legacy({ ...summary, usageReport: null }),
      JSON.stringify(legacy.errors),
    ).toBe(true);
  });
  it("requires measured cumulative session/model/agent/total for new summaries while preserving legacy reads", () => {
    const observation = {
      source: "codex",
      harness: "codex",
      surface: "desktop",
      harnessVersion: null,
      sessionId: "session",
      epoch: "epoch",
      evidenceId: "first",
      previousEvidenceId: null,
      actor: { kind: "agent", id: makeSeed().agents[0].id },
      actorRole: "collaborator",
      provider: null,
      modelId: "model",
      scope: "session",
      reportKind: "cumulative_snapshot",
      quality: "measured",
      attribution: "shared",
      observedAt: "2026-11-02T20:00:00Z",
      periodStart: null,
      periodEnd: null,
      inputTokens: "100",
      outputTokens: "20",
      cachedInputTokens: "50",
      reasoningOutputTokens: "10",
      totalTokens: "120",
      discovery: null,
    };
    const validate = ajv.getSchema(
      "kanban#/components/schemas/RecordExecution",
    )!;
    const row = makeSeed().summaries[0];
    const input = {
      currentSummary: "Work",
      commitReport: { hasCommits: false, commits: [] },
      summary: row.summary,
      outcome: row.outcome,
      statusId: row.statusId,
      deliverables: row.deliverables,
      pending: row.pending,
      executionContext: row.executionContext,
      usageReport: { entries: [observation] },
    };
    expect(validate(input), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...input, commitReport: undefined })).toBe(false);
    expect(
      validate({ ...input, commitReport: { hasCommits: true, commits: [] } }),
    ).toBe(false);
    for (const patch of [
      { totalTokens: undefined },
      { totalTokens: null },
      { modelId: null },
      { modelId: "" },
      { actor: { kind: "human", id: null } },
      { quality: "estimated" },
      { scope: "request" },
      { reportKind: "period_delta" },
    ]) {
      expect(
        validate({
          ...input,
          usageReport: { entries: [{ ...observation, ...patch }] },
        }),
      ).toBe(false);
    }
    expect(
      validate({
        ...input,
        usageReport: { entries: [{ ...observation, scope: "session_tree" }] },
      }),
    ).toBe(true);
    const legacy = ajv.getSchema(
      "kanban#/components/schemas/UsageObservation",
    )!;
    const { totalTokens, ...old } = observation;
    expect(
      legacy({ ...old, modelId: null, actor: { kind: "human", id: null } }),
    ).toBe(true);
  });
  it("keeps execution tracking additive and permits a paused finish without a fabricated interval", () => {
    const validate = ajv.getSchema(
      "kanban#/components/schemas/ExecutionSummary",
    )!;
    const row = makeSeed().summaries[0];
    expect(validate(row)).toBe(true);
    expect(
      validate({
        ...row,
        executionTracking: {
          action: "finish",
          executionId: row.id,
          intervalId: null,
          executionState: "finished",
          intervalState: null,
        },
      }),
      JSON.stringify(validate.errors),
    ).toBe(true);
    const usage = ajv.getSchema(
      "kanban#/components/schemas/TaskExecutionIntervalUsage",
    )!;
    const empty = {
      validTotalTokens: null,
      partialTotalTokens: null,
      observedDurationMs: null,
      elapsedDurationMs: null,
      coverage: {
        totalIntervals: 0,
        validIntervals: 0,
        openIntervals: 0,
        incompleteIntervals: 0,
        invalidIntervals: 0,
        untrackedSummaries: 1,
      },
    };
    expect(usage(empty)).toBe(true);
    expect(
      usage({ ...empty, validTotalTokens: "0", observedDurationMs: "0" }),
    ).toBe(true);
    expect(usage({ ...empty, validTotalTokens: "-1" })).toBe(false);
  });
  it("projections conform after querying", async () => {
    const api = createMockApi({ delay: 0 });
    for (const [schema, value] of [
      [
        "ra#/components/schemas/ActivityLinkPage",
        await api.list("activities", ids.agent),
      ],
      ["kanban#/components/schemas/BoardView", await api.board(ids.board)],
    ] as const) {
      const validate = ajv.getSchema(schema)!;
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    }
  });
});
