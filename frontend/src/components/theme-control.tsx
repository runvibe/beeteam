import { useLocale, t as tr } from "@/i18n";

import { revealTheme } from "@/state/theme-reveal";
import { useStore } from "zustand";
import { Sun, Moon } from "lucide-react";
import { themeController } from "@/state/theme-runtime";
import { Button } from "./ui/button";
export function ThemeControl() {
  useLocale();
  const resolved = useStore(themeController.store, (s) => s.resolved);
  const next = resolved === "dark" ? "light" : "dark";
  const label =
    next === "light"
      ? tr("common.switchToLightTheme")
      : tr("common.switchToDarkTheme");
  const Icon = next === "light" ? Sun : Moon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={(event) => revealTheme(event.currentTarget, () => {
        themeController.store.getState().setPreference(next);
      })}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
