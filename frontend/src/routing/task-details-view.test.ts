import { expect, it, vi } from "vitest";
import { openTaskDetails, closeTaskDetails } from "./task-details-view";
it("returns through history for equivalent query encodings", () => {
  window.history.replaceState({ bee: true, index: 2 }, "", "/tasks/example?tab=comments&from=/boards");
  openTaskDetails();
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  closeTaskDetails();
  expect(back).toHaveBeenCalledOnce();
  back.mockRestore();
});
it("direct entry removes only the details view using replacement", () => {
  window.history.replaceState({}, "", "/tasks/example?tab=comments&from=/boards&task.view=details");
  const length = window.history.length;
  closeTaskDetails();
  expect(new URLSearchParams(location.search).get("tab")).toBe("comments");
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
  expect(new URLSearchParams(location.search).has("task.view")).toBe(false);
  expect(window.history.length).toBe(length);
});
