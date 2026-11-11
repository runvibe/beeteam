import { expect, it } from "vitest";
import { movePanel, type WorkspacePanel } from "./workspace-layout";

const initial: WorkspacePanel[] = ["sessions", "content", "chat"];

it.each([
  ["sessions", 1, ["content", "sessions", "chat"]],
  ["sessions", 2, ["content", "chat", "sessions"]],
  ["content", 0, ["content", "sessions", "chat"]],
  ["content", 2, ["sessions", "chat", "content"]],
  ["chat", 0, ["chat", "sessions", "content"]],
  ["chat", 1, ["sessions", "chat", "content"]],
] satisfies [WorkspacePanel, number, WorkspacePanel[]][])(
  "moves %s to visible position %i",
  (panel, position, expected) => {
    expect(movePanel(initial, panel, initial, position)).toEqual(expected);
    expect(initial).toEqual(["sessions", "content", "chat"]);
  },
);

it("keeps a hidden panel in place when the visible panel is not moved", () => {
  const order: WorkspacePanel[] = ["chat", "sessions", "content"];
  expect(movePanel(order, "chat", ["chat", "content"], 0)).toEqual(order);
});

it("keeps hidden panels while rearranging visible panels", () => {
  expect(movePanel(initial, "sessions", ["sessions", "content"], 1)).toEqual([
    "content",
    "sessions",
    "chat",
  ]);
});

it("rejects malformed or out-of-range moves", () => {
  expect(() => movePanel(initial, "chat", ["sessions", "content"], 0)).toThrow(
    "Invalid workspace panel move",
  );
  expect(() => movePanel(initial, "chat", initial, 3)).toThrow(
    "Invalid workspace panel move",
  );
  expect(() =>
    movePanel(["chat", "chat", "content"], "chat", initial, 0),
  ).toThrow("Invalid workspace panel move");
});
