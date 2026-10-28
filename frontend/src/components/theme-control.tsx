import { useStore } from "zustand";
import { Sun, Moon } from "lucide-react";
import { themeController } from "@/state/theme-runtime";
import { Button } from "./ui/button";
export function ThemeControl() {
  const resolved = useStore(themeController.store, (s) => s.resolved);
  const next = resolved === "dark" ? "light" : "dark";
  const label = next === "light" ? "Ativar tema claro" : "Ativar tema escuro";
  const Icon = next === "light" ? Sun : Moon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => themeController.store.getState().setPreference(next)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
