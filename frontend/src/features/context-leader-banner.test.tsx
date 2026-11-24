import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import type { BeeApi } from "@/api/types";
import { setLocalePreference } from "@/i18n";
import { navigate } from "@/routing/location";
import { useChatPanel } from "@/state/chat-panel";
import { ContextLeaderBanner } from "./context-leader-banner";

const ids = { task: "01900000-0000-7000-8000-000000000001", team: "01900000-0000-7000-8000-000000000002" };
function setup(path = "/boards/board") {
  const rows: Record<string, Record<string, unknown>> = {
    tasks: { [ids.task]: { id: ids.task, slug: "task-alias", title: "Fix login", boardId: "board" } },
    boards: { board: { id: "board", name: "Product", teamId: ids.team } },
    teams: { [ids.team]: { id: ids.team, slug: "team-alias", name: "Builders", leaderId: "leader" } },
    agents: { leader: { id: "leader", name: "Ada" } },
  };
  const sessions = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
  const api = {
    get: vi.fn(async (kind: string, id: string) => rows[kind]?.[id]),
    resolveSlug: vi.fn(async (kind: string) => ({ id: kind === "tasks" ? ids.task : ids.team })),
    managedAgents: { sessions, send: vi.fn() },
  };
  navigate(path);
  const view = (leader = "other") => <ApiProvider api={api as unknown as BeeApi}><ContextLeaderBanner currentLeaderId={leader} /></ApiProvider>;
  return { api, rows, sessions, view };
}
beforeEach(() => {
  setLocalePreference("en");
  useChatPanel.setState({ contentOpen: true, teamId: "old-team", conversationId: "saved", freshConversation: false });
});
it.each(["/boards/board", "/teams/team-alias", "/tasks/task-alias"])("resolves %s without changing chat or writing", async (path) => {
  const { view, api, sessions } = setup(path);
  render(view());
  expect(await screen.findByRole("button", { name: "New conversation" })).toBeVisible();
  expect(screen.getByText(/Builders.*Ada/)).toBeVisible();
  expect(sessions).toHaveBeenCalledWith(expect.objectContaining({ teamIds: [ids.team], agentIds: ["leader"], sort: "updated_desc" }));
  if (path.includes("alias")) expect(api.resolveSlug).toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("alias"));
  expect(useChatPanel.getState().conversationId).toBe("saved");
  expect(api.managedAgents.send).not.toHaveBeenCalled();
});
it("paginates past invalid sessions and continues only the matching writable session", async () => {
  const { view, sessions, api } = setup();
  sessions.mockResolvedValueOnce({ items: [
    { id: "wrong", teamId: "elsewhere", agentId: "leader", readOnly: false },
    { id: "old-leader", teamId: ids.team, agentId: "other", readOnly: false },
    { id: "readonly", teamId: ids.team, agentId: "leader", readOnly: true },
  ], nextCursor: "next" }).mockResolvedValueOnce({ items: [{ id: "valid", teamId: ids.team, agentId: "leader", readOnly: false }], nextCursor: null });
  render(view());
  fireEvent.click(await screen.findByRole("button", { name: "Continue latest conversation" }));
  expect(sessions).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "next" }));
  expect(useChatPanel.getState()).toMatchObject({ teamId: ids.team, conversationId: "valid" });
  expect(api.managedAgents.send).not.toHaveBeenCalled();
});
it("offers a lazy new conversation when no valid session exists", async () => {
  const { view, api } = setup(); render(view());
  fireEvent.click(await screen.findByRole("button", { name: "New conversation" }));
  expect(screen.queryByRole("button", { name: "Continue latest conversation" })).toBeNull();
  expect(useChatPanel.getState()).toMatchObject({ teamId: ids.team, conversationId: null, freshConversation: true });
  expect(api.managedAgents.send).not.toHaveBeenCalled();
});
it("dismisses for this visit and shows again after leaving and revisiting", async () => {
  const { view } = setup(); render(view());
  fireEvent.click(await screen.findByRole("button", { name: "Dismiss leader suggestion" }));
  expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
  act(() => navigate("/boards"));
  act(() => navigate("/boards/board"));
  expect(await screen.findByRole("button", { name: "New conversation" })).toBeVisible();
});
it.each(["/home", "/boards", "/teams", "/agents/person"])("does not suggest on %s", async path => {
  const { view, sessions } = setup(path); render(view());
  await act(async () => {});
  expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
  expect(sessions).not.toHaveBeenCalled();
});
it("suppresses matching leaders and hidden content", async () => {
  const { view } = setup(); const mounted = render(view("leader"));
  await act(async () => {});
  expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
  mounted.rerender(view());
  await screen.findByRole("button", { name: "New conversation" });
  act(() => useChatPanel.setState({ contentOpen: false }));
  expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
});
it.each(["tasks", "boards", "teams", "agents"].flatMap(kind => ["archivedAt", "deletedAt", "missing"].map(state => [kind, state])))("suppresses %s that is %s in the ownership chain", async (kind, state) => {
  const { view, rows } = setup("/tasks/task-alias");
  const key = Object.keys(rows[kind])[0];
  if (state === "missing") delete rows[kind][key];
  else rows[kind][key] = { ...(rows[kind][key] as object), [state]: "2026-01-01" };
  render(view()); await act(async () => {});
  expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
});
it("keeps fast route changes scoped to the new team when old session reads finish", async () => {
  const { view, sessions, rows } = setup();
  rows.boards.second = { id: "second", name: "Second board", teamId: "second-team" };
  rows.teams["second-team"] = { id: "second-team", name: "Second team", leaderId: "second-leader" };
  rows.agents["second-leader"] = { id: "second-leader", name: "Bea" };
  let complete!: (value: unknown) => void;
  sessions.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue({ items: [], nextCursor: null });
  render(view());
  await waitFor(() => expect(sessions).toHaveBeenCalledTimes(1));
  act(() => navigate("/boards/second"));
  await screen.findByText(/Second board.*Bea/);
  await act(async () => complete({ items: [{ id: "old-result", teamId: ids.team, agentId: "leader", readOnly: false }], nextCursor: null }));
  expect(screen.queryByRole("button", { name: "Continue latest conversation" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
  expect(useChatPanel.getState()).toMatchObject({ teamId: "second-team", freshConversation: true });
});
it("does not surface a late session result after navigating away", async () => {
  const { view, sessions } = setup();
  let complete!: (value: unknown) => void;
  sessions.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  render(view()); await waitFor(() => expect(sessions).toHaveBeenCalled());
  act(() => navigate("/home"));
  await act(async () => complete({ items: [{ id: "late", teamId: ids.team, agentId: "leader", readOnly: false }], nextCursor: null }));
  expect(screen.queryByRole("button", { name: "Continue latest conversation" })).toBeNull();
  expect(useChatPanel.getState().conversationId).toBe("saved");
});
