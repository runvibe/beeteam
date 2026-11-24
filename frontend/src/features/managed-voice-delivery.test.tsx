import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { sendManagedVoice, useManagedSend } from "./use-managed-send";
import { VoiceNotSubmitted } from "./voice-delivery-error";
const context = {
  teamId: "team",
  conversation: "origin",
  externalConversation: "origin",
  source: "voice" as const,
};
const body = { content: "Run", conversationId: "origin" };
function setup() {
  const client = new QueryClient();
  const api = {
    send: vi
      .fn()
      .mockResolvedValue({
        id: "request",
        conversationId: "origin",
        state: "queued",
      }),
  } as unknown as ManagedAgentApi;
  return { client, api };
}
it("allows successive detached voice deliveries in the associated conversation scope", async () => {
  const { client, api } = setup();
  await sendManagedVoice(client, "agent", api, body, context);
  await sendManagedVoice(
    client,
    "agent",
    api,
    { ...body, content: "Next" },
    context,
  );
  expect(api.send).toHaveBeenCalledTimes(2);
  const calls = vi.mocked(api.send).mock.calls;
  expect(calls[0][2]).not.toBe(calls[1][2]);
  expect(calls[1][1]).toMatchObject({
    conversationId: "origin",
    content: "Next",
  });
});
it("does not replay an uncertain text send when detached voice attempts delivery", async () => {
  const { client, api } = setup();
  vi.mocked(api.send).mockRejectedValue(new TypeError("network"));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => useManagedSend("agent", api, "conversation:origin"),
    { wrapper },
  );
  await act(async () => {
    await expect(
      hook.result.current.send(
        { ...body, content: "Original text" },
        { ...context, source: undefined },
      ),
    ).rejects.toThrow();
  });
  hook.unmount();
  await expect(
    sendManagedVoice(client, "agent", api, body, context),
  ).rejects.toBeInstanceOf(VoiceNotSubmitted);
  expect(api.send).toHaveBeenCalledTimes(1);
});
