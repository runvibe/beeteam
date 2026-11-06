import { useRef, type ComponentProps } from "react";
import { revealTheme } from "@/state/theme-reveal";
import { useStore } from "zustand";
import { useLocale, t } from "@/i18n";
import { themeController } from "@/state/theme-runtime";
import { type ThemePreference, type ThemePreset } from "@/state/theme";
import { Choice } from "./shared";
function ThemeChoice({ onChange, ...props }: ComponentProps<typeof Choice>) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Choice {...props} triggerRef={trigger} onChange={(value) => {
      if (value === props.value) return;
      if (trigger.current) revealTheme(trigger.current, () => onChange(value));
      else onChange(value);
    }} />
  );
}

export function AppearanceSettings() {
  useLocale();
  const preset = useStore(themeController.store, (s) => s.preset);
  const preference = useStore(themeController.store, (s) => s.preference);
  return (
    <section className="detail-section">
      <ThemeChoice
        label={t("settings.colorPalette")}
        value={preset}
        onChange={(value) =>
          themeController.store.getState().setPreset(value as ThemePreset)
        }
        options={[
          { value: "default", label: t("settings.paletteDefault") },
          { value: "codex", label: t("settings.paletteCodex") },
          { value: "claude-code", label: t("settings.paletteClaudeCode") },
          { value: "copilot", label: t("settings.paletteCopilot") },
        ]}
      />
      <ThemeChoice
        label={t("settings.appearance")}
        value={preference}
        onChange={(value) =>
          themeController.store
            .getState()
            .setPreference(value as ThemePreference)
        }
        options={[
          { value: "system", label: t("settings.systemAppearance") },
          { value: "light", label: t("settings.lightAppearance") },
          { value: "dark", label: t("settings.darkAppearance") },
        ]}
      />
      <p className="small-note">{t("settings.appearanceHelp")}</p>
    </section>
  );
}
