import { useInfiniteScroll } from "./use-infinite-scroll";
import { useLayoutEffect, useRef, type ReactNode } from "react";
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
  const sentinel = useRef<HTMLDivElement>(null);
  useInfiniteScroll({
    sentinel,
    getRoot: () => root.current,
    identity: storageKey,
    progress: state.items.map((item) => item.id).join(","),
    hasMore: state.hasMore,
    fetching: state.fetching,
    error: state.error,
    loadMore: state.loadMore,
  });
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
      }}
    >
      {children}
      <div ref={sentinel} className="kanban-column-end">
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
