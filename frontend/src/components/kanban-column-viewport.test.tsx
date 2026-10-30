import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KanbanColumnViewport } from "./kanban-column-viewport";
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
