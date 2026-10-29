import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "@/routing/location";
import { LoadingIndicator } from "./loading-indicator";
import { Button } from "./ui/button";
import "./card-list-viewport.css";

type Position = { top: number; id?: string; inset?: number };
const saved = new Map<string, Position>();
function restore(url: string): Position | undefined {
  if (saved.has(url)) return saved.get(url);
  try {
    return (
      JSON.parse(sessionStorage.getItem(`bee-cards:${url}`) || "null") ??
      undefined
    );
  } catch {
    return undefined;
  }
}
export function CardListViewport({
  children,
  state,
  label,
}: {
  children: ReactNode;
  label: string;
  state: {
    items: { id: string }[];
    hasMore: boolean;
    fetching: boolean;
    initialLoading: boolean;
    error: unknown;
    total: number;
    loadMore: () => void;
    retry: () => unknown;
    setCapacity: (count: number) => void;
  };
}) {
  const url = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const current = useRef(state);
  useLayoutEffect(() => {
    current.current = state;
  });
  const previousUrl = useRef(url);
  const position = useRef<Position | undefined>(restore(url));
  const [rowHeight, setRowHeight] = useState(354);
  const [overflowed, setOverflowed] = useState(false);
  const viewportSize = useRef("");
  const capture = () => {
    const node = root.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const card = Array.from(
      node.querySelectorAll<HTMLElement>("[data-card-id]"),
    ).find((card) => card.getBoundingClientRect().bottom > bounds.top);
    position.current = {
      top: node.scrollTop,
      id: card?.dataset.cardId,
      inset: card ? card.getBoundingClientRect().top - bounds.top : undefined,
    };
    saved.set(url, position.current);
    try {
      sessionStorage.setItem(
        `bee-cards:${url}`,
        JSON.stringify(position.current),
      );
    } catch {
      /* Storage may be unavailable. */
    }
  };
  useLayoutEffect(() => {
    if (previousUrl.current !== url) {
      position.current = restore(url) ?? position.current;
      previousUrl.current = url;
    }
    const node = root.current;
    if (!node || !state.items.length || !position.current) return;
    const target = Array.from(
      node.querySelectorAll<HTMLElement>("[data-card-id]"),
    ).find((card) => card.dataset.cardId === position.current?.id);
    if (target)
      node.scrollTop +=
        target.getBoundingClientRect().top -
        node.getBoundingClientRect().top -
        (position.current.inset ?? 0);
    else node.scrollTop = position.current.top;
  });
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !content.current) return;
    const measure = () => {
      const cards = Array.from(
        node.querySelectorAll<HTMLElement>("[data-card-id]"),
      );
      const measured = Math.max(
        1,
        ...cards.map((card) => card.getBoundingClientRect().height),
      );
      const height = measured > 1 ? measured + 14 : 354;
      const style = getComputedStyle(node);
      const contentWidth =
        node.clientWidth -
        parseFloat(style.paddingLeft || "0") -
        parseFloat(style.paddingRight || "0");
      const columns =
        innerWidth <= 850
          ? 1
          : Math.max(1, Math.floor((contentWidth + 14) / 294));
      current.current.setCapacity(
        columns * Math.max(1, Math.ceil(node.clientHeight / height)),
      );
      setRowHeight(Math.min(600, Math.max(80, height)));
      // Once a window overflows, keep its normal top-aligned grid until the viewport changes.
      const size = `${node.clientWidth}:${node.clientHeight}`;
      const overflow =
        node.scrollHeight > node.clientHeight + 2 && node.clientHeight > 0;
      if (size !== viewportSize.current) {
        viewportSize.current = size;
        setOverflowed(overflow);
      } else if (overflow) setOverflowed(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(content.current);
    return () => observer.disconnect();
  }, [state.items.length]);
  useEffect(() => {
    const node = root.current,
      target = sentinel.current;
    if (!node || !target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          current.current.loadMore();
      },
      { root: node, rootMargin: `0px 0px ${rowHeight}px 0px` },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    rowHeight,
    state.fetching,
    state.hasMore,
    state.items.length,
    state.error,
  ]);
  return (
    <div
      ref={root}
      className="card-list-viewport"
      role="region"
      aria-label={label}
      tabIndex={0}
      onScroll={capture}
      data-overflowed={overflowed}
    >
      <div ref={content} className="card-list-content">
        {state.initialLoading ? <LoadingIndicator /> : children}
        <div
          ref={sentinel}
          className="card-list-footer"
          style={{ minHeight: state.hasMore || state.initialLoading ? 64 : 32 }}
        >
          {state.error ? (
            <div role="alert">
              <p>Não foi possível carregar os cards.</p>
              <Button onClick={() => void state.retry()}>
                Tentar novamente
              </Button>
            </div>
          ) : state.hasMore ? (
            <>
              <LoadingIndicator
                label={
                  state.fetching
                    ? "Carregando mais registros"
                    : "Aguardando próximos registros"
                }
              />
              <Button
                className="sr-only focus:not-sr-only"
                disabled={state.fetching}
                onClick={state.loadMore}
              >
                Carregar mais
              </Button>
            </>
          ) : (
            !state.initialLoading && (
              <p className="small-note" role="status">
                Fim dos registros · {state.total} no total
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
