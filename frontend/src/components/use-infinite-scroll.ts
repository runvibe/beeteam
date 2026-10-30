import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type Options = {
  sentinel: RefObject<HTMLElement | null>;
  getRoot: () => Element | null;
  progress: string;
  identity?: string;
  hasMore: boolean;
  fetching: boolean;
  error: unknown;
  enabled?: boolean;
  margin?: number;
  loadMore: () => unknown;
};
/** Coordinates visibility only. Query adapters own dedupe, AbortSignal and retry. */
export function useInfiniteScroll(options: Options) {
  const latest = useRef(options);
  const requested = useRef<string | null>(null);
  useLayoutEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    requested.current = null;
  }, [options.identity]);
  useEffect(() => {
    const target = options.sentinel.current;
    if (!target || options.enabled === false) return;
    let alive = true;
    let observer: IntersectionObserver | undefined;
    let resize: ResizeObserver | undefined;
    let root: Element | null = null;
    const request = () => {
      const state = latest.current;
      if (
        !alive ||
        state.enabled === false ||
        !state.hasMore ||
        state.fetching ||
        state.error ||
        requested.current === state.progress
      )
        return;
      requested.current = state.progress;
      void state.loadMore();
    };
    const measure = () => {
      const rect = target.getBoundingClientRect();
      const bounds = root?.getBoundingClientRect();
      // Hidden tabs and unmeasured elements never trigger eager loading.
      if (rect.height <= 0 || (bounds && bounds.height <= 0)) return;
      if (
        rect.width > 0 &&
        (rect.right <= Math.max(0, bounds?.left ?? 0) ||
          rect.left >=
            Math.min(window.innerWidth, bounds?.right ?? window.innerWidth))
      )
        return;
      if (bounds && (bounds.bottom <= 0 || bounds.top >= window.innerHeight))
        return;
      if (
        rect.top <=
          Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight) +
            (latest.current.margin ?? 0) &&
        rect.bottom >= Math.max(0, bounds?.top ?? 0)
      )
        request();
    };
    const connect = () => {
      observer?.disconnect();
      resize?.disconnect();
      root?.removeEventListener("scroll", measure);
      root = latest.current.getRoot();
      if (typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) request();
          },
          { root, rootMargin: `0px 0px ${latest.current.margin ?? 0}px 0px` },
        );
        observer.observe(target);
      }
      if (typeof ResizeObserver !== "undefined") {
        resize = new ResizeObserver(measure);
        resize.observe(target);
        if (root) resize.observe(root);
      }
      root?.addEventListener("scroll", measure, { passive: true });
      measure();
    };
    connect();
    window.addEventListener("resize", connect);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      alive = false;
      observer?.disconnect();
      resize?.disconnect();
      root?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", connect);
      window.removeEventListener("scroll", measure);
    };
  }, [
    options.sentinel,
    options.identity,
    options.enabled,
    options.progress,
    options.fetching,
    options.hasMore,
    options.error,
    options.margin,
  ]);
}
