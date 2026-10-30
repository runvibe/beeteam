import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LoadingIndicator } from "./loading-indicator";
import { Button } from "./ui/button";
import "./kanban-column-viewport.css";

type Position = { id?: string; inset: number; top: number };
const positions = new Map<string, Position>();

type State = {
  items: { id: string }[];
  hasMore: boolean;
  fetching: boolean;
  error: unknown;
  loadMore: () => void;
  retry: () => unknown;
};
export function KanbanColumnViewport({
  children,
  state,
  label,
  storageKey,
}: {
  children: ReactNode;
  state: State;
  label: string;
  storageKey?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const position = useRef<Position>(
    storageKey
      ? (positions.get(storageKey) ?? { inset: 0, top: 0 })
      : { inset: 0, top: 0 },
  );
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () =>
      setFits(
        node.clientHeight > 0 && node.scrollHeight <= node.clientHeight + 1,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [state.items]);
  const filledItems = useRef<State["items"] | null>(null);
  useEffect(() => {
    const node = root.current;
    // Fill only the visible viewport. Once it overflows, subsequent requests
    // require real scroll progress; exhausted/error/pending queries always stop.
    if (
      node &&
      node.clientHeight > 0 &&
      node.scrollHeight <= node.clientHeight + 1 &&
      state.hasMore &&
      !state.fetching &&
      !state.error &&
      filledItems.current !== state.items
    ) {
      filledItems.current = state.items;
      state.loadMore();
    }
  }, [fits, state.items, state.fetching, state.hasMore, state.error]);
  const requestedAt = useRef(-1);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const anchor = Array.from(
      node.querySelectorAll<HTMLElement>("[data-task-id]"),
    ).find((card) => card.dataset.taskId === position.current.id);
    if (anchor)
      node.scrollTop +=
        anchor.getBoundingClientRect().top -
        node.getBoundingClientRect().top -
        position.current.inset;
    else node.scrollTop = position.current.top;
  }, [state.items]);
  return (
    <div
      ref={root}
      className="kanban-column-scroll"
      role="region"
      aria-label={`Tarefas: ${label}`}
      tabIndex={0}
      onScroll={() => {
        const node = root.current;
        if (!node) return;
        const bounds = node.getBoundingClientRect();
        const anchor = Array.from(
          node.querySelectorAll<HTMLElement>("[data-task-id]"),
        ).find((card) => card.getBoundingClientRect().bottom > bounds.top);
        position.current = {
          id: anchor?.dataset.taskId,
          inset: anchor ? anchor.getBoundingClientRect().top - bounds.top : 0,
          top: node.scrollTop,
        };
        if (storageKey) {
          positions.set(storageKey, position.current);
          if (positions.size > 256)
            positions.delete(positions.keys().next().value!);
        }
        // A new scroll position is required for each append: a visible footer must
        // never recursively drain all pages, including in very tall viewports.
        if (
          node.scrollTop > 0 &&
          node.scrollTop !== requestedAt.current &&
          node.scrollHeight - node.clientHeight - node.scrollTop < 300 &&
          state.hasMore &&
          !state.fetching &&
          !state.error
        ) {
          requestedAt.current = node.scrollTop;
          state.loadMore();
        }
      }}
    >
      {children}
      <div className="kanban-column-end">
        {state.fetching && (
          <LoadingIndicator label={`Carregando tarefas: ${label}`} compact />
        )}
        {!!state.error && (
          <div role="alert">
            Não foi possível carregar as tarefas.{" "}
            <Button variant="ghost" onClick={() => void state.retry()}>
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
