import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KanbanColumnViewport } from "./kanban-column-viewport";
it("waits for internal scroll and does not drain pages when the footer remains visible", () => {
  const loadMore = vi.fn();
  const state = {
    items: [{ id: "a" }],
    hasMore: true,
    fetching: false,
    error: null,
    loadMore,
    retry: vi.fn(),
  };
  const view = render(
    <KanbanColumnViewport state={state} label="A fazer">
      <div data-task-id="a">A</div>
    </KanbanColumnViewport>,
  );
  const node = screen.getByRole("region", { name: "Tarefas: A fazer" });
  Object.defineProperties(node, {
    clientHeight: { value: 600 },
    scrollHeight: { value: 1800 },
    scrollTop: { value: 0, writable: true },
  });
  expect(loadMore).not.toHaveBeenCalled();
  fireEvent.scroll(node, { target: { scrollTop: 100 } });
  expect(loadMore).not.toHaveBeenCalled();
  fireEvent.scroll(node, { target: { scrollTop: 1000 } });
  expect(loadMore).toHaveBeenCalledTimes(1);
  view.rerender(
    <KanbanColumnViewport
      state={{ ...state, items: [{ id: "a" }, { id: "b" }] }}
      label="A fazer"
    >
      <div data-task-id="a">A</div>
      <div data-task-id="b">B</div>
    </KanbanColumnViewport>,
  );
  fireEvent.scroll(node, { target: { scrollTop: 1000 } });
  expect(loadMore).toHaveBeenCalledTimes(1);
  fireEvent.scroll(node, { target: { scrollTop: 1100 } });
  expect(loadMore).toHaveBeenCalledTimes(2);
});
