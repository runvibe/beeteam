import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManagedAgentChat } from "./managed-agent-chat";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { i18n } from "@/i18n";
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
it.each(["C:/project", ""])("configures project %s without requiring a folder", async (projectRoot) => {
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
  fireEvent.change(screen.getByLabelText("Project folder"), {
    target: { value: projectRoot },
  });
  fireEvent.click(screen.getByText("Configure agent"));
  await waitFor(() => expect(api.configure).toHaveBeenCalled());
  const call = vi.mocked(api.configure).mock.calls[0];
  expect(call[0]).toBe("agent");
  expect(call[1]).toEqual({
    provider: "codex",
    projectRoot,
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
          projectRoot: "C:/project",
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
