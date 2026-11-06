import { useLayoutEffect, type RefObject } from "react";

export function useDetailListRoom(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || !enabled) return;
    const panel = list.closest("[data-detail-scroll]");
    const measure = () => {
      const bottom = Math.min(window.innerHeight, panel?.getBoundingClientRect().bottom ?? window.innerHeight);
      const available = Math.max(0, bottom - list.getBoundingClientRect().top - 8);
      list.style.setProperty("--detail-list-room", available + "px");
    };
    measure();
    panel?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (panel) observer?.observe(panel);
    return () => {
      panel?.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      list.style.removeProperty("--detail-list-room");
    };
  }, [ref, enabled]);
}
