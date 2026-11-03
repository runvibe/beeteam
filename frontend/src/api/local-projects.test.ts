import { expect, it, vi } from "vitest";
import { createHttpApi } from "./http";
import { createMockApi } from "./mock";

it("sends only the registered key and enumerated application with an explicit local-action header", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          projectKey: "a b",
          application: "vscode",
          outcome: "requested",
        }),
        { status: 202 },
      ),
    );
  const api = createHttpApi({ fetch: fetcher });
  await api.openProject("task-id", "a b", "vscode");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("/api/v1/tasks/task-id/projects/a%20b/open");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual({ application: "vscode" });
  expect(options.headers.get("X-Bee-Local-Action")).toBe("open-project");
});

it("does not simulate local launch in demonstration mode", async () => {
  await expect(
    createMockApi({ delay: 0 }).openProject("task", "app", "explorer"),
  ).rejects.toMatchObject({ code: "local_action_unavailable" });
});
