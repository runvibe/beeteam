import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { createManagedAgentApi } from "@/api/managed-agents";
import { i18n } from "@/i18n";
import { ManagedAgentChat } from "./managed-agent-chat";
import { useManagedSend } from "./use-managed-send";

it("retries an earlier uncertain send with its original board and idempotency key", async () => {
  await i18n.changeLanguage("en");
  Element.prototype.scrollIntoView = vi.fn();
  const api = {
    ...createManagedAgentApi(),
    config: vi.fn().mockResolvedValue({
      configuration: { toolProfile: { webSearch: "live", networkAccess: false, enabledMcpServers: [], skillRoots: [] } },
      version: 1,
    }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    conversation: vi.fn().mockResolvedValue({
      id: "conversation",
      agentId: "leader",
      teamId: "team-a",
      boardId: "board-a",
      title: "Plan",
      readOnly: false,
    }),
    messages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    send: vi.fn()
      .mockRejectedValueOnce(new TypeError("Receipt lost"))
      .mockResolvedValue({ id: "request", conversationId: "conversation" }),
    snapshot: vi.fn().mockResolvedValue({
      request: { id: "request", state: "running", version: 1 },
      messages: { items: [], nextCursor: null },
      approvals: [],
    }),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function PreviousSend() {
    const { send } = useManagedSend("leader", api);
    return (
      <button onClick={() => void send(
        { content: "Plan", teamId: "team-a", boardId: "board-a" },
        { teamId: "team-a", conversation: "", externalConversation: null },
      ).catch(() => {})}>
        Begin previous send
      </button>
    );
  }

  const first = render(<QueryClientProvider client={client}><PreviousSend /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Begin previous send" }));
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  first.unmount();
  render(
    <QueryClientProvider client={client}>
      <ManagedAgentChat agentId="leader" api={api} teamId="team-a" conversationId={null} freshConversation />
    </QueryClientProvider>,
  );
  const retry = await screen.findByRole("button", { name: "Check send with the same key" });
  expect(screen.queryByRole("button", { name: "Session board" })).toBeNull();
  fireEvent.click(retry);
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.send).mock.calls[1]).toEqual(vi.mocked(api.send).mock.calls[0]);
  expect(vi.mocked(api.send).mock.calls[1][1]).toEqual({
    content: "Plan",
    teamId: "team-a",
    boardId: "board-a",
  });
  expect(await screen.findByText("Plan")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});
