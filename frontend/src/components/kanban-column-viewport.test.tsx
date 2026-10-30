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

it("restores the column position after unmounting for a task and returning", () => {
  const state = {
    items: [{ id: "return-card" }],
    hasMore: false,
    fetching: false,
    error: null,
    loadMore: vi.fn(),
    retry: vi.fn(),
  };
  const renderColumn = () =>
    render(
      <KanbanColumnViewport
        storageKey="board/filter/status-return"
        state={state}
        label="Return"
      >
        <div data-task-id="return-card">Card</div>
      </KanbanColumnViewport>,
    );
  const view = renderColumn();
  const node = screen.getByRole("region", { name: "Tarefas: Return" });
  fireEvent.scroll(node, { target: { scrollTop: 450 } });
  view.unmount();
  renderColumn();
  expect(
    screen.getByRole("region", { name: "Tarefas: Return" }).scrollTop,
  ).toBe(450);
});
it("fills only until vertical overflow appears", () => {
  const loadMore = vi.fn();
  const state = {
    items: [{ id: "fit" }],
    hasMore: true,
    fetching: false,
    error: null,
    loadMore,
    retry: vi.fn(),
  };
  const view = render(
    <KanbanColumnViewport state={state} label="Fits">
      <div>Card</div>
    </KanbanColumnViewport>,
  );
  const node = screen.getByRole("region", { name: "Tarefas: Fits" });
  Object.defineProperties(node, {
    clientHeight: { value: 1000 },
    scrollHeight: { value: 600, writable: true },
  });
  view.rerender(
    <KanbanColumnViewport
      state={{ ...state, items: [{ id: "fit" }] }}
      label="Fits"
    >
      <div>Card</div>
    </KanbanColumnViewport>,
  );
  expect(loadMore).toHaveBeenCalledTimes(1);
  Object.defineProperty(node, "scrollHeight", { value: 1300, writable: true });
  view.rerender(
    <KanbanColumnViewport
      state={{ ...state, items: [{ id: "fit" }, { id: "next" }] }}
      label="Fits"
    >
      <div>Cards</div>
    </KanbanColumnViewport>,
  );
  expect(loadMore).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: "Carregar mais tarefas" }),
  ).toBeNull();
});
