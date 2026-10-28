import { useStore } from "zustand";
import { Monitor, Sun, Moon } from "lucide-react";
import { themeController } from "@/state/theme-runtime";
import { isThemePreference } from "@/state/theme";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "./ui/select";
export function ThemeControl() {
  const preference = useStore(themeController.store, (s) => s.preference);
  const Icon =
    preference === "system" ? Monitor : preference === "dark" ? Moon : Sun;
  return (
    <Select
      value={preference}
      onValueChange={(value) => {
        if (isThemePreference(value))
          themeController.store.getState().setPreference(value);
      }}
    >
      <SelectTrigger
        aria-label="Tema"
        title="Tema: claro, escuro ou sistema"
        className="theme-control"
      >
        <Icon aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="system">Sistema</SelectItem>
          <SelectItem value="light">Claro</SelectItem>
          <SelectItem value="dark">Escuro</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
