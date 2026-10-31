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
  it("projections conform after querying", async () => {
    const api = createMockApi({ delay: 0 });
    for (const [schema, value] of [
      [
        "ra#/components/schemas/ActivityLinkPage",
        await api.list("activities", ids.agent),
      ],
      ["ra#/components/schemas/ResumeContext", await api.resume(ids.agent)],
      ["kanban#/components/schemas/BoardView", await api.board(ids.board)],
    ] as const) {
      const validate = ajv.getSchema(schema)!;
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    }
  });
});
