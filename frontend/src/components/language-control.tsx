import {
  useLocale,
  t,
  getLocalePreference,
  setLocalePreference,
  type LocalePreference,
} from "@/i18n";

import { Choice } from "./shared";
export function LanguageControl() {
  useLocale();
  return (
    <section className="detail-section">
      <Choice
        label={t("settings.language")}
        value={getLocalePreference()}
        onChange={(value) => setLocalePreference(value as LocalePreference)}
        options={[
          { value: "auto", label: t("settings.automaticLanguage") },
          { value: "en", label: t("settings.english") },
          { value: "pt", label: t("settings.portuguese") },
        ]}
      />
      <p className="small-note">{t("settings.languageHelp")}</p>
    </section>
  );
}
