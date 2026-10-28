import { beforeEach, describe, it, expect, vi } from "vitest";
import { createThemeController } from "./theme";
const key = "beeteam.theme";
function system(initial: boolean) {
  let dark = initial;
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) =>
      listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", () => media);
  return {
    change(value: boolean) {
      dark = value;
      listeners.forEach((fn) => fn());
    },
    listeners,
  };
}
beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  vi.restoreAllMocks();
});
describe("theme preference", () => {
  it("follows the system on first opening and reacts to system changes", () => {
    const os = system(true);
    const theme = createThemeController(window);
    expect(theme.store.getState().preference).toBe("system");
    expect(document.documentElement).toHaveClass("dark");
    os.change(false);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(key)).toBeNull();
    theme.dispose();
    expect(os.listeners.size).toBe(0);
  });
  it.each(["light", "dark"] as const)(
    "persists %s, restores on reload and overrides system changes",
    (preference) => {
      const os = system(preference === "light");
      const first = createThemeController(window);
      first.store.getState().setPreference(preference);
      expect(localStorage.getItem(key)).toBe(preference);
      first.dispose();
      const reloaded = createThemeController(window);
      os.change(preference === "light");
      expect(reloaded.store.getState().resolved).toBe(preference);
      expect(document.documentElement.classList.contains("dark")).toBe(
        preference === "dark",
      );
      reloaded.dispose();
    },
  );
  it("returns to the current system theme and resumes listening", () => {
    const os = system(false);
    const theme = createThemeController(window);
    theme.store.getState().setPreference("dark");
    os.change(true);
    os.change(false);
    expect(theme.store.getState().resolved).toBe("dark");
    theme.store.getState().setPreference("system");
    expect(theme.store.getState().resolved).toBe("light");
    os.change(true);
    expect(theme.store.getState().resolved).toBe("dark");
    theme.dispose();
  });
  it("treats invalid saved values as system and survives unavailable storage", () => {
    system(true);
    localStorage.setItem(key, "invalid");
    const invalid = createThemeController(window);
    expect(invalid.store.getState().resolved).toBe("dark");
    invalid.dispose();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const blocked = createThemeController(window);
    expect(() => blocked.store.getState().setPreference("light")).not.toThrow();
    expect(blocked.store.getState().resolved).toBe("light");
    blocked.dispose();
  });
});
