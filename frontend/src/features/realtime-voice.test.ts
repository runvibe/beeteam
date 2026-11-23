import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeVoice } from "./realtime-voice";
import { VoiceOutputMeter } from "./voice-output-meter";
import type { VoiceApi } from "@/api/voice";

const stopTrack = vi.fn();
const closePeer = vi.fn();
const remote = vi.fn();
let latestPeer: Peer;
class Peer {
  constructor() {
    latestPeer = this;
  }
  ontrack:
    | ((event: { streams: MediaStream[]; track: MediaStreamTrack }) => void)
    | null = null;
  onconnectionstatechange = null;
  addTrack = vi.fn();
  createDataChannel = vi.fn();
  createOffer = vi.fn(async () => ({ sdp: "offer" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = remote;
  close = closePeer;
}
const media = {
  getTracks: () => [{ stop: stopTrack }],
} as unknown as MediaStream;
function fixture() {
  const api: VoiceApi = {
    start: vi.fn(async () => ({
      id: "session",
      sdp: "answer",
      conversationId: "conversation",
    })),
    events: vi.fn(async () => ({ events: [], cursor: 0 })),
    result: vi.fn(async () => ({})),
    context: vi.fn(async () => ({})),
    stop: vi.fn(async () => ({})),
  };
  const callbacks = {
    connected: vi.fn(),
    associated: vi.fn(() => true),
    stopped: vi.fn(),
    outputLevel: vi.fn(),
    failed: vi.fn(),
    transcript: vi.fn(),
    execute: vi.fn(async () => ({ state: "queued" })),
  };
  return { api, callbacks, voice: new RealtimeVoice(api, callbacks) };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal(
    "Audio",
    class {
      autoplay = false;
      srcObject = null;
      pause = vi.fn();
      play = vi.fn(async () => {});
    },
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => media) },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("native realtime voice lifecycle", () => {
  it("associates a conversation before consuming transcript events and never executes a transcript", async () => {
    const { voice, api, callbacks } = fixture();
    const ordering: string[] = [];
    callbacks.associated.mockImplementation(() => {
      ordering.push("associated");
      return true;
    });
    callbacks.transcript.mockImplementation(() => {
      ordering.push("transcript");
    });
    vi.mocked(api.events).mockResolvedValue({
      events: [
        { cursor: 1, type: "transcript", role: "user", content: "Hello" },
        {
          cursor: 2,
          type: "transcript",
          role: "assistant",
          content: "Welcome",
        },
      ],
      cursor: 2,
    });
    await voice.start({ agentId: "agent" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ordering).toEqual(["associated", "transcript", "transcript"]);
    expect(callbacks.execute).not.toHaveBeenCalled();
    voice.close();
  });
  it("releases media immediately and reports final transcript save failure from stop", async () => {
    const { voice, api, callbacks } = fixture();
    let rejectStop!: (error: Error) => void;
    vi.mocked(api.stop).mockReturnValue(
      new Promise((_, reject) => {
        rejectStop = reject;
      }),
    );
    await voice.start({ agentId: "agent" });
    voice.close();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(callbacks.stopped).not.toHaveBeenCalled();
    rejectStop(new Error("save failed"));
    await vi.advanceTimersByTimeAsync(0);
    expect(callbacks.stopped).toHaveBeenCalledWith(expect.any(Error));
  });
  it("analyses only the received assistant stream, never the microphone", async () => {
    const attach = vi.spyOn(VoiceOutputMeter.prototype, "attach");
    const close = vi.spyOn(VoiceOutputMeter.prototype, "close");
    const { voice } = fixture();
    await voice.start({ agentId: "agent" });
    expect(attach).not.toHaveBeenCalled();
    const output = {} as MediaStream;
    latestPeer.ontrack!({ streams: [output], track: {} as MediaStreamTrack });
    expect(attach).toHaveBeenCalledExactlyOnceWith(output);
    expect(attach).not.toHaveBeenCalledWith(media);
    voice.close();
    expect(close).toHaveBeenCalledOnce();
  });
  it("stops media and deletes the native session on close", async () => {
    const { voice, api } = fixture();
    await voice.start({ agentId: "agent" });
    expect(api.start).toHaveBeenCalledWith("offer", { agentId: "agent" });
    expect(remote).toHaveBeenCalledWith({ type: "answer", sdp: "answer" });
    voice.close();
    voice.close();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(closePeer).toHaveBeenCalledTimes(1);
    expect(api.stop).toHaveBeenCalledTimes(1);
  });
  it("releases a microphone granted after cancellation", async () => {
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { voice, api } = fixture();
    const starting = voice.start({ agentId: "agent" });
    voice.close();
    resolve(media);
    await starting;
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(api.start).not.toHaveBeenCalled();
  });
  it("deletes a native session returned after cancellation", async () => {
    const { voice, api } = fixture();
    let resolve!: (value: {
      id: string;
      sdp: string;
      conversationId: string;
    }) => void;
    vi.mocked(api.start).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const starting = voice.start({ agentId: "agent" });
    await vi.waitFor(() => expect(api.start).toHaveBeenCalled());
    voice.close();
    resolve({
      id: "late-session",
      sdp: "answer",
      conversationId: "late-conversation",
    });
    await starting;
    expect(api.stop).toHaveBeenCalledWith("late-session");
    expect(remote).not.toHaveBeenCalled();
  });
  it("dispatches a repeated tool event once while polling continues", async () => {
    const { voice, api, callbacks } = fixture();
    let finish!: (value: { state: string }) => void;
    callbacks.execute.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    const event = {
      cursor: 1,
      type: "execute_codex" as const,
      callId: "call",
      content: "Run tests",
    };
    vi.mocked(api.events).mockResolvedValue({
      events: [event, { ...event, cursor: 2 }],
      cursor: 2,
    });
    await voice.start({ agentId: "agent" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(callbacks.execute).toHaveBeenCalledOnce();
    expect(api.events).toHaveBeenCalledTimes(3);
    finish({ state: "queued" });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.result).toHaveBeenCalledWith(
      "session",
      "call",
      '{"state":"queued"}',
    );
    expect(api.stop).not.toHaveBeenCalled();
    voice.close();
  });
  it("reports an uncertain dispatch without replaying inference", async () => {
    const { voice, api, callbacks } = fixture();
    callbacks.execute.mockRejectedValue(new Error("timeout"));
    vi.mocked(api.events).mockResolvedValue({
      events: [
        {
          cursor: 1,
          type: "execute_codex",
          callId: "call",
          content: "Run tests",
        },
      ],
      cursor: 1,
    });
    await voice.start({ agentId: "agent" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(callbacks.execute).toHaveBeenCalledOnce();
    expect(api.result).toHaveBeenCalledWith(
      "session",
      "call",
      expect.stringContaining('"state":"unknown"'),
    );
    voice.close();
  });
});
