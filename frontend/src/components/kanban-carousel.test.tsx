import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { KanbanCarousel } from "./kanban-carousel";
it("bounds navigation without looping and retains the same column nodes and vertical positions", async () => {
  const user = userEvent.setup();
  render(
    <KanbanCarousel
      columns={[
        { id: "a", name: "Ideias", total: 2 },
        { id: "b", name: "A fazer", total: 25 },
      ]}
    >
      <section data-testid="first">First</section>
      <section data-testid="second">Second</section>
    </KanbanCarousel>,
  );
  const root = screen.getByRole("region", { name: "Quadro de tarefas" });
  const first = screen.getByTestId("first"),
    second = screen.getByTestId("second");
  Object.defineProperty(first, "offsetLeft", { value: 8 });
  Object.defineProperty(second, "offsetLeft", { value: 308 });
  root.scrollTo = vi.fn();
  first.scrollTop = 320;
  expect(
    screen.getByRole("button", { name: "Coluna anterior" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Próxima coluna" }));
  expect(root.scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({ left: 300 }),
  );
  fireEvent.scroll(root, { target: { scrollLeft: 300 } });
  expect(screen.getByRole("button", { name: "Próxima coluna" })).toBeDisabled();
  expect(screen.getByText("A fazer")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Coluna anterior" }));
  expect(root.scrollTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ left: 0 }),
  );
  fireEvent.scroll(root, { target: { scrollLeft: 0 } });
  expect(screen.getByTestId("first")).toBe(first);
  expect(first.scrollTop).toBe(320);
  expect(
    screen.getByRole("button", { name: "Coluna anterior" }),
  ).toBeDisabled();
});
