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
  autoStart: true,
  callbacks: null as VoiceCallbacks | null,
}));
vi.mock("./realtime-voice", () => ({
  RealtimeVoice: class {
    constructor(_api: unknown, callbacks: VoiceCallbacks) {
      mock.callbacks = callbacks;
    }
    start = async () => {
      if (!mock.autoStart) return;
      mock.callbacks!.associated("created");
      mock.callbacks!.connected();
    };
    close = mock.close;
    hydrate = vi.fn(async () => {});
    report = vi.fn(async () => {});
  },
}));
beforeEach(async () => {
  vi.clearAllMocks();
  mock.autoStart = true;
  mock.callbacks = null;
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.changeLanguage("en");
});

it("scrolls to the bottom once on each activation while locking text during startup", async () => {
  mock.autoStart = false;
  const api = {
    voice: {},
    config: vi.fn().mockResolvedValue({ version: 1, configuration: null }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    messages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    conversation: vi
      .fn()
      .mockResolvedValue({
        id: "created",
        agentId: "leader",
        teamId: "team",
        readOnly: false,
      }),
    send: vi.fn(),
  } as unknown as ManagedAgentApi;
  const { container } = render(
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
      />
    </QueryClientProvider>,
  );
  const start = await screen.findByRole("button", { name: "Talk by voice" });
  const history = container.querySelector(".assistant-thread") as HTMLElement;
  Object.defineProperties(history, {
    scrollHeight: { configurable: true, value: 1200 },
    clientHeight: { configurable: true, value: 300 },
  });
  history.scrollTop = 120;
  fireEvent.scroll(history);
  fireEvent.click(start);
  expect(history.scrollTop).toBe(1200);
  expect(screen.getByRole("textbox")).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("button", { name: "End voice call" })).toBeEnabled();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(api.send).not.toHaveBeenCalled();
  history.scrollTop = 100;
  fireEvent.scroll(history);
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  act(() => {
    expect(mock.callbacks!.associated("created")).toBe(true);
    mock.callbacks!.connected();
  });
  await waitFor(() =>
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "contenteditable",
      "plaintext-only",
    ),
  );
  expect(api.send).not.toHaveBeenCalled();
  expect(history.scrollTop).toBe(100);
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "End voice call" }));
  expect(history.scrollTop).toBe(100);
  fireEvent.click(screen.getByRole("button", { name: "Talk by voice" }));
  expect(history.scrollTop).toBe(1200);
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
    messages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    conversation: vi.fn().mockResolvedValue({
      id: "created",
      teamId: "team",
      agentId: "leader",
      readOnly: false,
      title: "Typed request",
    }),
    send: vi.fn().mockReturnValueOnce(pending).mockResolvedValue({
      id: "next-request",
      conversationId: "created",
      state: "queued",
    }),
    snapshot: vi.fn().mockResolvedValue({
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
  await waitFor(() =>
    expect(editor).toHaveAttribute("contenteditable", "plaintext-only"),
  );
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

it("persists both spoken roles in the main timeline and restores a speech-only conversation after remount", async () => {
  const conversation = {
    id: "created",
    agentId: "leader",
    teamId: "team",
    readOnly: false,
    title: "Voice conversation",
  };
  let saved: unknown[] = [];
  const api = {
    voice: {},
    config: vi.fn().mockResolvedValue({ version: 1, configuration: null }),
    conversations: vi.fn(async () => ({
      items: saved.length ? [conversation] : [],
      nextCursor: null,
    })),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    conversation: vi.fn().mockResolvedValue(conversation),
    messages: vi.fn(async () => ({ items: saved, nextCursor: null })),
    send: vi.fn(),
  } as unknown as ManagedAgentApi;
  // This test selects the voice-associated conversation returned by the native startup.
  const renderChat = (fresh: boolean) =>
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
          freshConversation={fresh}
        />
      </QueryClientProvider>,
    );
  const view = renderChat(true);
  fireEvent.click(await screen.findByRole("button", { name: "Talk by voice" }));
  await waitFor(() => expect(api.messages).toHaveBeenCalledWith("created"));
  const record = (id: string, role: string, content: string) => ({
    id,
    role,
    content,
    requestId: null,
    source: "voice",
    conversationId: "created",
    version: 1,
    createdAt: "2026-11-23T12:00:00Z",
  });
  saved = [
    record("speech-user", "requester", "How does this board work?"),
    record(
      "speech-assistant",
      "agent",
      "Each column represents a work status.",
    ),
  ];
  await act(async () => {
    mock.callbacks!.transcript({
      role: "user",
      text: "How does this board work?",
    });
    mock.callbacks!.transcript({
      role: "assistant",
      text: "Each column represents a work status.",
    });
  });
  await screen.findByText("How does this board work?");
  await screen.findByText("Each column represents a work status.");
  expect(screen.queryByText("Voice")).not.toBeInTheDocument();
  for (const message of saved) expect(message).toHaveProperty("source", "voice");
  expect(screen.queryByText("Call transcript")).not.toBeInTheDocument();
  expect(api.send).not.toHaveBeenCalled();
  await act(async () => {
    mock.callbacks!.transcript({
      role: "user",
      text: "How does this board work?",
    });
  });
  expect(screen.getAllByText("How does this board work?")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "End voice call" }));
  saved = [
    ...saved,
    record("speech-tail", "agent", "The conversation is saved here."),
  ];
  await act(async () => {
    mock.callbacks!.stopped?.();
  });
  await screen.findByText("The conversation is saved here.");
  view.unmount();
  renderChat(false);
  await screen.findByText("How does this board work?");
  await screen.findByText("The conversation is saved here.");
  expect(screen.queryByText("Voice")).not.toBeInTheDocument();
  expect(api.send).not.toHaveBeenCalled();
});

it("preserves voice on Home reset and keeps its late delivery error separate from the new composer", async () => {
  let reject!: (error: unknown) => void;
  const api = {
    voice: {},
    config: vi.fn().mockResolvedValue({ version: 1, configuration: null }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    messages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    conversation: vi.fn().mockResolvedValue({ id: "created", teamId: "team", agentId: "leader", readOnly: false }),
    send: vi.fn().mockReturnValue(new Promise((_yes, no) => { reject = no; })),
  } as unknown as ManagedAgentApi;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (generation: number) => <QueryClientProvider client={client}>
    <ManagedAgentChat api={api} agentId="leader" teamId="team" freshConversation resetGeneration={generation} />
  </QueryClientProvider>;
  const mounted = render(view(1));
  await screen.findByRole("button", { name: "Talk by voice" });
  expect(mock.callbacks).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Talk by voice" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Message to agent" })).toHaveAttribute("contenteditable", "plaintext-only"));
  let execution!: Promise<unknown>;
  act(() => { execution = mock.callbacks!.execute("Run old task", "old"); });
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  mounted.rerender(view(2));
  expect(mock.close).not.toHaveBeenCalled();
  await act(async () => { reject(new TypeError("Old voice delivery failed")); await execution; });
  expect(screen.getByRole("complementary")).toHaveTextContent("Request delivery could not be confirmed");
  expect(screen.getByRole("textbox", { name: "Message to agent" })).toHaveAttribute("contenteditable", "plaintext-only");
});
