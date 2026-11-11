import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { editPlainText } from "@/test/editable";
import { beforeEach, expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { useSessionsSidebar } from "@/state/sessions-sidebar";
import { i18n } from "@/i18n";
import { ApiError } from "@/api/types";
import { ChatWorkspace } from "./chat-side-panel";
import { SessionsSidebar } from "./sessions-sidebar";
import { useManagedActions } from "./use-managed-actions";

const managed = vi.hoisted(() => ({
  config: vi.fn().mockResolvedValue({
    version: 1,
    configuration: {
      toolProfile: {
        webSearch: "live",
        networkAccess: false,
        enabledMcpServers: [],
        skillRoots: [],
      },
    },
  }),
  conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  sessions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  messages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  conversation: vi.fn(),
  send: vi
    .fn()
    .mockResolvedValue({ id: "request", conversationId: "conversation" }),
  snapshot: vi.fn().mockResolvedValue({
    request: { id: "request", state: "completed", version: 1 },
    messages: { items: [], nextCursor: null },
    approvals: [],
  }),
  teamApprovals: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  decide: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  leaderId: "leader",
}));

vi.mock("@/api/context", () => ({
  useList: () => ({ data: undefined }),
  useApi: () => ({
    managedAgents: managed,
    list: managed.list,
    get: managed.get,
  }),
  useEntity: (resource: string, id: string) => ({
    data:
      resource === "teams"
        ? { name: id === "team-b" ? "Team B" : "Team A", leaderId: managed.leaderId, system: false }
        : { id: "leader", name: "Leader One", version: 1 },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.changeLanguage("en");
  managed.send.mockClear();
  managed.leaderId = "leader";
  managed.decide.mockReset();
  managed.list.mockReset().mockResolvedValue({
    items: [
      { agentId: "lost-worker", name: "Lost worker", role: "worker" },
      { agentId: "worker", name: "Worker One", role: "worker" },
    ],
    hasMore: false,
    nextOffset: null,
  });
  managed.get.mockReset();
  managed.teamApprovals
    .mockReset()
    .mockResolvedValue({ items: [], nextCursor: null });
  managed.config.mockResolvedValue({
    version: 1,
    configuration: {
      toolProfile: {
        webSearch: "live",
        networkAccess: false,
        enabledMcpServers: [],
        skillRoots: [],
      },
    },
  });
  useChatPanel.setState({ open: true, teamId: "team-a", picking: false });
});

it("moves an ambiguous retry to the worker's current team without losing its key", async () => {
  let team = "team-a";
  managed.list.mockImplementation(
    async (_resource: string, teamId: string) => ({
      items:
        teamId === team
          ? [{ agentId: "lost-worker", name: "Lost worker", role: "worker" }]
          : [],
      hasMore: false,
      nextOffset: null,
    }),
  );
  managed.teamApprovals.mockImplementation(async (teamId: string) => ({
    items:
      teamId === "team-a" && managed.decide.mock.calls.length === 0
        ? [
            {
              approval: {
                id: "lost-approval",
                requestId: "lost-request",
                agentId: "lost-worker",
                version: 4,
                state: "pending",
                description: "Confirm write",
                kind: "command",
                expiresAt: null,
              },
              request: { id: "lost-request", taskId: null },
              agent: { id: "lost-worker", name: "Lost worker" },
            },
          ]
        : [],
    nextCursor: null,
  }));
  managed.decide
    .mockRejectedValueOnce(new TypeError("Receipt lost"))
    .mockResolvedValue({});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  await screen.findByRole("button", { name: "Retry previous action" });
  team = "team-b";
  await client.invalidateQueries({ queryKey: ["team-managed-retry-members"] });
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Retry previous action" }),
    ).toBeNull(),
  );
  useChatPanel.setState({ teamId: "team-b" });
  await waitFor(() =>
    expect(managed.list).toHaveBeenCalledWith(
      "members",
      "team-b",
      expect.any(Object),
    ),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Retry previous action" }),
  );
  await waitFor(() => expect(managed.decide).toHaveBeenCalledTimes(2));
  expect(managed.decide.mock.calls[1]).toEqual(managed.decide.mock.calls[0]);
});

it("offers the same retry when a worker decision began in agent details", async () => {
  managed.decide
    .mockRejectedValueOnce(new TypeError("Receipt lost"))
    .mockResolvedValue({});
  function AgentDetailsAction() {
    const actions = useManagedActions();
    return (
      <button
        onClick={() =>
          void actions
            .run("lost-worker", "decision:lost-approval:accept", (key) =>
              managed.decide("lost-approval", 4, "accept", key),
            )
            .catch(() => {})
        }
      >
        Decide in agent details
      </button>
    );
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgentDetailsAction />
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Decide in agent details" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Retry previous action" }),
  );
  await waitFor(() => expect(managed.decide).toHaveBeenCalledTimes(2));
  expect(managed.decide.mock.calls[1]).toEqual(managed.decide.mock.calls[0]);
});

it("shows and decides a worker approval without a configured leader", async () => {
  managed.config.mockResolvedValue({ version: 1, configuration: null });
  let pending = true;
  managed.teamApprovals.mockImplementation(async () => ({
    items: pending
      ? [
          {
            approval: {
              id: "approval",
              requestId: "worker-request",
              agentId: "worker",
              version: 3,
              state: "pending",
              description: "Run worker command",
              kind: "command",
              expiresAt: null,
            },
            request: {
              id: "worker-request",
              agentId: "worker",
              taskId: null,
              conversationId: "worker-conversation",
              version: 1,
              state: "awaiting_approval",
            },
            agent: { id: "worker", name: "Worker One" },
          },
        ]
      : [],
    nextCursor: null,
  }));
  managed.decide.mockImplementation(async () => {
    pending = false;
    return {};
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Worker One")).toBeVisible();
  expect(screen.getByText("Run worker command")).toBeVisible();
  expect(screen.getByText("Request: worker-request")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() =>
    expect(managed.decide).toHaveBeenCalledWith(
      "approval",
      3,
      "accept",
      expect.any(String),
      "team-a",
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText("Run worker command")).toBeNull(),
  );
});

it("rechecks current membership before deciding a stale approval", async () => {
  managed.teamApprovals.mockResolvedValue({
    items: [
      {
        approval: {
          id: "approval",
          requestId: "worker-request",
          agentId: "worker",
          version: 3,
          state: "pending",
          description: "Run worker command",
          kind: "command",
          expiresAt: null,
        },
        request: { id: "worker-request", taskId: null },
        agent: { id: "worker", name: "Worker One" },
      },
    ],
    nextCursor: null,
  });

  managed.list.mockResolvedValue({
    items: [],
    hasMore: false,
    nextOffset: null,
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "no longer a worker",
  );
  expect(managed.decide).not.toHaveBeenCalled();
});

it("reports a version conflict without retaining an ambiguous retry", async () => {
  managed.teamApprovals.mockResolvedValue({
    items: [
      {
        approval: {
          id: "approval",
          requestId: "worker-request",
          agentId: "worker",
          version: 3,
          state: "pending",
          description: "Run worker command",
          kind: "command",
          expiresAt: null,
        },
        request: { id: "worker-request", taskId: null },
        agent: { id: "worker", name: "Worker One" },
      },
    ],
    nextCursor: null,
  });
  managed.decide.mockRejectedValue(
    new ApiError(412, "version_conflict", "Version conflict"),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Version conflict",
  );
  expect(
    screen.queryByRole("button", { name: "Retry previous action" }),
  ).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled(),
  );
});

it("reports a team-approval lookup failure", async () => {
  managed.teamApprovals.mockRejectedValue(new Error("Connection failed"));
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Connection failed",
  );
});

it("loads further pages of pending worker approvals", async () => {
  const item = (id: string, name: string) => ({
    approval: {
      id,
      requestId: `request-${id}`,
      agentId: `agent-${id}`,
      version: 1,
      state: "pending",
      description: `Approval ${id}`,
      kind: "command",
      expiresAt: null,
    },
    request: { id: `request-${id}`, taskId: null },
    agent: { id: `agent-${id}`, name },
  });
  managed.teamApprovals.mockImplementation(
    async (_team: string, cursor?: string) =>
      cursor
        ? { items: [item("older", "Older worker")], nextCursor: null }
        : {
            items: [item("newer", "Recent worker")],
            nextCursor: "next-cursor",
          },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Recent worker")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "More approvals" }));
  expect(await screen.findByText("Older worker")).toBeVisible();
  expect(managed.teamApprovals).toHaveBeenCalledWith("team-a", "next-cursor");
});

it("retries an ambiguous worker decision with its original key after the approval disappears", async () => {
  let pending = true;
  managed.teamApprovals.mockImplementation(async () => ({
    items: pending
      ? [
          {
            approval: {
              id: "lost-approval",
              requestId: "lost-request",
              agentId: "lost-worker",
              version: 4,
              state: "pending",
              description: "Confirm write",
              kind: "command",
              expiresAt: null,
            },
            request: { id: "lost-request", taskId: null },
            agent: { id: "lost-worker", name: "Lost worker" },
          },
        ]
      : [],
    nextCursor: null,
  }));
  managed.decide
    .mockImplementationOnce(async () => {
      pending = false;
      throw new TypeError("Receipt lost");
    })
    .mockResolvedValue({});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const renderPanel = () =>
    render(
      <QueryClientProvider client={client}>
        <ChatWorkspace>
          <main>Content</main>
        </ChatWorkspace>
      </QueryClientProvider>,
    );
  const first = renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  await screen.findByRole("button", { name: "Retry previous action" });
  await waitFor(() => expect(screen.queryByText("Confirm write")).toBeNull());
  first.unmount();
  renderPanel();
  fireEvent.click(
    await screen.findByRole("button", { name: "Retry previous action" }),
  );
  await waitFor(() => expect(managed.decide).toHaveBeenCalledTimes(2));
  expect(managed.decide.mock.calls[1]).toEqual(managed.decide.mock.calls[0]);
});

it("always sends to the displayed team leader without an agent selector", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Leader One")).toBeVisible();
  expect(screen.queryByRole("combobox", { name: "Agents" })).toBeNull();
  editPlainText(
    await screen.findByRole("textbox", { name: "Message to agent" }),
    "Hello leader",
  );
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() =>
    expect(managed.send).toHaveBeenCalledWith(
      "leader",
      { content: "Hello leader", teamId: "team-a" },
      expect.any(String),
    ),
  );
});

it("clears the draft when the team's leader changes", async () => {
  const tree = () => (
    <QueryClientProvider client={client}>
      <ChatWorkspace>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(tree());
  const input = await screen.findByRole("textbox", {
    name: "Message to agent",
  });
  editPlainText(input, "Only for the previous leader");
  managed.leaderId = "new-leader";
  view.rerender(tree());
  expect(
    (await screen.findByRole("textbox", { name: "Message to agent" }))
      .textContent,
  ).toBe("");
  expect(managed.send).not.toHaveBeenCalled();
});

it("starts a team session without a board selector or a board assignment", async () => {
  managed.requests.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.conversations.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.send.mockReset().mockResolvedValue({ id: "request", conversationId: "conversation" });
  useChatPanel.setState({ conversationId: null, freshConversation: true });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatWorkspace><main>Content</main></ChatWorkspace>
    </QueryClientProvider>,
  );
  const editor = await screen.findByRole("textbox", { name: "Message to agent" });
  expect(screen.queryByRole("button", { name: "Session board" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Choose team" })).toBeNull();
  editPlainText(editor, "Plan work");
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() => expect(managed.send).toHaveBeenCalledWith(
    "leader",
    { content: "Plan work", teamId: "team-a" },
    expect.any(String),
  ));
  expect(managed.list.mock.calls.some(([resource]) => resource === "boards")).toBe(false);
});

it("opens a session with an existing board without changing or fetching that board in the chat", async () => {
  const selected = {
    id: "older-session",
    agentId: "leader",
    configurationVersion: 1,
    taskId: null,
    teamId: "team-a",
    boardId: "transferred-board",
    title: "Older session",
    readOnly: false,
    version: 1,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
  managed.requests.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.conversations.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.conversation.mockReset().mockResolvedValue(selected);
  useChatPanel.setState({ conversationId: "older-session", freshConversation: false });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatWorkspace><main>Content</main></ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Older session")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Session board" })).toBeNull();
  expect(managed.get).not.toHaveBeenCalledWith("boards", "transferred-board");
  editPlainText(await screen.findByRole("textbox", { name: "Message to agent" }), "Continue");
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() => expect(managed.send).toHaveBeenCalledWith(
    "leader",
    { content: "Continue", conversationId: "older-session" },
    expect.any(String),
  ));
});

it("switches team by opening a session in the sidebar without a team selector in chat", async () => {
  const selected = {
    id: "team-b-session",
    agentId: "leader",
    teamId: "team-b",
    boardId: null,
    title: "Team B conversation",
    readOnly: false,
    version: 1,
    updatedAt: "2026-11-01T00:00:00Z",
  };
  managed.requests.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.conversations.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.sessions.mockReset().mockResolvedValue({ items: [selected], nextCursor: null });
  managed.conversation.mockReset().mockResolvedValue(selected);
  managed.get.mockImplementation(async (resource: string) => ({
    id: resource === "teams" ? "team-b" : "leader",
    name: resource === "teams" ? "Team B" : "Leader One",
  }));
  useChatPanel.setState({ teamId: "team-a", conversationId: null, freshConversation: true });
  useSessionsSidebar.setState({
    open: true,
    drawer: false,
    search: "",
    sort: "updated_desc",
    groupBy: ["team"],
    filters: { teamIds: [], boardIds: [], agentIds: [] },
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatWorkspace sessions={<SessionsSidebar />}><main>Content</main></ChatWorkspace>
    </QueryClientProvider>,
  );
  const chat = screen.getByRole("complementary", { name: "Chat with the leader" });
  expect(await within(chat).findByText("Team A")).toBeVisible();
  expect(within(chat).queryByRole("button", { name: "Choose team" })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: /Team B conversation/ }));
  await waitFor(() => expect(useChatPanel.getState()).toMatchObject({
    teamId: "team-b",
    conversationId: "team-b-session",
  }));
  expect(await within(chat).findByText("Team B")).toBeVisible();
  managed.sessions.mockReset().mockResolvedValue({ items: [], nextCursor: null });
});

it("ignores a previously persisted team-picker state in managed chat", async () => {
  managed.list.mockImplementation(async (resource: string, _scope: string, filters?: { system?: boolean }) => ({
    items: resource === "teams"
      ? filters?.system
        ? [{ id: "hq", name: "Bee Team HQ", system: true }]
        : [{ id: "team-b", name: "Team B" }]
      : [],
    total: resource === "teams" ? 1 : 0,
    hasMore: false,
    nextOffset: null,
  }));
  useChatPanel.setState({ teamId: null, picking: true, open: true });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatWorkspace><main>Content</main></ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("textbox", { name: "Message to agent" })).toBeVisible();
  expect(managed.list).toHaveBeenCalledWith("teams", "", { system: true, limit: 1 });
  expect(screen.queryByRole("region", { name: "Choose team" })).toBeNull();
});

it("starts a blank session when the sidebar targets a different team", async () => {
  const old = {
    id: "old-session",
    agentId: "leader",
    configurationVersion: 1,
    taskId: null,
    teamId: "team-b",
    boardId: null,
    title: "Old session",
    readOnly: false,
    version: 1,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
  const request = {
    id: "old-request",
    agentId: "leader",
    conversationId: old.id,
    version: 1,
    state: "completed",
    createdAt: "2026-11-01T00:00:00Z",
  };
  managed.requests.mockReset().mockResolvedValue({ items: [request], nextCursor: null });
  managed.conversations.mockReset().mockResolvedValue({ items: [old], nextCursor: null });
  managed.conversation.mockResolvedValue(old);
  managed.snapshot.mockResolvedValue({
    request,
    messages: { items: [], nextCursor: null },
    approvals: [],
  });
  useChatPanel.setState({ teamId: "team-a", conversationId: old.id, open: true, picking: false });
  useSessionsSidebar.setState({
    open: true,
    drawer: false,
    search: "",
    sort: "updated_desc",
    groupBy: ["team"],
    filters: { teamIds: ["team-b"], boardIds: [], agentIds: [] },
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatWorkspace sessions={<SessionsSidebar />}>
        <main>Content</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Old session")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "New session" }));
  await waitFor(() => expect(useChatPanel.getState().teamId).toBe("team-b"));
  await waitFor(() => expect(managed.requests.mock.calls.length).toBeGreaterThanOrEqual(2));
  expect(await screen.findByText("New conversation")).toBeVisible();
  expect(screen.getByText("How can I help?")).toBeVisible();
  managed.requests.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  managed.conversations.mockReset().mockResolvedValue({ items: [], nextCursor: null });
});

it("opens the sessions panel from the chat when it is hidden", async () => {
  useSessionsSidebar.setState({ open: false, drawer: false });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatWorkspace sessions={<SessionsSidebar />}><main>Content</main></ChatWorkspace>
    </QueryClientProvider>,
  );
  const toggle = screen.getByRole("button", { name: "Show or hide sessions" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("complementary", { name: "Sessions" })).toHaveAttribute("data-open", "true");
});

it("opens the sessions drawer from the chat on a narrow screen", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  useSessionsSidebar.setState({ open: false, drawer: false });
  try {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChatWorkspace sessions={<SessionsSidebar />}><main>Content</main></ChatWorkspace>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show or hide sessions" }));
    expect(screen.getByRole("complementary", { name: "Sessions" })).toHaveAttribute("data-drawer", "true");
  } finally {
    vi.unstubAllGlobals();
  }
});
