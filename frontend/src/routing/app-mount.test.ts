import { afterEach, expect, it } from "vitest";
import { canonicalizeEntry, currentUrl, safeOrigin, navigationHref, navigate } from "./location";

afterEach(() => history.replaceState(null, "", "/"));

it("opens the app at root and preserves legacy task context", () => {
  canonicalizeEntry();
  expect(location.pathname).toBe("/app/");
  history.replaceState(null, "", "/tasks/example?tab=plans#details");
  canonicalizeEntry();
  expect(location.pathname + location.search + location.hash).toBe("/app/tasks/example?tab=plans#details");
  expect(currentUrl()).toBe("/tasks/example?tab=plans");
  expect(navigationHref("/boards")).toBe("/app/boards");
  navigate("/home");
  expect(location.pathname).toBe("/app/");
  navigate("/");
  expect(location.pathname).toBe("/");
});

it("accepts and preserves a root-route return destination", () => {
  expect(safeOrigin("/?intro=1&boards.name=Launch")).toBe(
    "/?intro=1&boards.name=Launch",
  );
  expect(safeOrigin("//external.test/?intro=1")).toBeNull();
});

it("removes retired demo flags while keeping application routes", () => {
  history.replaceState(null, "", "/app/boards?demo=1&returnTo=%2Fagents");
  canonicalizeEntry();
  expect(location.pathname + location.search + location.hash).toBe("/app/boards?returnTo=%2Fagents");
});
