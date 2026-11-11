import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";
import { normalizeGroupBy, useSessionsSidebar } from "@/state/sessions-sidebar";
import { SessionsSidebar, SessionsToggle } from "./sessions-sidebar";

const api = vi.hoisted(() => ({
  sessions: vi.fn(),
  managed: true,
}));
const lists: Record<string, { id: string; name: string; leaderId?: string; teamId?: string }[]> = {
  teams: [
    { id: "t1", name: "Alpha", leaderId: "l1" },
    { id: "t2", name: "Beta", leaderId: "l2" },
  ],
  agents: [
    { id: "l1", name: "Ana" },
    { id: "l2", name: "Bruno" },
  ],
  boards: [{ id: "b1", name: "Roadmap", teamId: "t1" }],
};
vi.mock("@/api/context", () => ({
  useApi: () => ({
    managedAgents: api.managed ? { sessions: api.sessions } : undefined,
  }),
  useList: (resource: string) => ({ data: { items: lists[resource] } }),
}));

const item = (
  id: string,
  title: string,
  teamId: string,
  agentId: string,
  boardId: string | null,
) => ({
  id,
  title,
  teamId,
  agentId,
  boardId,
  updatedAt: "2026-01-01T00:00:00Z",
});

function renderSidebar() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SessionsToggle />
      <SessionsSidebar />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setLocalePreference("en");
  api.managed = true;
  localStorage.clear();
  useSessionsSidebar.setState({
    open: true,
    drawer: false,
    search: "",
    sort: "updated_desc",
    groupBy: ["team"],
    filters: { teamIds: [], boardIds: [], agentIds: [] },
  });
  useChatPanel.setState({ teamId: null, conversationId: null, open: false });
  api.sessions.mockReset();
  api.sessions.mockResolvedValue({
    items: [
      item("c1", "Plan sprint", "t1", "l1", "b1"),
      item("c2", "Triage bugs", "t2", "l2", null),
      item("c3", "Retro notes", "t1", "l1", null),
    ],
    nextCursor: null,
  });
});

it("lists sessions grouped by team and opens the chosen conversation", async () => {
  renderSidebar();
  const sidebar = screen.getByRole("complementary", { name: "Sessions" });
  const alpha = await within(sidebar).findByRole("button", { name: /Team\s*Alpha\s*2/ });
  expect(alpha).toHaveAttribute("aria-expanded", "true");
  expect(within(sidebar).getByText("Roadmap")).toBeInTheDocument();
  await userEvent.click(within(sidebar).getByRole("button", { name: /Retro notes/ }));
  expect(useChatPanel.getState()).toMatchObject({ teamId: "t1", conversationId: "c3", open: true });
  expect(within(sidebar).getByRole("button", { name: /Retro notes/ })).toHaveAttribute("aria-current", "true");
  await userEvent.click(alpha);
  expect(within(sidebar).queryByText("Plan sprint")).toBeNull();
  expect(api.sessions).toHaveBeenCalledWith(
    expect.objectContaining({ sort: "updated_desc", limit: 50, teamIds: [] }),
  );
});

it("searches, sorts and filters through the API", async () => {
  renderSidebar();
  await screen.findByText("Plan sprint");
  await userEvent.type(screen.getByRole("searchbox", { name: "Search sessions" }), "triage");
  expect(screen.queryByText("Plan sprint")).toBeNull();
  expect(screen.getByText("Triage bugs")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Sort: Recently updated first/ }));
  await waitFor(() =>
    expect(api.sessions).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "updated_asc" })),
  );
  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  const filters = await screen.findByRole("dialog", { name: "Filters" });
  await userEvent.click(within(filters).getByRole("checkbox", { name: "Beta" }));
  await userEvent.click(within(filters).getByRole("checkbox", { name: "No board" }));
  await userEvent.click(within(filters).getByRole("checkbox", { name: "Bruno" }));
  await waitFor(() =>
    expect(api.sessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ teamIds: ["t2"], boardIds: ["none"], agentIds: ["l2"] }),
    ),
  );
  expect(within(filters).queryByRole("checkbox", { name: "Roadmap" })).toBeNull();
  await userEvent.click(within(filters).getByRole("button", { name: "Clear filters" }));
  expect(useSessionsSidebar.getState().filters.teamIds).toEqual([]);
});

it("edits nested grouping up to three levels and persists it", async () => {
  renderSidebar();
  await screen.findByText("Plan sprint");
  await userEvent.click(screen.getByRole("button", { name: "Group by" }));
  const editor = await screen.findByRole("dialog", { name: "Group by" });
  await userEvent.selectOptions(within(editor).getByRole("combobox", { name: "Add level" }), "board");
  await userEvent.selectOptions(within(editor).getByRole("combobox", { name: "Add level" }), "agent");
  expect(within(editor).queryByRole("combobox", { name: "Add level" })).toBeNull();
  await userEvent.click(within(editor).getByRole("button", { name: "Move Agent up" }));
  expect(useSessionsSidebar.getState().groupBy).toEqual(["team", "agent", "board"]);
  expect(JSON.parse(localStorage.getItem("beeteam-sessions-sidebar")!).state.groupBy).toEqual([
    "team",
    "agent",
    "board",
  ]);
  expect(screen.getByRole("button", { name: /Agent\s*Ana\s*2/ })).toBeInTheDocument();
  await userEvent.click(within(editor).getByRole("button", { name: "Remove level Team" }));
  expect(useSessionsSidebar.getState().groupBy).toEqual(["agent", "board"]);
  expect(normalizeGroupBy(["team", "team", "x", "board", "agent", "board"])).toEqual([
    "team",
    "board",
    "agent",
  ]);
});

it("shows empty and error states", async () => {
  api.sessions.mockResolvedValueOnce({ items: [], nextCursor: null });
  const view = renderSidebar();
  expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument();
  view.unmount();
  api.sessions.mockRejectedValueOnce(new Error("down"));
  renderSidebar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Sessions could not be loaded.");
});

it("toggles the column and hides everything without managed sessions", async () => {
  const view = renderSidebar();
  const toggle = screen.getByRole("button", { name: "Show or hide sessions" });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await userEvent.click(toggle);
  expect(useSessionsSidebar.getState().open).toBe(false);
  expect(screen.getByRole("complementary", { hidden: true })).toHaveAttribute("data-open", "false");
  view.unmount();
  api.managed = false;
  renderSidebar();
  expect(screen.queryByRole("button", { name: "Show or hide sessions" })).toBeNull();
  expect(screen.queryByRole("complementary", { hidden: true })).toBeNull();
});
