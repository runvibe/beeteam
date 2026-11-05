import { afterEach, expect, it } from "vitest";
import { canonicalizeEntry, currentUrl, demoHref, navigate } from "./location";

afterEach(() => history.replaceState(null, "", "/"));

it("keeps the landing at root and preserves legacy task context", () => {
  canonicalizeEntry();
  expect(location.pathname).toBe("/");
  history.replaceState(null, "", "/tasks/example?tab=plans#details");
  canonicalizeEntry();
  expect(location.pathname + location.search + location.hash).toBe("/app/tasks/example?tab=plans#details");
  expect(currentUrl()).toBe("/tasks/example?tab=plans");
  expect(demoHref("/boards")).toBe("/app/boards");
  navigate("/home");
  expect(location.pathname).toBe("/app/");
  navigate("/");
  expect(location.pathname).toBe("/");
});
