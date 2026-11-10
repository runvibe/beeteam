import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManagedAgentChat } from "./managed-agent-chat";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { i18n } from "@/i18n";
import { editPlainText } from "@/test/editable";
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
it("configures an agent without exposing a workspace setting", async () => {
  await i18n.changeLanguage("en");
  const api = {
    config: vi.fn().mockResolvedValue({
      agentId: "agent",
      version: 3,
      configuration: null,
      readiness: "unconfigured",
    }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    configure: vi.fn().mockResolvedValue({}),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ManagedAgentChat agentId="agent" api={api} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Configure agent")).not.toBeDisabled());
  expect(screen.queryByLabelText("Project folder")).toBeNull();
  fireEvent.click(screen.getByText("Configure agent"));
  await waitFor(() => expect(api.configure).toHaveBeenCalled());
  const call = vi.mocked(api.configure).mock.calls[0];
  expect(call[0]).toBe("agent");
  expect(call[1]).toEqual({
    provider: "codex",
    toolProfile: {
      webSearch: "live",
      networkAccess: false,
      enabledMcpServers: [],
      skillRoots: [],
    },
  });
  expect(call[2]).toBe(3);
  expect(screen.queryByText(/replace.*binding/i)).toBeNull();
});

it("keeps the original action retry after the approval disappears", async () => {
  await i18n.changeLanguage("en");
  const request = {
    id: "request",
    agentId: "agent",
    conversationId: "conversation",
    version: 4,
    state: "awaiting_approval",
    createdAt: "2026-11-09T00:00:00Z",
  };
  let completed = false;
  const api = {
    config: vi
      .fn()
      .mockResolvedValue({
        configuration: {
          toolProfile: {
            webSearch: "disabled",
            networkAccess: false,
            enabledMcpServers: [],
            skillRoots: [],
          },
        },
        version: 2,
      }),
    conversations: vi
      .fn()
      .mockResolvedValue({
        items: [{ id: "conversation", title: "Review" }],
        nextCursor: null,
      }),
    requests: vi.fn().mockResolvedValue({ items: [request], nextCursor: null }),
    snapshot: vi
      .fn()
      .mockImplementation(async () => ({
        request: {
          ...request,
          state: completed ? "completed" : "awaiting_approval",
        },
        messages: { items: [], nextCursor: null },
        approvals: completed
          ? []
          : [
              {
                id: "approval",
                version: 1,
                state: "pending",
                description: "Run tests",
              },
            ],
      })),
    decide: vi
      .fn()
      .mockImplementationOnce(async () => {
        completed = true;
        throw new TypeError("Receipt lost");
      })
      .mockResolvedValue({}),
  } as unknown as ManagedAgentApi;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ManagedAgentChat agentId="agent" api={api} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText("Approve"));
  await screen.findByText("Retry previous action");
  await client.invalidateQueries({ queryKey: ["managed-snapshot", "request"] });
  await waitFor(() => expect(screen.queryByText("Approve")).toBeNull());
  fireEvent.click(screen.getByText("Retry previous action"));
  await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.decide).mock.calls[1]).toEqual(
    vi.mocked(api.decide).mock.calls[0],
  );
});

it("fills the composer from a starter and sends with Enter", async () => {
  await i18n.changeLanguage("en");
  const api = {
    config: vi.fn().mockResolvedValue({
      configuration: {
        toolProfile: {
          webSearch: "live",
          networkAccess: false,
          enabledMcpServers: [],
          skillRoots: [],
        },
      },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    send: vi
      .fn()
      .mockResolvedValue({ id: "request", conversationId: "conversation" }),
    snapshot: vi.fn().mockResolvedValue({
      request: { id: "request", state: "running", version: 1 },
      messages: { items: [], nextCursor: null },
      approvals: [],
    }),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ManagedAgentChat agentId="agent" api={api} starters />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText("Create a team"));
  const box = screen.getByLabelText("Message to agent");
  expect(box.textContent).toBe(
    "I want to create my first team. Help me define its goal, leader and roles.",
  );
  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
  expect(api.send).not.toHaveBeenCalled();
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.send).mock.calls[0][1]).toEqual({
    content:
      "I want to create my first team. Help me define its goal, leader and roles.",
  });
  await screen.findByText("Running");
});

it("retries the identical multiline text and key after an uncertain send", async () => {
  await i18n.changeLanguage("en");
  const api = {
    config: vi.fn().mockResolvedValue({
      configuration: {
        toolProfile: {
          webSearch: "live",
          networkAccess: false,
          enabledMcpServers: [],
          skillRoots: [],
        },
      },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    send: vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Receipt lost"))
      .mockResolvedValue({ id: "request", conversationId: "conversation" }),
    snapshot: vi.fn().mockResolvedValue({
      request: { id: "request", state: "running", version: 1 },
      messages: { items: [], nextCursor: null },
      approvals: [],
    }),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ManagedAgentChat agentId="agent" api={api} />
    </QueryClientProvider>,
  );
  const editor = await screen.findByRole("textbox", { name: "Message to agent" });
  expect(editor).toHaveAttribute("contenteditable", "plaintext-only");
  const content = "first line\n\n**Olá** <code>🐝</code>\n";
  editPlainText(editor, content);
  const draft = editor.innerHTML;
  fireEvent.keyDown(editor, { key: "Enter" });
  const retry = await screen.findByRole("button", {
    name: "Check send with the same key",
  });
  expect(editor).toHaveAttribute("aria-disabled", "true");
  expect(editor.innerHTML).toBe(draft);
  fireEvent.click(retry);
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.send).mock.calls[0][1]).toEqual({ content });
  expect(vi.mocked(api.send).mock.calls[1]).toEqual(
    vi.mocked(api.send).mock.calls[0],
  );
  await waitFor(() => expect(editor.textContent).toBe(""));
});

it("applies the 65536-byte limit to the UTF-8 editor text", async () => {
  await i18n.changeLanguage("en");
  const api = {
    config: vi.fn().mockResolvedValue({
      configuration: {
        toolProfile: {
          webSearch: "live",
          networkAccess: false,
          enabledMcpServers: [],
          skillRoots: [],
        },
      },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    send: vi.fn(),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ManagedAgentChat agentId="agent" api={api} />
    </QueryClientProvider>,
  );
  const editor = await screen.findByRole("textbox", { name: "Message to agent" });
  expect(editor).toHaveAttribute("contenteditable", "plaintext-only");
  const send = screen.getByRole("button", { name: "Send request" });
  editor.textContent = "é".repeat(32768);
  fireEvent.input(editor);
  expect(send).toBeEnabled();
  editor.textContent += "é";
  fireEvent.input(editor);
  expect(send).toBeDisabled();
  fireEvent.keyDown(editor, { key: "Enter" });
  expect(api.send).not.toHaveBeenCalled();
});

it("hides onboarding starters outside Bee Team HQ", async () => {
  await i18n.changeLanguage("en");
  const api = {
    config: vi.fn().mockResolvedValue({
      configuration: {
        toolProfile: {
          webSearch: "live",
          networkAccess: false,
          enabledMcpServers: [],
          skillRoots: [],
        },
      },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ManagedAgentChat agentId="agent" api={api} />
    </QueryClientProvider>,
  );
  await screen.findByText("How can I help?");
  expect(screen.queryByText("Create a team")).toBeNull();
});

it("shows a worker's existing managed conversation without allowing new messages", async () => {
  await i18n.changeLanguage("en");
  const request = {
    id: "worker-request",
    agentId: "worker",
    conversationId: "worker-conversation",
    version: 1,
    state: "completed",
    createdAt: "2026-11-09T00:00:00Z",
  };
  const api = {
    config: vi.fn().mockResolvedValue({
      configuration: {
        toolProfile: {
          webSearch: "live",
          networkAccess: false,
          enabledMcpServers: [],
          skillRoots: [],
        },
      },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({
      items: [{ id: "worker-conversation", title: "Worker history" }],
      nextCursor: null,
    }),
    requests: vi.fn().mockResolvedValue({ items: [request], nextCursor: null }),
    snapshot: vi.fn().mockResolvedValue({
      request,
      messages: {
        items: [{ id: "message", role: "agent", content: "Worker result" }],
        nextCursor: null,
      },
      approvals: [],
    }),
    send: vi.fn(),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ManagedAgentChat agentId="worker" api={api} mode="management" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Worker result")).toBeVisible();
  expect(screen.queryByRole("textbox", { name: "Message to agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Send request" })).toBeNull();
  expect(api.send).not.toHaveBeenCalled();
});

it("preserves an ambiguous approval decision across management view remounts", async () => {
  await i18n.changeLanguage("en");
  const request = {
    id: "retry-request",
    agentId: "retry-worker",
    conversationId: "retry-conversation",
    version: 1,
    state: "awaiting_approval",
    createdAt: "2026-11-09T00:00:00Z",
  };
  let decided = false;
  const api = {
    config: vi.fn().mockResolvedValue({
      configuration: { toolProfile: { webSearch: "live", networkAccess: false, enabledMcpServers: [], skillRoots: [] } },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({ items: [{ id: "retry-conversation", title: "Work" }], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [request], nextCursor: null }),
    snapshot: vi.fn().mockImplementation(async () => ({
      request: { ...request, state: decided ? "completed" : "awaiting_approval" },
      messages: { items: [], nextCursor: null },
      approvals: decided ? [] : [{ id: "retry-approval", version: 1, state: "pending", description: "Run command" }],
    })),
    decide: vi.fn().mockImplementationOnce(async () => {
      decided = true;
      throw new TypeError("Receipt lost");
    }).mockResolvedValue({}),
  } as unknown as ManagedAgentApi;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderView = () => render(
    <QueryClientProvider client={client}>
      <ManagedAgentChat agentId="retry-worker" api={api} mode="management" />
    </QueryClientProvider>,
  );
  const first = renderView();
  fireEvent.click(await screen.findByText("Approve"));
  await screen.findByText("Retry previous action");
  first.unmount();
  await client.invalidateQueries({ queryKey: ["managed-snapshot", "retry-request"] });
  renderView();
  fireEvent.click(await screen.findByText("Retry previous action"));
  await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.decide).mock.calls[1]).toEqual(vi.mocked(api.decide).mock.calls[0]);
});

it("keeps historical worker requests accessible when execution is unconfigured", async () => {
  await i18n.changeLanguage("en");
  const request = {
    id: "historical-request", agentId: "unconfigured", conversationId: "historical-conversation",
    version: 1, state: "completed", createdAt: "2026-11-09T00:00:00Z",
  };
  const api = {
    config: vi.fn().mockResolvedValue({ configuration: null, version: 1 }),
    conversations: vi.fn().mockResolvedValue({ items: [{ id: "historical-conversation", title: "History" }], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [request], nextCursor: null }),
    snapshot: vi.fn().mockResolvedValue({
      request,
      messages: { items: [{ id: "old-message", role: "agent", content: "Previous result" }], nextCursor: null },
      approvals: [],
    }),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ManagedAgentChat agentId="unconfigured" api={api} mode="management" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Previous result")).toBeVisible();
  expect(screen.getByText("Configure agent")).toBeVisible();
});

it("loads older managed conversations instead of hiding them after the first page", async () => {
  await i18n.changeLanguage("en");
  const conversations = vi.fn().mockImplementation(async (_agent, cursor) =>
    cursor
      ? { items: [{ id: "older", title: "Older conversation" }], nextCursor: null }
      : { items: [{ id: "recent", title: "Recent conversation" }], nextCursor: "next-page" },
  );
  const api = {
    config: vi.fn().mockResolvedValue({ configuration: null, version: 1 }),
    conversations,
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    messages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  } as unknown as ManagedAgentApi;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ManagedAgentChat agentId="paginated-worker" api={api} mode="management" />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "More conversations" }));
  expect(await screen.findByRole("option", { name: "Older conversation" })).toBeVisible();
  expect(conversations).toHaveBeenCalledWith("paginated-worker", "next-page");
});

it("retries an uncertain configuration with the original body and key after remount", async () => {
  await i18n.changeLanguage("en");
  const api = {
    config: vi.fn().mockResolvedValue({ configuration: null, version: 3 }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    configure: vi.fn().mockRejectedValueOnce(new TypeError("Receipt lost")).mockResolvedValue({}),
  } as unknown as ManagedAgentApi;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderView = () => render(
    <QueryClientProvider client={client}>
      <ManagedAgentChat agentId="configuration-worker" api={api} mode="management" />
    </QueryClientProvider>,
  );
  const first = renderView();
  fireEvent.click(await screen.findByText("Configure agent"));
  await screen.findByText("Retry previous action");
  first.unmount();
  renderView();
  fireEvent.click(await screen.findByText("Retry previous action"));
  await waitFor(() => expect(api.configure).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.configure).mock.calls[1]).toEqual(vi.mocked(api.configure).mock.calls[0]);
});
