import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { TaskMode } from "./settings";

afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

it("keeps autonomy autosave and retry without a success message or empty status row", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const seed = makeSeed();
  const task = seed.tasks[0];
  const api = createMockApi({ seed, delay: 100 });
  const patch = vi
    .spyOn(api, "patch")
    .mockRejectedValueOnce(new Error("Falha ao salvar autonomia"));
  const view = render(
    <ApiProvider api={api}>
      <TaskMode task={task} />
    </ApiProvider>,
  );
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Configuração individual" }),
    { key: "Enter" },
  );
  fireEvent.click(
    screen.getByRole("option", {
      name: task.autonomyMode === "manual" ? "Automático" : "Manual",
    }),
  );
  expect(await screen.findByText("Falha ao salvar autonomia")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Tentar salvar novamente" }),
  );
  expect(screen.queryByRole("status")).toBeNull();
  await waitFor(() =>
    expect(screen.queryByText("Falha ao salvar autonomia")).toBeNull(),
  );
  expect(patch).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Alterações salvas.")).toBeNull();
  expect(
    view.container.querySelector('.task-autonomy > p[role="status"]'),
  ).toBeNull();
  const saved = await api.get("tasks", task.id);
  expect(saved.autonomyMode).toBe(
    task.autonomyMode === "manual" ? "automatic" : "manual",
  );
});
