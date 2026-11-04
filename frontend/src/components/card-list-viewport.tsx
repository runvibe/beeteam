import { useLocale, t as tr } from "@/i18n";

import { useInfiniteScroll } from "./use-infinite-scroll";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@/routing/location";
import { LoadingIndicator } from "./loading-indicator";
import { Button } from "./ui/button";
import { ChevronUp } from "lucide-react";
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
    identity?: string;
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
  useLocale();
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
  const [rowHeight, setRowHeight] = useState(286);
  const [overflowed, setOverflowed] = useState(false);
  const [awayFromTop, setAwayFromTop] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const topButton = useRef<HTMLButtonElement>(null);
  const viewportSize = useRef("");
  const capture = () => {
    const node = root.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    setAwayFromTop(node.scrollTop > 8);
    const footer = sentinel.current?.getBoundingClientRect();
    setFooterVisible(
      !!footer && footer.top < bounds.bottom && footer.bottom > bounds.top,
    );
    if (node.scrollTop <= 8 && document.activeElement === topButton.current)
      node.focus({ preventScroll: true });
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
    setAwayFromTop(node.scrollTop > 8);
  }, [url, state.items, rowHeight, overflowed]);
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
      const height = measured > 1 ? measured + 14 : 286;
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
  useInfiniteScroll({
    identity: state.identity,
    sentinel,
    getRoot: () => root.current,
    progress: state.items.map((item) => item.id).join(","),
    hasMore: state.hasMore,
    fetching: state.fetching,
    error: state.error,
    margin: rowHeight,
    loadMore: state.loadMore,
  });
  return (
    <div className="card-list-frame">
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
            style={{
              minHeight:
                state.hasMore || state.initialLoading || state.error
                  ? 64
                  : "1rem",
              paddingTop:
                state.hasMore || state.initialLoading || state.error ? 12 : 0,
            }}
          >
            {state.error ? (
              <div role="alert">
                <p>{tr("common.couldNotLoadCards")}</p>
                <Button onClick={() => void state.retry()}>
                  {tr("common.tryAgain")}
                </Button>
              </div>
            ) : state.hasMore ? (
              <>
                <div style={{ minHeight: 60 }}>
                  {state.fetching && (
                    <LoadingIndicator label={tr("common.loadingMoreRecords")} />
                  )}
                </div>
                <Button
                  className="sr-only focus:not-sr-only"
                  disabled={state.fetching}
                  onClick={state.loadMore}
                >
                  {tr("common.loadMore")}
                </Button>
              </>
            ) : (
              !state.initialLoading && (
                <p className="sr-only" role="status">
                  {tr("common.endOfRecordsCount", { count: state.total })}
                </p>
              )
            )}
          </div>
        </div>
      </div>
      {awayFromTop && (
        <button
          ref={topButton}
          type="button"
          className="card-list-to-top"
          aria-label={tr("common.backToTop")}
          title={tr("common.backToTop")}
          data-above-footer={footerVisible && (state.hasMore || !!state.error)}
          onClick={() =>
            root.current?.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            })
          }
        >
          <span>
            <ChevronUp aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
