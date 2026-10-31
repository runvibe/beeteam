import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { makeSeed, uuid } from "@/api/seed";
import { TaskParentReference } from "./task-parent-reference";
it("identifies a subtask and links its parent independently of its own status", () => {
  const task = { ...makeSeed().tasks[0], parentId: uuid(900) };
  render(<TaskParentReference task={task} />);
  expect(screen.getByText("Subtarefa")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Subtarefa: abrir tarefa mãe" }).getAttribute("href"),
  ).toContain(`/tasks/${task.parentId}`);
});
it("does not label root tasks as subtasks", () => {
  render(
    <TaskParentReference task={{ ...makeSeed().tasks[0], parentId: null }} />,
  );
  expect(screen.queryByRole("link")).toBeNull();
});

it("uses hydrated parent name and slug without fetching or nesting links", () => {
  const parent = makeSeed().tasks[0];
  const task = {
    ...parent,
    id: uuid(901),
    parentId: parent.id,
    parentReference: {
      id: parent.id,
      title: "Mãe em outro board",
      slug: parent.slug,
    },
  };
  const { container } = render(<TaskParentReference task={task} />);
  expect(
    screen
      .getByRole("link", { name: "Subtarefa: abrir tarefa mãe Mãe em outro board" })
      .getAttribute("href"),
  ).toContain(`/tasks/${parent.slug}`);
  expect(container.querySelector("a a")).toBeNull();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link")).toHaveTextContent(/^Subtarefa$/);
  expect(screen.getByRole("link")).toHaveAttribute("title", "Abrir tarefa mãe: Mãe em outro board");
});
