import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

const query = "(max-width: 1055px)";
// The compact detail threshold is based on content width, not the rail.
const compactContentWidth = 987;
export const DetailContainerContext = createContext<HTMLElement | null>(null);

export function useDetailMobile() {
  const container = useContext(DetailContainerContext);
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", notify);
      const resize =
        container && typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(notify)
          : null;
      if (container) resize?.observe(container);
      return () => {
        media?.removeEventListener("change", notify);
        resize?.disconnect();
      };
    },
    [container],
  );
  const snapshot = useCallback(() => {
    const width = container?.clientWidth ?? 0;
    return (
      (window.matchMedia?.(query).matches ?? false) ||
      (width > 0 && width <= compactContentWidth)
    );
  }, [container]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
