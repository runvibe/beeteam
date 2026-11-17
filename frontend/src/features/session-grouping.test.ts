import { expect, it } from "vitest";
import type { ManagedConversation } from "@/api/managed-agents";
import { groupSessions, matchesSearch } from "./session-grouping";

const session = (
  id: string,
  teamId: string,
  boardId: string | null,
  agentId = "leader",
) =>
  ({ id, title: `Session ${id}`, teamId, boardId, agentId }) as ManagedConversation;
const names = {
  team: (id: string) => `Team ${id}`,
  board: (id: string | null) => (id ? `Board ${id}` : "No board"),
  agent: (id: string) => `Agent ${id}`,
};

it("nests groups in the requested order and keeps the server order", () => {
  const items = [
    session("1", "b", "x"),
    session("2", "a", null),
    session("3", "b", null),
    session("4", "b", "x"),
  ];
  const tree = groupSessions(items, ["team", "board"], names);
  expect(tree.map((group) => [group.key, group.label, group.count])).toEqual([
    ["team:b", "Team b", 3],
    ["team:a", "Team a", 1],
  ]);
  expect(tree[0].items).toEqual([]);
  expect(tree[0].groups.map((group) => [group.key, group.label])).toEqual([
    ["team:b/board:x", "Board x"],
    ["team:b/board:none", "No board"],
  ]);
  expect(tree[0].groups[0].items.map((item) => item.id)).toEqual(["1", "4"]);
});

it("supports three levels and no grouping", () => {
  const items = [session("1", "a", "x", "l1"), session("2", "a", "x", "l2")];
  const tree = groupSessions(items, ["board", "team", "agent"], names);
  expect(tree[0].groups[0].groups.map((group) => group.key)).toEqual([
    "board:x/team:a/agent:l1",
    "board:x/team:a/agent:l2",
  ]);
  expect(groupSessions(items, [], names)).toEqual([]);
});

it("matches titles case-insensitively", () => {
  expect(matchesSearch(session("Plan", "a", null), "  plan ")).toBe(true);
  expect(matchesSearch(session("1", "a", null), "nope")).toBe(false);
  expect(matchesSearch(session("1", "a", null), "")).toBe(true);
});
