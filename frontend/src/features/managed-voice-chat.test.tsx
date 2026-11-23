import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ManagedVoiceChat as VoiceController,
  voiceHistory,
} from "./managed-voice-chat";
import type { VoiceCallbacks } from "./realtime-voice";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import type { ComponentProps } from "react";
import { Composer } from "./managed-agent-chat-parts";
function ManagedVoiceChat(
  props: Omit<ComponentProps<typeof VoiceController>, "children">,
) {
  return (
    <VoiceController {...props}>
      {(voice) => (
        <Composer
          voice={voice}
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          locked={props.disabled}
          canSend={false}
          retry={false}
          readOnly={props.readOnly}
        />
      )}
    </VoiceController>
  );
}
type S = components["schemas"];
const mock = vi.hoisted(() => ({
  callbacks: null as VoiceCallbacks | null,
  close: vi.fn(),
  start: vi.fn(),
  report: vi.fn(),
  hydrate: vi.fn(),
}));
vi.mock("./realtime-voice", () => ({
  RealtimeVoice: class {
    constructor(_api: unknown, callbacks: VoiceCallbacks) {
      mock.callbacks = callbacks;
    }
    close = mock.close;
    start = (context: { conversationId?: string }) => {
      if (mock.start(context) === false) return;
      mock.callbacks!.associated(context.conversationId ?? "created");
    };
    report = mock.report;
    hydrate = mock.hydrate;
  },
}));
function setup() {
  const request = {
    id: "request",
    conversationId: "created",
    state: "queued",
  } as S["AgentRequest"];
  return {
    api: {
      voice: {},
      snapshot: vi.fn(async () => ({
        request: { ...request, state: "completed" },
        messages: {
          items: [
            { requestId: "request", role: "agent", content: "Tests passed" },
          ],
        },
      })),
    } as unknown as ManagedAgentApi,
    contextMessages: [] as S["Message"][],
    agentId: "agent",
    teamId: "team",
    conversation: "",
    accessMode: "standard" as S["AccessMode"],
    disabled: false,
    readOnly: false,
    onAssociated: vi.fn(),
    onTranscript: vi.fn(),
    onSend: vi.fn(async () => request),
    onQueued: vi.fn(),
  };
}
beforeEach(() => vi.clearAllMocks());
function start() {
  fireEvent.click(
    screen.getByRole("button", { name: /Talk by voice|Conversar por voz/ }),
  );
}
describe("managed voice routing", () => {
  it("rejects stale startup association after external navigation before local selection catches up", () => {
    mock.start.mockReturnValueOnce(false);
    const p = setup();
    const view = render(<ManagedVoiceChat {...p} selectionToken={null} />);
    start();
    view.rerender(<ManagedVoiceChat {...p} selectionToken="different" />);
    expect(mock.callbacks!.associated("late-created")).toBe(false);
    expect(p.onAssociated).not.toHaveBeenCalled();
    expect(mock.close).toHaveBeenCalledOnce();
  });
  it("invalidates persisted history after stop and shows a final-save error without restoring the call", () => {
    const p = setup();
    const view = render(<ManagedVoiceChat {...p} />);
    start();
    view.rerender(<ManagedVoiceChat {...p} conversation="created" />);
    fireEvent.click(
      screen.getByRole("button", { name: /End voice call|Encerrar chamada/ }),
    );
    act(() => {
      mock.callbacks!.stopped?.(new Error("Transcript save failed"));
    });
    expect(p.onTranscript).toHaveBeenCalledWith("created");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Transcript save failed",
    );
    expect(
      screen.getByRole("button", { name: /Talk by voice|Conversar por voz/ }),
    ).toBeEnabled();
  });
  it("keeps voice active when its first typed request creates the conversation", () => {
    const p = setup();
    let control: import("./managed-voice-chat").ManagedVoiceControl;
    const child = (
      voice: import("./managed-voice-chat").ManagedVoiceControl,
    ) => {
      control = voice;
      return (
        <Composer
          voice={voice}
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          locked={false}
          canSend={false}
          retry={false}
        />
      );
    };
    const view = render(<VoiceController {...p}>{child}</VoiceController>);
    start();
    mock.close.mockClear();
    control!.adoptConversation!("typed-conversation");
    view.rerender(
      <VoiceController {...p} conversation="typed-conversation">
        {child}
      </VoiceController>,
    );
    expect(mock.close).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /End voice call|Encerrar chamada/ }),
    ).toBeEnabled();
  });
  it("shows the amber hexagon only during a call and updates its output level without rerendering", () => {
    render(<ManagedVoiceChat {...setup()} />);
    expect(
      screen.queryByRole("img", { name: /voice visualization|Visualização/ }),
    ).toBeNull();
    start();
    const visual = screen.getByRole("img", {
      name: /voice visualization|Visualização/,
    });
    expect(visual.querySelectorAll(".voice-hexagon-outline")).toHaveLength(2);
    expect(visual.querySelectorAll(".voice-hexagon-bars > span")).toHaveLength(
      3,
    );
    expect(visual.querySelector(".voice-hexagon-echo")).not.toBeNull();
    mock.callbacks!.outputLevel!(0.65);
    expect(visual.style.getPropertyValue("--voice-level")).toBe("0.650");
    fireEvent.click(
      screen.getByRole("button", { name: /End voice call|Encerrar chamada/ }),
    );
    expect(
      screen.queryByRole("img", { name: /voice visualization|Visualização/ }),
    ).toBeNull();
  });
  it("hydrates prior user and assistant messages once after connecting", () => {
    const props = setup();
    props.contextMessages = [
      { role: "requester", content: "We are changing the navbar" },
      { role: "system", content: "ignored" },
    ] as S["Message"][];
    const view = render(<ManagedVoiceChat {...props} />);
    start();
    mock.callbacks!.connected();
    view.rerender(<ManagedVoiceChat {...props} />);
    mock.callbacks!.connected();
    expect(mock.hydrate).toHaveBeenCalledExactlyOnceWith({
      messages: [{ role: "user", content: "We are changing the navbar" }],
      truncated: false,
    });
  });
  it("bounds UTF-8 history size while preserving complete message objects", () => {
    const history = voiceHistory([
      { role: "requester", content: "\u5b57".repeat(24000) },
      { role: "agent", content: "Recent reply" },
    ] as S["Message"][]);
    expect(history).toEqual({
      messages: [{ role: "assistant", content: "Recent reply" }],
      truncated: true,
    });
    expect(
      new TextEncoder().encode(JSON.stringify(history)).length,
    ).toBeLessThan(24000);
  });
  it("keeps the call alive on its first conversation and routes the next request there", async () => {
    const props = setup();
    const view = render(<ManagedVoiceChat {...props} />);
    start();
    mock.close.mockClear();
    await mock.callbacks!.execute("Run tests", "first");
    expect(props.onSend).toHaveBeenCalledWith({
      content: "Run tests",
      conversationId: "created",
      accessMode: "standard",
    });
    view.rerender(<ManagedVoiceChat {...props} conversation="created" />);
    expect(mock.close).not.toHaveBeenCalled();
    await mock.callbacks!.execute("Fix failures", "second");
    expect(props.onSend).toHaveBeenLastCalledWith({
      content: "Fix failures",
      conversationId: "created",
      accessMode: "standard",
    });
    await waitFor(() =>
      expect(mock.report).toHaveBeenCalledWith(
        expect.objectContaining({ state: "completed", result: "Tests passed" }),
      ),
    );
  });
  it("stops when the user selects a different conversation", () => {
    const props = setup();
    const view = render(
      <ManagedVoiceChat {...props} conversation="original" />,
    );
    start();
    mock.close.mockClear();
    view.rerender(<ManagedVoiceChat {...props} conversation="different" />);
    expect(mock.close).toHaveBeenCalledOnce();
  });
  it("reads the latest access mode at delegation time", async () => {
    const props = setup();
    const view = render(
      <ManagedVoiceChat {...props} conversation="existing" />,
    );
    start();
    view.rerender(
      <ManagedVoiceChat
        {...props}
        conversation="existing"
        accessMode="full_access"
      />,
    );
    await mock.callbacks!.execute("Run tests", "call");
    expect(props.onSend).toHaveBeenCalledWith(
      expect.objectContaining({ accessMode: "full_access" }),
    );
  });
  it("does not send again after an unknown delivery", async () => {
    const props = setup();
    props.onSend.mockRejectedValue(new Error("network"));
    render(<ManagedVoiceChat {...props} />);
    start();
    expect(await mock.callbacks!.execute("Run tests", "first")).toMatchObject({
      state: "unknown",
    });
    expect(await mock.callbacks!.execute("Run tests", "second")).toMatchObject({
      state: "not_submitted",
    });
    expect(props.onSend).toHaveBeenCalledOnce();
  });
});
