import { createStore } from "zustand/vanilla";
import { createThemeController } from "./state/theme";
type State = ReturnType<
  ReturnType<typeof createThemeController>["store"]["getState"]
>;
const store = createStore<State>(() => ({
  resolved: "light",
  preset: "default",
  preference: "system",
  setPreference: () => {},
  setPreset: () => {},
}));
let browser: ReturnType<typeof createThemeController> | undefined;
export const themeController = { store, dispose: () => browser?.dispose() };
export function startTheme() {
  if (browser || typeof window === "undefined") return;
  browser = createThemeController(window);
  store.setState(browser.store.getState());
  browser.store.subscribe((state) => store.setState(state));
}
