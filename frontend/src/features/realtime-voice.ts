import { t } from "@/i18n";
import { VoiceOutputMeter } from "./voice-output-meter";

export type VoiceTranscript = { role: "user" | "assistant"; text: string };
import type { VoiceApi, VoiceEvent, VoiceContext } from "@/api/voice";
export type VoiceCallbacks = {
  connected: () => void;
  associated: (conversationId: string) => boolean;
  stopped?: (error?: Error) => void;
  outputLevel?: (level: number) => void;
  failed: (error: Error) => void;
  transcript: (entry: VoiceTranscript) => void;
  execute: (content: string, callId: string) => Promise<unknown>;
};

/** Owns media and native Codex session resources, including cancelled startup. */
export class RealtimeVoice {
  private peer?: RTCPeerConnection;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private outputMeter?: VoiceOutputMeter;
  private sessionId?: string;
  private closed = false;
  private calls = new Set<string>();
  private pollTimer?: ReturnType<typeof setTimeout>;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private callbacks: VoiceCallbacks;
  private api: VoiceApi;

  constructor(api: VoiceApi, callbacks: VoiceCallbacks) {
    this.api = api;
    this.callbacks = callbacks;
  }

  async start(context: VoiceContext) {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !globalThis.RTCPeerConnection
      )
        throw new Error(t("managed.voiceUnsupported"));
      if (this.callbacks.outputLevel)
        this.outputMeter = new VoiceOutputMeter(this.callbacks.outputLevel);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.startupTimer = setTimeout(
        () => this.fail(new Error(t("managed.voiceConnectionFailed"))),
        60000,
      );
      const peer = new RTCPeerConnection();
      this.peer = peer;
      const audio = new Audio();
      audio.autoplay = true;
      this.audio = audio;
      peer.ontrack = (event) => {
        if (this.closed) return;
        const output = event.streams[0] ?? new MediaStream([event.track]);
        audio.srcObject = output;
        this.outputMeter?.attach(output);
        void audio
          .play()
          .catch(() => this.fail(new Error(t("managed.voicePlaybackFailed"))));
      };
      peer.onconnectionstatechange = () => {
        if (this.closed) return;
        if (peer.connectionState === "connected") {
          clearTimeout(this.startupTimer);
          this.callbacks.connected();
        }
        if (["failed", "disconnected"].includes(peer.connectionState))
          this.fail(new Error(t("managed.voiceConnectionFailed")));
      };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      // The negotiated data channel is owned by the native Codex realtime transport.
      peer.createDataChannel("oai-events");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (this.closed) return;
      const session = await this.api.start(offer.sdp ?? "", context);
      this.sessionId = session.id;
      if (this.closed) {
        await this.stopSession(session.id);
        return;
      }
      if (!this.callbacks.associated(session.conversationId)) {
        this.close();
        return;
      }
      await peer.setRemoteDescription({ type: "answer", sdp: session.sdp });
      void this.poll(0);
    } catch (error) {
      if (!this.closed)
        this.fail(
          error instanceof Error
            ? error
            : new Error(t("managed.voiceConnectionFailed")),
        );
    }
  }

  async hydrate(history: unknown) {
    if (this.closed || !this.sessionId) return;
    try {
      await this.api.context(
        this.sessionId,
        JSON.stringify({
          prior_chat_context: history,
          trustedInstructions: false,
        }),
      );
    } catch {
      this.fail(new Error(t("managed.voiceConnectionFailed")));
    }
  }

  async report(update: unknown) {
    if (this.closed || !this.sessionId) return;
    try {
      await this.api.context(
        this.sessionId,
        JSON.stringify({ codex_execution_update: update }),
      );
    } catch {
      this.fail(new Error(t("managed.voiceConnectionFailed")));
    }
  }

  private async poll(cursor: number) {
    if (this.closed || !this.sessionId) return;
    try {
      const page = await this.api.events(this.sessionId, cursor);
      if (this.closed) return;
      for (const event of page.events) {
        if (event.cursor > cursor) void this.receive(event);
      }
      if (!this.closed)
        this.pollTimer = setTimeout(() => void this.poll(page.cursor), 500);
    } catch {
      this.fail(new Error(t("managed.voiceConnectionFailed")));
    }
  }

  private async receive(event: VoiceEvent) {
    if (this.closed) return;
    if (event.type === "closed" || event.type === "error") {
      this.fail(new Error(event.content || t("managed.voiceConnectionFailed")));
      return;
    }
    if (event.type === "transcript" && event.content) {
      this.callbacks.transcript({
        role: event.role === "user" ? "user" : "assistant",
        text: event.content,
      });
      return;
    }
    if (
      event.type !== "execute_codex" ||
      !event.callId ||
      this.calls.has(event.callId)
    )
      return;
    this.calls.add(event.callId);
    let result: unknown;
    try {
      if (
        !event.content?.trim() ||
        new TextEncoder().encode(event.content).length > 65536
      )
        throw new Error(t("managed.voiceInvalidRequest"));
      result = await this.callbacks.execute(event.content, event.callId);
    } catch {
      result = { state: "unknown", retrySubmission: false };
    }
    if (this.closed || !this.sessionId) return;
    try {
      await this.api.result(
        this.sessionId,
        event.callId,
        JSON.stringify(result),
      );
    } catch {
      this.fail(new Error(t("managed.voiceConnectionFailed")));
    }
  }

  private fail(error: Error) {
    if (this.closed) return;
    this.close();
    this.callbacks.failed(error);
  }

  private async stopSession(id: string) {
    try {
      await this.api.stop(id);
      this.callbacks.stopped?.();
    } catch {
      this.callbacks.stopped?.(new Error(t("managed.voiceSaveFailed")));
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.startupTimer);
    clearTimeout(this.pollTimer);
    this.outputMeter?.close();
    this.peer?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
    if (this.sessionId) void this.stopSession(this.sessionId);
  }
}
