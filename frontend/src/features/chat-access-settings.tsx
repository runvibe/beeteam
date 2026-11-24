import { t, useLocale } from "@/i18n";
import { Choice } from "@/components/shared";
import { accessModes, isAccessMode, useChatAccess } from "@/state/chat-access";
import { accessLabel, confirmAccess } from "./chat-access-labels";

export function ChatAccessSettings() {
  useLocale();
  const mode = useChatAccess((state) => state.defaultMode);
  const setDefault = useChatAccess((state) => state.setDefault);
  return (
    <section className="detail-section">
      <h3>{t("settings.chatAccessSection")}</h3>
      <Choice
        label={t("settings.chatDefaultAccess")}
        value={mode}
        onChange={(next) => {
          if (isAccessMode(next) && next !== mode && confirmAccess(next))
            setDefault(next);
        }}
        options={accessModes.map((value) => ({ value, label: accessLabel(value) }))}
      />
      <p className="small-note">{t("settings.chatDefaultAccessHelp")}</p>
      <p className="small-note">{t("managed.chatToolsFile")}</p>
    </section>
  );
}
