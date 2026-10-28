import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";
import { QueryState } from "./shared";
import { useState } from "react";
function Draft() {
  const [value, set] = useState("");
  return (
    <input
      aria-label="Draft"
      value={value}
      onChange={(e) => set(e.target.value)}
    />
  );
}
it("keeps mounted drafts and focus when a background request fails and recovers", async () => {
  const q = {
    isPending: false,
    error: null as unknown,
    data: {},
    refetch: () => {},
  };
  const view = render(
    <QueryState query={q}>
      <Draft />
    </QueryState>,
  );
  const input = screen.getByLabelText("Draft");
  await userEvent.type(input, "unsaved");
  view.rerender(
    <QueryState query={{ ...q, error: new Error("offline") }}>
      <Draft />
    </QueryState>,
  );
  expect(screen.getByLabelText("Draft")).toBe(input);
  expect(input).toHaveValue("unsaved");
  expect(input).toHaveFocus();
  view.rerender(
    <QueryState query={q}>
      <Draft />
    </QueryState>,
  );
  expect(screen.getByLabelText("Draft")).toBe(input);
  expect(input).toHaveFocus();
});
