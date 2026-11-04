import { createStore } from "zustand/vanilla";
export const themePresets = [
  "default",
  "codex",
  "claude-code",
  "copilot",
] as const;
export type ThemePreset = (typeof themePresets)[number];
export const paletteStorageKey = "beeteam.palette";
export const isThemePreset = (value: unknown): value is ThemePreset =>
  themePresets.includes(value as ThemePreset);
export type ThemePreference = "system" | "light" | "dark";
export const themeStorageKey = "beeteam.theme";
export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";
interface ThemeState {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}
/** Appearance only: never persists API records or credentials. */
export function createThemeController(target: Window) {
  const media = target.matchMedia?.("(prefers-color-scheme: dark)");
  const read = (): ThemePreference => {
    try {
      const saved = target.localStorage.getItem(themeStorageKey);
      return isThemePreference(saved) ? saved : "system";
    } catch {
      return "system";
    }
  };
  const readPreset = (): ThemePreset => {
    try {
      const value = target.localStorage.getItem(paletteStorageKey);
      return isThemePreset(value) ? value : "default";
    } catch {
      return "default";
    }
  };
  const applyPreset = (preset: ThemePreset) => {
    target.document.documentElement.dataset.palette = preset;
  };
  const resolve = (preference: ThemePreference): "light" | "dark" =>
    preference === "system" ? (media?.matches ? "dark" : "light") : preference;
  const apply = (resolved: "light" | "dark") => {
    const root = target.document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  };
  const preference = read();
  const store = createStore<ThemeState>((set) => ({
    preference,
    preset: readPreset(),
    setPreset(next) {
      if (!isThemePreset(next)) return;
      try {
        target.localStorage.setItem(paletteStorageKey, next);
      } catch {
        /* Session-only preference. */
      }
      applyPreset(next);
      set({ preset: next });
    },
    resolved: resolve(preference),
    setPreference(next) {
      if (!isThemePreference(next)) return;
      try {
        target.localStorage.setItem(themeStorageKey, next);
      } catch {
        /* Storage may be disabled; this session still changes theme. */
      }
      const resolved = resolve(next);
      apply(resolved);
      set({ preference: next, resolved });
    },
  }));
  const onSystemChange = () => {
    const state = store.getState();
    if (state.preference === "system") {
      const resolved = resolve("system");
      apply(resolved);
      store.setState({ resolved });
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === paletteStorageKey || event.key === null) {
      const preset = readPreset();
      applyPreset(preset);
      store.setState({ preset });
    }
    if (event.key === themeStorageKey || event.key === null) {
      const preference = read(),
        resolved = resolve(preference);
      apply(resolved);
      store.setState({ preference, resolved });
    }
  };
  apply(store.getState().resolved);
  applyPreset(store.getState().preset);
  media?.addEventListener("change", onSystemChange);
  target.addEventListener("storage", onStorage);
  return {
    store,
    dispose() {
      media?.removeEventListener("change", onSystemChange);
      target.removeEventListener("storage", onStorage);
    },
  };
}
