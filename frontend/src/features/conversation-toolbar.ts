import { useLayoutEffect, useRef } from "react";

/** Stack below the actual tab strip, including responsive wrapping and zoom. */
export function useConversationToolbar() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const toolbar = ref.current;
    const tabs = toolbar
      ?.closest(".task-detail-tabs")
      ?.querySelector<HTMLElement>(".task-section-navigation");
    if (!toolbar || !tabs) return;
    const measure = () => {
      const inset = Number.parseFloat(getComputedStyle(tabs).top) || 0;
      toolbar.style.top = `${tabs.getBoundingClientRect().height + inset}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tabs);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return ref;
}
