import { useStore } from "zustand";
import { themeController } from "./theme-runtime";

export function useSiteLink() {
  const theme = useStore(themeController.store, state => state.preset);
  const mode = useStore(themeController.store, state => state.resolved);
  return (path: string) => {
    const url = new URL(path, "https://getbee.team");
    url.searchParams.set("theme", theme);
    url.searchParams.set("mode", mode);
    return url.href;
  };
}
