import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { editPlainText } from "@/test/editable";
import { beforeEach, expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { i18n } from "@/i18n";
import { ApiError } from "@/api/types";
import { ChatWorkspace } from "./chat-side-panel";
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
  leaderId: "leader",
}));

vi.mock("@/api/context", () => ({
  useList: () => ({ data: undefined }),
  useApi: () => ({
    managedAgents: managed,
    list: managed.list,
  }),
  useEntity: (resource: string) => ({
    data:
      resource === "teams"
        ? { name: "Team A", leaderId: managed.leaderId, system: false }
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
