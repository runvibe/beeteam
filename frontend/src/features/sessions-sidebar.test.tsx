import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/types";
import { setLocalePreference } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";
import { normalizeGroupBy, useSessionsSidebar } from "@/state/sessions-sidebar";
import { SessionsSidebar, SessionsToggle } from "./sessions-sidebar";

const api = vi.hoisted(() => ({
  sessions: vi.fn(),
  get: vi.fn(),
  listErrors: {} as Record<string, Error>,
  listRefetch: vi.fn(),
  managed: true,
}));
type ListItem = { id: string; name: string; leaderId?: string; teamId?: string; archivedAt?: string | null };
const lists: Record<string, ListItem[]> = {
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
    get: api.get,
  }),
  useList: (
    resource: string,
    _scope: string,
    filters: { offset?: number; limit?: number; name?: string; teamId?: string; archived?: boolean } = {},
  ) => {
    const all = lists[resource].filter((entry) =>
      (!filters.name || entry.name.toLowerCase().includes(filters.name.toLowerCase())) &&
      (!filters.teamId || entry.teamId === filters.teamId) &&
      Boolean(entry.archivedAt) === Boolean(filters.archived),
    );
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    const items = all.slice(offset, offset + limit);
    const hasMore = offset + items.length < all.length;
    const error = api.listErrors[resource] ?? null;
    return {
      data: error ? undefined : { items, offset, limit, total: all.length, hasMore, nextOffset: hasMore ? offset + items.length : null },
      isPending: false,
      error,
      refetch: () => api.listRefetch(resource),
    };
  },
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
  api.listErrors = {};
  api.listRefetch.mockReset().mockResolvedValue({});
  api.get.mockReset().mockImplementation(async (resource: string, id: string) => {
    const result = lists[resource]?.find((entry) => entry.id === id);
    if (!result) throw new Error("Missing resource");
    return result;
  });
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
  expect(within(filters).getByRole("checkbox", { name: "Roadmap" })).toBeVisible();
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

it("opens a mobile drawer and closes it when a conversation is selected", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  try {
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Show or hide sessions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("complementary", { name: "Sessions" })).toHaveAttribute("data-drawer", "true");
    await userEvent.click(await screen.findByRole("button", { name: /Plan sprint/ }));
    expect(useChatPanel.getState()).toMatchObject({ teamId: "t1", conversationId: "c1", open: true });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(useSessionsSidebar.getState().drawer).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("updates the toggle state when the viewport crosses the drawer breakpoint", () => {
  let narrow = false;
  vi.stubGlobal("matchMedia", () => ({ matches: narrow }));
  try {
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Show or hide sessions" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    narrow = true;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("offers an agent filter for a session created by a previous leader", async () => {
  lists.agents.push({ id: "former", name: "Former leader" });
  try {
    api.sessions.mockResolvedValue({
      items: [item("historic", "Past work", "t1", "former", null)],
      nextCursor: null,
    });
    renderSidebar();
    await screen.findByText("Past work");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(await screen.findByRole("checkbox", { name: "Former leader" })).toBeInTheDocument();
  } finally {
    lists.agents.pop();
  }
});

it("searches agent filter options beyond the first page", async () => {
  const count = lists.agents.length;
  lists.agents.push(...Array.from({ length: 110 }, (_, index) => ({
    id: `agent-${index}`,
    name: `Agent ${index}`,
  })));
  lists.agents.push({ id: "late-leader", name: "Zeta leader" });
  try {
    renderSidebar();
    await screen.findByText("Plan sprint");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search agents" }), "Zeta");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Zeta leader" }));
    await waitFor(() => expect(api.sessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ agentIds: ["late-leader"] }),
    ));
  } finally {
    lists.agents.splice(count);
  }
});

it("keeps a filter selected while navigating option pages", async () => {
  const count = lists.teams.length;
  lists.teams.push(...Array.from({ length: 30 }, (_, index) => ({
    id: `page-team-${index}`,
    name: `Page team ${index}`,
  })));
  try {
    renderSidebar();
    await screen.findByText("Plan sprint");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const teams = screen.getByRole("group", { name: "Teams" });
    await userEvent.click(within(teams).getByRole("button", { name: "Next" }));
    await userEvent.click(within(teams).getByRole("checkbox", { name: "Page team 29" }));
    await userEvent.click(within(teams).getByRole("button", { name: "Previous" }));
    expect(useSessionsSidebar.getState().filters.teamIds).toEqual(["page-team-29"]);
    await userEvent.click(within(teams).getByRole("button", { name: "Next" }));
    expect(within(teams).getByRole("checkbox", { name: "Page team 29" })).toBeChecked();
  } finally {
    lists.teams.splice(count);
  }
});

it("resolves the name of a team outside the first resource page", async () => {
  const count = lists.teams.length;
  lists.teams.push(...Array.from({ length: 105 }, (_, index) => ({
    id: `team-${index}`,
    name: `Team ${index}`,
    leaderId: "l1",
  })));
  lists.teams.push({ id: "late-team", name: "Late team", leaderId: "l1" });
  try {
    api.sessions.mockResolvedValue({
      items: [item("late-session", "Old planning", "late-team", "l1", null)],
      nextCursor: null,
    });
    renderSidebar();
    expect(await screen.findByRole("button", { name: /Team\s*Late team\s*1/ })).toBeVisible();
  } finally {
    lists.teams.splice(count);
  }
});

it("reports and retries a failed session-name lookup", async () => {
  api.sessions.mockResolvedValue({
    items: [item("historic", "Past work", "missing-team", "l1", null)],
    nextCursor: null,
  });
  api.get.mockRejectedValueOnce(new TypeError("Network unavailable")).mockResolvedValueOnce({
    id: "missing-team",
    name: "Recovered team",
  });
  renderSidebar();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Some session names could not be loaded.");
  await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: /Team\s*Recovered team\s*1/ })).toBeVisible();
});

it("reports and retries a failed session-name resource list", async () => {
  api.listErrors.teams = new TypeError("Network unavailable");
  renderSidebar();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Some session names could not be loaded.");
  await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(api.listRefetch).toHaveBeenCalledWith("teams");
});

it("marks a deleted session resource unavailable without a retry error", async () => {
  api.sessions.mockResolvedValue({
    items: [item("historic", "Past work", "deleted-team", "l1", null)],
    nextCursor: null,
  });
  api.get.mockRejectedValue(new ApiError(404, "not_found", "Team not found"));
  renderSidebar();
  expect(await screen.findByRole("button", { name: /Team\s*Unavailable\s*1/ })).toBeVisible();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("teams", "deleted-team"));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("can filter sessions by an archived previous leader", async () => {
  lists.agents.push({ id: "former-archived", name: "Archived leader", archivedAt: "2026-10-01T00:00:00Z" });
  try {
    renderSidebar();
    await screen.findByText("Plan sprint");
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const agents = screen.getByRole("group", { name: "Agents" });
    await userEvent.click(within(agents).getByRole("checkbox", { name: "Archived only" }));
    await userEvent.click(await within(agents).findByRole("checkbox", { name: "Archived leader" }));
    expect(useSessionsSidebar.getState().filters.agentIds).toEqual(["former-archived"]);
  } finally {
    lists.agents.pop();
  }
});

it("offers a session's board even when the board was transferred to another team", async () => {
  api.sessions.mockResolvedValue({
    items: [item("historic", "Previous project", "t2", "l2", "b1")],
    nextCursor: null,
  });
  renderSidebar();
  await screen.findByText("Previous project");
  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  const filters = screen.getByRole("dialog", { name: "Filters" });
  await userEvent.click(within(filters).getByRole("checkbox", { name: "Beta" }));
  await userEvent.click(within(filters).getByRole("checkbox", { name: "Roadmap" }));
  await waitFor(() => expect(api.sessions).toHaveBeenLastCalledWith(
    expect.objectContaining({ teamIds: ["t2"], boardIds: ["b1"] }),
  ));
});

it("prevents selecting more filter values than the session API accepts", async () => {
  useSessionsSidebar.setState({
    filters: {
      teamIds: [],
      boardIds: [],
      agentIds: ["l1", ...Array.from({ length: 49 }, (_, index) => `selected-${index}`)],
    },
  });
  act(() => useSessionsSidebar.getState().toggleFilter("agentIds", "l2"));
  expect(useSessionsSidebar.getState().filters.agentIds).toHaveLength(50);
  renderSidebar();
  await screen.findByText("Plan sprint");
  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  const agents = screen.getByRole("group", { name: "Agents" });
  expect(within(agents).getByRole("checkbox", { name: "Ana" })).toBeEnabled();
  expect(within(agents).getByRole("checkbox", { name: "Bruno" })).toBeDisabled();
  expect(within(agents).getByText("Select up to 50 values.")).toBeVisible();
  await userEvent.click(within(agents).getByRole("checkbox", { name: "Ana" }));
  expect(within(agents).getByRole("checkbox", { name: "Bruno" })).toBeEnabled();
});

it("loads more sessions as the end of the list becomes visible", async () => {
  const observers: IntersectionObserver[] = [];
  class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    private callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
    trigger() {
      this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
    }
  }
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  try {
    api.sessions.mockImplementation(async ({ cursor }: { cursor?: string }) =>
      cursor
        ? { items: [item("c2", "Second page", "t1", "l1", null)], nextCursor: null }
        : { items: [item("c1", "First page", "t1", "l1", null)], nextCursor: "next" },
    );
    renderSidebar();
    await screen.findByText("First page");
    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    act(() => (observers[observers.length - 1] as TestIntersectionObserver).trigger());
    expect(await screen.findByText("Second page")).toBeVisible();
    expect(api.sessions).toHaveBeenCalledWith(expect.objectContaining({ cursor: "next" }));
  } finally {
    vi.unstubAllGlobals();
  }
});

it("does not duplicate a session that moves between cursor pages", async () => {
  useSessionsSidebar.setState({ sort: "updated_asc" });
  api.sessions.mockImplementation(async ({ cursor }: { cursor?: string }) =>
    cursor
      ? {
          items: [
            item("c1", "Moving session", "t1", "l1", null),
            item("c2", "Second session", "t1", "l1", null),
          ],
          nextCursor: null,
        }
      : { items: [item("c1", "Moving session", "t1", "l1", null)], nextCursor: "next" },
  );
  renderSidebar();
  await screen.findByText("Moving session");
  await userEvent.click(screen.getByRole("button", { name: "Load more sessions" }));
  await screen.findByText("Second session");
  expect(screen.getAllByRole("button", { name: /Moving session/ })).toHaveLength(1);
  expect(screen.getByRole("button", { name: /Team\s*Alpha\s*2/ })).toBeVisible();
});
