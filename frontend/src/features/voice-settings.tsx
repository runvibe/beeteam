import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Choice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import { useVoicePreference } from "@/state/voice-preference";

export function VoiceSettings() {
  useLocale();
  const { managedAgents } = useApi();
  const voiceId = useVoicePreference((state) => state.voiceId);
  const choose = useVoicePreference((state) => state.choose);
  const catalog = useQuery({
    queryKey: ["voice-catalog"],
    queryFn: () => managedAgents!.voice.voices(),
    enabled: !!managedAgents,
    staleTime: 30000,
    retry: false,
  });
  const voices = catalog.data?.voices ?? [];
  const missing = !!voiceId && !voices.some((voice) => voice.id === voiceId);
  const options = voices.map((voice) => ({
    value: voice.id,
    label: voice.name,
  }));
  if (missing)
    options.push({
      value: voiceId,
      label: t(
        catalog.isSuccess
          ? "settings.voiceUnavailableChoice"
          : "settings.voiceSavedChoice",
        { voice: voiceId },
      ),
    });

  return (
    <section className="detail-section">
      <Choice
        label={t("settings.voiceLabel")}
        value={voiceId ?? ""}
        all={t("settings.voiceDefault")}
        options={options}
        onChange={(next) => {
          if (!next) choose(null);
          else if (voices.some((voice) => voice.id === next)) choose(next);
        }}
      />
      <p className="small-note">{t("settings.voiceHelp")}</p>
      {catalog.isFetching && (
        <p className="small-note" role="status">
          {t("settings.voiceLoading")}
        </p>
      )}
      {!managedAgents && (
        <p className="small-note" role="status">
          {t("settings.voiceUnavailable")}
        </p>
      )}
      {catalog.error && (
        <div role="alert">
          <p className="small-note">{t("settings.voiceLoadFailed")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={catalog.isFetching}
            onClick={() => void catalog.refetch()}
          >
            {t("common.tryAgain")}
          </Button>
        </div>
      )}
      {missing && catalog.isSuccess && (
        <p className="small-note" role="status">
          {t("settings.voiceMissingHelp")}
        </p>
      )}
    </section>
  );
}
