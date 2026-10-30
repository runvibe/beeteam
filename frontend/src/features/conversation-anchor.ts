import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
type Anchor = { id?: string; inset: number; top: number; bottom: boolean };
const positions = new Map<string, Anchor>();
export function useConversationAnchor(
  list: RefObject<HTMLElement | null>,
  identity: string,
  version: unknown,
  latest: boolean,
) {
  const anchor = useRef<Anchor | undefined>(positions.get(identity));
  const initialized = useRef(false);
  const root = () =>
    list.current?.closest<HTMLElement>("[data-detail-scroll]") ?? null;
  const scrollRoot = () =>
    window.matchMedia?.("(min-width: 1056px)").matches
      ? root()
      : (document.scrollingElement as HTMLElement | null);
  const capture = () => {
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
    anchor.current = {
      id: first?.dataset.commentId,
      inset: first ? first.getBoundingClientRect().top - bounds : 0,
      top: scroller.scrollTop,
      bottom:
        scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <=
        48,
    };
    positions.set(identity, anchor.current);
    if (positions.size > 128) positions.delete(positions.keys().next().value!);
  };
  const restore = () => {
    const node = list.current,
      scroller = scrollRoot();
    if (!node || !scroller || !node.querySelector("[data-comment-id]")) return;
    const saved = anchor.current;
    if (saved?.bottom || (!initialized.current && latest && !saved))
      scroller.scrollTop = scroller.scrollHeight;
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
    scroller?.addEventListener("scroll", capture, { passive: true });
    const rebind = () => {
      scroller?.removeEventListener("scroll", capture);
      scroller = scrollRoot();
      scroller?.addEventListener("scroll", capture, { passive: true });
      restore();
    };
    window.addEventListener("resize", rebind);
    window.addEventListener("scroll", capture, { passive: true });
    const resize = new ResizeObserver(restore);
    if (node) resize.observe(node);
    node?.addEventListener("load", restore, true);
    return () => {
      capture();
      resize.disconnect();
      scroller?.removeEventListener("scroll", capture);
      window.removeEventListener("resize", rebind);
      window.removeEventListener("scroll", capture);
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
