import { replaceCanonicalUrl } from "./location";
import { it, expect } from "vitest";
import { canonicalUrl } from "./canonical-url";
it("replaces only entity route segments and nested return origins, preserving query", () => {
  const origin = "/agents/old?agent.tab=activities&activities.offset=20";
  const url = `/agents/old/settings?from=${encodeURIComponent(origin)}&agents.teamId=old`;
  const result = new URL(
    canonicalUrl(url, "agents", "old", "lia"),
    "http://localhost",
  );
  expect(result.pathname).toBe("/agents/lia/settings");
  expect(result.searchParams.get("from")).toBe(
    "/agents/lia?agent.tab=activities&activities.offset=20",
  );
  expect(result.searchParams.get("agents.teamId")).toBe("old");
  expect(
    canonicalUrl("/boards/old?kanban.executor=old", "agents", "old", "lia"),
  ).toBe("/boards/old?kanban.executor=old");
});
it("does not reinterpret external origins", () => {
  const url =
    "/tasks/old?from=" + encodeURIComponent("https://example.com/tasks/old");
  expect(
    new URL(
      canonicalUrl(url, "tasks", "old", "mapear"),
      "http://localhost",
    ).searchParams.get("from"),
  ).toBe("https://example.com/tasks/old");
});

it("canonical replacement preserves navigation history indexes", () => {
  window.history.replaceState(
    { bee: true, index: 4, returnIndex: 1, returnUrl: "/agents/old" },
    "",
    "/tasks/old?from=%2Fagents%2Fold",
  );
  const count = window.history.length;
  replaceCanonicalUrl("/tasks/mapear?from=%2Fagents%2Flia&tab=plans");
  expect(window.history.length).toBe(count);
  expect(window.history.state).toMatchObject({
    index: 4,
    returnIndex: 1,
    returnUrl: "/agents/lia",
  });
  expect(location.search).toContain("tab=plans");
});
