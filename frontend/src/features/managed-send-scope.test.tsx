import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { useManagedSend } from "./use-managed-send";

it("retains an uncertain send identity while a new draft sends independently", async () => {
  const api = { send: vi.fn().mockRejectedValueOnce(new TypeError("Receipt lost"))
    .mockResolvedValue({ id: "accepted", conversationId: "created" }) } as unknown as ManagedAgentApi;
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  function Sender({ scope, content }: { scope: string; content: string }) {
    const { send, pending } = useManagedSend("leader", api, scope);
    return <button onClick={() => void send({ content, teamId: "team" }, {
      teamId: "team", conversation: "", externalConversation: null,
    }).catch(() => {})}>{pending?.state ?? "ready"}</button>;
  }
  const view = (scope: string, content: string) => <QueryClientProvider client={client}><Sender scope={scope} content={content} /></QueryClientProvider>;
  const mounted = render(view("draft:team:1", "Original message"));
  fireEvent.click(screen.getByRole("button"));
  await screen.findByText("uncertain");
  mounted.rerender(view("draft:team:2", "New message"));
  expect(screen.getByRole("button")).toHaveTextContent("ready");
  fireEvent.click(screen.getByRole("button"));
  await screen.findByText("completed");
  expect(vi.mocked(api.send).mock.calls[1][1].content).toBe("New message");
  expect(vi.mocked(api.send).mock.calls[1][2]).not.toBe(vi.mocked(api.send).mock.calls[0][2]);
  mounted.rerender(view("draft:team:1", "Changed draft"));
  expect(screen.getByRole("button")).toHaveTextContent("uncertain");
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(3));
  expect(vi.mocked(api.send).mock.calls[2]).toEqual(vi.mocked(api.send).mock.calls[0]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["managed-sessions"] });
});
