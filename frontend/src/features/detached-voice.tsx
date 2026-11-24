import { useState } from "react";
import { CornerUpLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import { VoiceAvatar } from "./voice-avatar";
import type { VoiceSessionOwner, VoiceSnapshot } from "./voice-session-owner";
import { useVoiceDrag, type VoicePosition } from "./use-voice-drag";
export function DetachedVoice({
  owner,
  snapshot,
  position,
  onPositionChange,
}: {
  owner: VoiceSessionOwner;
  snapshot: VoiceSnapshot;
  position: VoicePosition | null;
  onPositionChange: (position: VoicePosition) => void;
}) {
  useLocale();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const drag = useVoiceDrag({ element, position, onPositionChange });
  const context = snapshot.origin?.label || t("managed.new");
  return (
    <aside
      ref={setElement}
      className="voice-detached"
      aria-label={`${t("managed.voiceDetached")}: ${context}`}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <VoiceAvatar
        owner={owner}
        snapshot={snapshot}
        dragHandle={{
          ...drag,
          title: `${context} · ${t("managed.voiceDrag")}`,
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="voice-mute-button voice-return-button"
        aria-label={t("managed.voiceReturn")}
        title={`${t("managed.voiceReturn")}: ${context}`}
        disabled={!snapshot.conversation}
        onClick={() => snapshot.origin?.onReturn?.(snapshot.conversation)}
      >
        <CornerUpLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="voice-mute-button voice-end-button"
        aria-label={t("managed.voiceStop")}
        title={t("managed.voiceStop")}
        onClick={owner.stop}
      >
        <X />
      </Button>
    </aside>
  );
}

export function VoiceErrorNotice({
  owner,
  snapshot,
  detached = false,
}: {
  owner: VoiceSessionOwner;
  snapshot: VoiceSnapshot;
  detached?: boolean;
}) {
  useLocale();
  if (!snapshot.error) return null;
  return (
    <div className={detached ? "voice-error-notice" : "voice-inline-error"}>
      {detached && <p>{snapshot.origin?.label || t("managed.new")}</p>}
      <p role="alert">{snapshot.error}</p>
      {detached && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!snapshot.conversation}
          onClick={() => snapshot.origin?.onReturn?.(snapshot.conversation)}
        >
          {t("managed.voiceReturn")}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={owner.dismissError}>
        {t("common.close")}
      </Button>
    </div>
  );
}
