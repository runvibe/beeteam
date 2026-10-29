import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { TaskCard } from "./boards";

it("keeps blocked cards named and navigable, and removes the warning when unblocked", () => {
  const api = createMockApi({ delay: 0 });
  const task = makeSeed().tasks.find((task) => task.block.blocked)!;
  const { rerender } = render(
    <ApiProvider api={api}>
      <TaskCard task={task} />
    </ApiProvider>,
  );
  const link = screen.getByRole("link", { name: task.title });
  expect(link).toHaveAttribute(
    "href",
    expect.stringContaining(`/tasks/${task.slug}`),
  );
  expect(screen.getByText("Bloqueada")).toBeInTheDocument();
  expect(link.closest("[data-slot=card]")).toHaveAttribute(
    "data-blocked",
    "true",
  );
  rerender(
    <ApiProvider api={api}>
      <TaskCard task={{ ...task, block: { blocked: false, reason: null } }} />
    </ApiProvider>,
  );
  expect(screen.queryByText("Bloqueada")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: task.title })).toBe(link);
  expect(link.closest("[data-slot=card]")).not.toHaveAttribute("data-blocked");
});

