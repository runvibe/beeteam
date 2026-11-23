import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { ManagedAgentChat } from "./managed-agent-chat";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { VoiceCallbacks } from "./realtime-voice";
import { i18n } from "@/i18n";
import { editPlainText } from "@/test/editable";

const mock = vi.hoisted(() => ({
  close: vi.fn(),
  callbacks: null as VoiceCallbacks | null,
}));
vi.mock("./realtime-voice", () => ({
  RealtimeVoice: class {
    constructor(_api: unknown, callbacks: VoiceCallbacks) {
      mock.callbacks = callbacks;
    }
    start = async () => {
      mock.callbacks!.connected();
    };
    close = mock.close;
    hydrate = vi.fn(async () => {});
    report = vi.fn(async () => {});
  },
}));
beforeEach(async () => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.changeLanguage("en");
});

it("preserves active voice through the actual shared registry completion of a first typed request", async () => {
  let resolveSend!: (request: { id: string; conversationId: string }) => void;
  const pending = new Promise<{ id: string; conversationId: string }>(
    (resolve) => {
      resolveSend = resolve;
    },
  );
  const api = {
    voice: {},
    config: vi.fn().mockResolvedValue({ version: 1, configuration: null }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    conversation: vi
      .fn()
      .mockResolvedValue({
        id: "created",
        teamId: "team",
        agentId: "leader",
        readOnly: false,
        title: "Typed request",
      }),
    send: vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue({
        id: "next-request",
        conversationId: "created",
        state: "queued",
      }),
    snapshot: vi
      .fn()
      .mockResolvedValue({
        request: { id: "request", state: "running", version: 1 },
        messages: { items: [] },
        approvals: [],
      }),
  } as unknown as ManagedAgentApi;
  const select = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ManagedAgentChat
        api={api}
        agentId="leader"
        teamId="team"
        freshConversation
        onConversationChange={select}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Talk by voice" }));
  await screen.findByRole("button", { name: "End voice call" });
  const editor = screen.getByRole("textbox", { name: "Message to agent" });
  editPlainText(editor, "Run the tests");
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "End voice call" })).toBeEnabled();
  await act(async () => {
    resolveSend({ id: "request", conversationId: "created" });
  });
  await waitFor(() => expect(select).toHaveBeenCalledWith("created"));
  await waitFor(() => expect(editor.textContent).toBe(""));
  expect(mock.close).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "End voice call" })).toBeEnabled();
  expect(
    screen.getByRole("img", { name: /Assistant voice visualization/ }),
  ).toBeInTheDocument();
  await act(async () => {
    await mock.callbacks!.execute("Fix the failures", "follow-up");
  });
  expect(vi.mocked(api.send).mock.calls[1][1]).toMatchObject({
    content: "Fix the failures",
    conversationId: "created",
  });
  expect(mock.close).not.toHaveBeenCalled();
});
