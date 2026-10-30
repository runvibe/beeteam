import { useLayoutEffect, useRef, type ReactNode } from "react";
import { LoadingIndicator } from "./loading-indicator";
import { Button } from "./ui/button";
import "./kanban-column-viewport.css";

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
}: {
  children: ReactNode;
  state: State;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const position = useRef<{ id?: string; inset: number; top: number }>({
    inset: 0,
    top: 0,
  });
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
