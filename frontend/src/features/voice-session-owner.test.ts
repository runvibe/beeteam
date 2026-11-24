import { describe, expect, it, vi } from "vitest";
import {
  VoiceSessionOwner,
  type ManagedVoiceProps,
} from "./voice-session-owner";
import type { VoiceCallbacks } from "./realtime-voice";
import { VoiceNotSubmitted } from "./voice-delivery-error";
const calls = vi.hoisted(
  () => [] as { callbacks: VoiceCallbacks; close: ReturnType<typeof vi.fn> }[],
);
vi.mock("./realtime-voice", () => ({
  RealtimeVoice: class {
    close = vi.fn();
    report = vi.fn();
    hydrate = vi.fn();
    setMicrophoneMuted = vi.fn();
    setOutputMuted = vi.fn();
    callbacks: VoiceCallbacks;
    constructor(_api: unknown, callbacks: VoiceCallbacks) {
      this.callbacks = callbacks;
      calls.push(this);
    }
    start = vi.fn();
  },
}));
function context(conversation = "origin"): ManagedVoiceProps {
  return {
    api: {
      voice: {},
      snapshot: vi.fn(async () => ({
        request: { state: "completed" },
        messages: { items: [] },
      })),
    } as unknown as ManagedVoiceProps["api"],
    agentId: "agent",
    teamId: "team",
    conversation,
    selectionToken: conversation,
    contextMessages: [],
    accessMode: "standard",
    disabled: false,
    readOnly: false,
    onAssociated: vi.fn(),
    onTranscript: vi.fn(),
    onQueued: vi.fn(),
    onSelect: vi.fn(),
    onSend: vi.fn(
      async () =>
        ({
          id: "request",
          conversationId: conversation,
          state: "queued",
        }) as never,
    ),
  };
}
describe("app lifetime voice owner", () => {
  it("keeps origin routing and access while other views attach and detach", async () => {
    const owner = new VoiceSessionOwner();
    const origin = context();
    owner.start(origin);
    const call = calls.at(-1)!;
    call.callbacks.associated("origin");
    const other = {
      ...context("other"),
      agentId: "other-agent",
      accessMode: "full_access" as const,
    };
    owner.updateView(other);
    owner.updateView(null);
    expect(call.close).not.toHaveBeenCalled();
    await call.callbacks.execute("Run", "1");
    expect(origin.onSend).toHaveBeenCalledWith({
      content: "Run",
      accessMode: "standard",
      conversationId: "origin",
    });
    expect(other.onSend).not.toHaveBeenCalled();
    owner.dispose();
  });
  it("accepts pending association after navigation but does not replace a newer call", () => {
    const owner = new VoiceSessionOwner();
    owner.start(context(""));
    const first = calls.at(-1)!;
    const other = context("other");
    owner.updateView(other);
    expect(first.callbacks.associated("created")).toBe(true);
    expect(other.onSelect).not.toHaveBeenCalled();
    expect(owner.snapshot().conversation).toBe("created");
    owner.start(context("other"));
    const second = calls.at(-1)!;
    expect(first.close).toHaveBeenCalledOnce();
    first.callbacks.failed(new Error("late"));
    first.callbacks.stopped?.(new Error("late save"));
    expect(first.callbacks.associated("stale")).toBe(false);
    expect(owner.snapshot().conversation).toBe("other");
    expect(second.close).not.toHaveBeenCalled();
    owner.dispose();
  });
  it("keeps voice usable after a known unsubmitted text collision", async () => {
    const owner = new VoiceSessionOwner();
    const origin = context();
    vi.mocked(origin.onSend).mockRejectedValueOnce(
      new VoiceNotSubmitted("busy"),
    );
    owner.start(origin);
    const call = calls.at(-1)!;
    call.callbacks.associated("origin");
    expect(await call.callbacks.execute("Run", "1")).toMatchObject({
      state: "not_submitted",
    });
    expect(await call.callbacks.execute("Run", "2")).toMatchObject({
      accepted: true,
    });
    expect(origin.onSend).toHaveBeenCalledTimes(2);
    owner.dispose();
  });
  it("never retries an uncertain submission and retains origin transcript invalidations", async () => {
    const owner = new VoiceSessionOwner();
    const origin = context();
    vi.mocked(origin.onSend).mockRejectedValue(new Error("network"));
    owner.start(origin);
    const call = calls.at(-1)!;
    call.callbacks.associated("origin");
    owner.updateView(null);
    expect(await call.callbacks.execute("Run", "1")).toMatchObject({
      state: "unknown",
      retrySubmission: false,
    });
    owner.dismissError();
    expect(owner.snapshot().error).toBe("");
    expect(call.close).not.toHaveBeenCalled();
    expect(await call.callbacks.execute("Run", "2")).toMatchObject({
      state: "not_submitted",
    });
    expect(origin.onSend).toHaveBeenCalledOnce();
    owner.stop();
    call.callbacks.stopped?.();
    expect(origin.onTranscript).toHaveBeenCalledWith("origin");
    owner.dispose();
  });
});
