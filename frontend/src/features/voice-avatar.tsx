import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import type { VoiceSessionOwner, VoiceSnapshot } from "./voice-session-owner";
export function VoiceAvatar({
  owner,
  snapshot,
}: {
  owner: VoiceSessionOwner;
  snapshot: VoiceSnapshot;
}) {
  useLocale();
  const { microphoneMuted, outputMuted, state } = snapshot;
  return (
    <div className="voice-avatar-overlay">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="voice-mute-button voice-mute-microphone"
        aria-pressed={microphoneMuted}
        aria-label={t(
          microphoneMuted
            ? "managed.voiceUnmuteMicrophone"
            : "managed.voiceMuteMicrophone",
        )}
        title={t(
          microphoneMuted
            ? "managed.voiceUnmuteMicrophone"
            : "managed.voiceMuteMicrophone",
        )}
        onClick={() => {
          const muted = !microphoneMuted;
          owner.muteMicrophone(muted);
        }}
      >
        {microphoneMuted ? <MicOff /> : <Mic />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="voice-mute-button voice-mute-output"
        aria-pressed={outputMuted}
        aria-label={t(
          outputMuted ? "managed.voiceUnmuteOutput" : "managed.voiceMuteOutput",
        )}
        title={t(
          outputMuted ? "managed.voiceUnmuteOutput" : "managed.voiceMuteOutput",
        )}
        onClick={() => {
          const muted = !outputMuted;
          owner.muteOutput(muted);
        }}
      >
        {outputMuted ? <VolumeX /> : <Volume2 />}
      </Button>
      <div
        className="voice-hexagon-stage"
        data-state={state}
        ref={(element) => {
          owner.visual = element;
        }}
        role="img"
        aria-label={t("managed.voiceVisual")}
      >
        <div className="voice-hexagon-outline voice-hexagon-echo" />
        <div className="voice-hexagon-outline" />
        <div className="voice-hexagon-bars">
          <span />
          <span />
          <span />
        </div>
      </div>
      <span className="sr-only" role="status">
        {t(
          state === "connecting"
            ? "managed.voiceConnecting"
            : "managed.voiceLive",
        )}
      </span>
    </div>
  );
}
