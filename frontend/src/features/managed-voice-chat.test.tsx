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
  ManagedVoiceProvider,
  voiceHistory,
} from "./managed-voice-chat";
import type { VoiceCallbacks } from "./realtime-voice";
import type { ManagedAgentApi } from "@/api/managed-agents";
import type { components } from "@/api/generated/managed-agents";
import type { ComponentProps } from "react";
import { useVoicePreference } from "@/state/voice-preference";
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
  setMicrophoneMuted: vi.fn(),
  setOutputMuted: vi.fn(),
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
    setMicrophoneMuted = mock.setMicrophoneMuted;
    setOutputMuted = mock.setOutputMuted;
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
beforeEach(() => {
  vi.clearAllMocks();
  useVoicePreference.setState({ voiceId: null });
});
function start() {
  fireEvent.click(
    screen.getByRole("button", { name: /Talk by voice|Conversar por voz/ }),
  );
}
describe("managed voice routing", () => {
  it("preserves the freely dragged position through inline and detached transitions", () => {
    const original = { ...setup(), conversation: "original" };
    const view = render(<ManagedVoiceProvider><ManagedVoiceChat {...original} /></ManagedVoiceProvider>);
    start();
    view.rerender(<ManagedVoiceProvider><input aria-label="Other chat" /></ManagedVoiceProvider>);
    const floating = screen.getByRole("complementary");
    const left = parseFloat(floating.style.left);
    const stage = screen.getByRole("img", { name: /voice visualization|Visualização/ });
    const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 200, button: 0 });
    Object.defineProperty(down, "pointerId", { value: 1 });
    fireEvent(stage, down);
    act(() => {
      for (const type of ["pointermove", "pointerup"]) {
        const event = new Event(type);
        Object.assign(event, { pointerId: 1, clientX: 77, clientY: 245 });
        window.dispatchEvent(event);
      }
    });
    expect(floating.style.left).toBe(`${left - 123}px`);
    const saved = floating.getAttribute("style");
    view.rerender(<ManagedVoiceProvider><ManagedVoiceChat {...original} /></ManagedVoiceProvider>);
    expect(screen.queryByRole("complementary")).toBeNull();
    view.rerender(<ManagedVoiceProvider><input aria-label="Other chat" /></ManagedVoiceProvider>);
    expect(screen.getByRole("complementary").getAttribute("style")).toBe(saved);
    expect(mock.close).not.toHaveBeenCalled();
  });
  it("survives the chat subtree unmount with detached controls and an explicit return", () => {
    const p = { ...setup(), conversation: "original", label: "Design team · Planning", onReturn: vi.fn() };
    const view = render(<ManagedVoiceProvider><ManagedVoiceChat {...p} /></ManagedVoiceProvider>);
    start();
    view.rerender(<ManagedVoiceProvider><input aria-label="Another draft" /></ManagedVoiceProvider>);
    expect(mock.close).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary")).toHaveAccessibleName(/Design team · Planning/);
    expect(screen.getByRole("complementary").querySelectorAll("button")).toHaveLength(4);
    expect(screen.queryByText("Design team · Planning")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Another draft" }), { target: { value: "Independent typing" } });
    expect(screen.getByRole("textbox")).toHaveValue("Independent typing");
    fireEvent.click(screen.getByRole("button", { name: /Voltar à conversa|Return to conversation/ }));
    expect(p.onReturn).toHaveBeenCalledWith("original");
    fireEvent.click(screen.getByRole("button", { name: /Silenciar microfone|Mute microphone/ }));
    expect(mock.setMicrophoneMuted).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /Encerrar chamada|End voice call/ }));
    expect(mock.close).toHaveBeenCalledOnce();
    act(() => mock.callbacks!.stopped?.(new Error("Final transcript failed")));
    expect(screen.getByRole("alert")).toHaveTextContent("Final transcript failed");
    fireEvent.click(screen.getByRole("button", { name: /Fechar|Close/ }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("replaces the original only on explicit voice activation in another conversation", () => {
    const original = { ...setup(), conversation: "original" };
    const other = { ...setup(), conversation: "other", agentId: "other-agent" };
    const view = render(<ManagedVoiceProvider><ManagedVoiceChat {...original} /></ManagedVoiceProvider>);
    start();
    const oldCallbacks = mock.callbacks!;
    view.rerender(<ManagedVoiceProvider><ManagedVoiceChat {...other} /></ManagedVoiceProvider>);
    expect(mock.close).not.toHaveBeenCalled();
    start();
    expect(mock.close).toHaveBeenCalledOnce();
    expect(mock.start).toHaveBeenLastCalledWith(expect.objectContaining({ agentId: "other-agent", conversationId: "other" }));
    act(() => { oldCallbacks.failed(new Error("Late failure")); oldCallbacks.stopped?.(new Error("Late save")); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("img", { name: /voice visualization|Visualização/ })).toHaveLength(1);
    expect(mock.close).toHaveBeenCalledOnce();
  });
  it("captures the saved voice on activation and applies changes only to the next call", () => {
    useVoicePreference.getState().choose("marin");
    render(<ManagedVoiceChat {...setup()} />);
    start();
    expect(mock.start).toHaveBeenCalledWith(
      expect.objectContaining({ voice: "marin" }),
    );
    mock.close.mockClear();
    act(() => {
      useVoicePreference.getState().choose("cedar");
    });
    expect(mock.start).toHaveBeenCalledTimes(1);
    expect(mock.close).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: /End voice call|Encerrar chamada/ }),
    );
    start();
    expect(mock.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ voice: "cedar" }),
    );
  });
  it("omits a voice override when the native default is selected", () => {
    render(<ManagedVoiceChat {...setup()} />);
    start();
    expect(mock.start.mock.calls[0][0]).not.toHaveProperty("voice");
  });
  it("preserves pending startup association after navigation without selecting the origin", () => {
    mock.start.mockReturnValueOnce(false);
    const p = setup();
    const view = render(<ManagedVoiceChat {...p} selectionToken={null} />);
    start();
    view.rerender(<ManagedVoiceChat {...p} selectionToken="different" />);
    act(() => { expect(mock.callbacks!.associated("late-created")).toBe(true); });
    expect(p.onAssociated).toHaveBeenCalledWith("late-created");
    expect(mock.close).not.toHaveBeenCalled();
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
  it("shows the hexagon only during a call and updates its output level without rerendering", () => {
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
  it("keeps the call visible when the user selects a different conversation", () => {
    const props = setup();
    const view = render(
      <ManagedVoiceChat {...props} conversation="original" />,
    );
    start();
    mock.close.mockClear();
    view.rerender(<ManagedVoiceChat {...props} conversation="different" />);
    expect(mock.close).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary")).toBeVisible();
  });
  it("keeps the access mode captured at call start", async () => {
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
      expect.objectContaining({ accessMode: "standard" }),
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

it("shows independent mute controls only during the call and resets on restart", () => {
  const props = setup();
  render(<ManagedVoiceChat {...props} />);
  expect(
    screen.queryByRole("button", { name: "Silenciar microfone" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Conversar por voz" }));
  fireEvent.click(screen.getByRole("button", { name: "Silenciar microfone" }));
  expect(mock.setMicrophoneMuted).toHaveBeenLastCalledWith(true);
  expect(
    screen.getByRole("button", { name: "Ativar microfone" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Silenciar assistente" }));
  expect(mock.setOutputMuted).toHaveBeenLastCalledWith(true);
  expect(mock.close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Encerrar chamada" }));
  expect(
    screen.queryByRole("button", { name: "Ativar som do assistente" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Conversar por voz" }));
  expect(
    screen.getByRole("button", { name: "Silenciar microfone" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    screen.getByRole("button", { name: "Silenciar assistente" }),
  ).toHaveAttribute("aria-pressed", "false");
});
