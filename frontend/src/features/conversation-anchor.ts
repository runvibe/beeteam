import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
type Anchor = { id?: string; inset: number; top: number; bottom: boolean };
export function useConversationAnchor(
  list: RefObject<HTMLElement | null>,
  identity: string,
  version: unknown,
) {
  const anchor = useRef<Anchor | undefined>(undefined);
  const initialized = useRef(false);
  const root = () =>
    list.current?.closest<HTMLElement>("[data-detail-scroll]") ?? null;
  const scrollRoot = () =>
    window.matchMedia?.("(min-width: 1056px)").matches
      ? root()
      : (document.scrollingElement as HTMLElement | null);
  const capture = (forceMessage = false) => {
    const node = list.current,
      scroller = scrollRoot();
    if (!node || !scroller) return;
    const bounds =
      scroller === document.scrollingElement
        ? 0
        : scroller.getBoundingClientRect().top;
    const rows = Array.from(
      node.querySelectorAll<HTMLElement>("[data-comment-id]"),
    );
    const first = rows.find(
      (row) => row.getBoundingClientRect().bottom > bounds,
    );
    const tabs = node
      .closest(".task-detail-tabs")
      ?.querySelector<HTMLElement>(".detail-section-navigation");
    const reading =
      forceMessage ||
      node.getBoundingClientRect().top <=
        bounds +
          (tabs?.getBoundingClientRect().height ||
            tabs
              ?.querySelector(".detail-section-navigation-strip")
              ?.getBoundingClientRect().height ||
            0);
    anchor.current = {
      // Autofill below the task header must preserve the header, not pull a row up.
      id: reading ? first?.dataset.commentId : undefined,
      inset: first ? first.getBoundingClientRect().top - bounds : 0,
      top: scroller.scrollTop,
      bottom:
        reading &&
        scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <=
          48,
    };
  };
  const restore = () => {
    const node = list.current,
      scroller = scrollRoot();
    if (!node || !scroller || !node.querySelector("[data-comment-id]")) return;
    // Opening a tab must never reposition its shared task/document scroller.
    // Anchor only subsequent updates within this mounted conversation.
    if (!initialized.current) {
      initialized.current = true;
      capture();
      return;
    }
    const saved = anchor.current;
    if (saved?.bottom) scroller.scrollTop = scroller.scrollHeight;
    else if (saved) {
      const row = Array.from(
        node.querySelectorAll<HTMLElement>("[data-comment-id]"),
      ).find((row) => row.dataset.commentId === saved.id);
      const top =
        scroller === document.scrollingElement
          ? 0
          : scroller.getBoundingClientRect().top;
      if (row)
        scroller.scrollTop +=
          row.getBoundingClientRect().top - top - saved.inset;
      else scroller.scrollTop = saved.top;
    }
    initialized.current = true;
    capture();
  };
  useLayoutEffect(restore, [version]);
  useEffect(() => {
    const node = list.current;
    let scroller = scrollRoot();
    const onScroll = () => capture();
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    const rebind = () => {
      scroller?.removeEventListener("scroll", onScroll);
      scroller = scrollRoot();
      scroller?.addEventListener("scroll", onScroll, { passive: true });
      restore();
    };
    window.addEventListener("resize", rebind);
    window.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(restore);
    if (node) resize.observe(node);
    node?.addEventListener("load", restore, true);
    return () => {
      capture();
      resize.disconnect();
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", rebind);
      window.removeEventListener("scroll", onScroll);
      node?.removeEventListener("load", restore, true);
    };
  }, [identity]);
  return {
    capture,
    root: scrollRoot,
    atBottom: () => !!anchor.current?.bottom,
    followEnd: () => {
      anchor.current = {
        ...anchor.current,
        top: anchor.current?.top ?? 0,
        inset: anchor.current?.inset ?? 0,
        bottom: true,
      };
    },
    goToEnd: () => {
      const node = scrollRoot();
      if (node) node.scrollTop = node.scrollHeight;
      capture();
    },
  };
}
