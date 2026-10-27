import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
import { BoardSettings } from "./settings";
it("preserves unsaved metadata when independent status configuration changes the board version", async () => {
  const api = createMockApi({ delay: 0 });
  const board = await api.get("boards", ids.board);
  const view = render(
    <ApiProvider api={api}>
      <BoardSettings board={board} open onOpenChange={() => {}} />
    </ApiProvider>,
  );
  const dialog = screen.getByRole("dialog");
  const description = within(dialog).getByLabelText("Descrição");
  await userEvent.clear(description);
  await userEvent.type(description, "Rascunho ainda não salvo");
  await api.createStatus(ids.board, { name: "Novo status", isDone: false });
  const updated = await api.get("boards", ids.board);
  view.rerender(
    <ApiProvider api={api}>
      <BoardSettings board={updated} open onOpenChange={() => {}} />
    </ApiProvider>,
  );
  expect(within(dialog).getByLabelText("Descrição")).toHaveValue(
    "Rascunho ainda não salvo",
  );
});
it("reloads server metadata after a rejected stale write without overwriting it", async () => {
  const api = createMockApi({ delay: 0 });
  const board = await api.get("boards", ids.board);
  render(
    <ApiProvider api={api}>
      <BoardSettings board={board} open onOpenChange={() => {}} />
    </ApiProvider>,
  );
  await api.patch(
    "boards",
    board.id,
    { description: "Alteração concorrente" },
    board.version,
  );
  await userEvent.clear(screen.getByLabelText("Descrição"));
  await userEvent.type(screen.getByLabelText("Descrição"), "Rascunho local");
  await userEvent.click(screen.getByRole("button", { name: "Salvar board" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Recarregar formulário" }),
  );
  expect(
    await screen.findByDisplayValue("Alteração concorrente"),
  ).toBeVisible();
  expect((await api.get("boards", board.id)).description).toBe(
    "Alteração concorrente",
  );
  await userEvent.clear(screen.getByLabelText("Descrição"));
  await userEvent.type(
    screen.getByLabelText("Descrição"),
    "Edição após reload",
  );
  await userEvent.click(screen.getByRole("button", { name: "Salvar board" }));
  await waitFor(async () =>
    expect((await api.get("boards", board.id)).description).toBe(
      "Edição após reload",
    ),
  );
});
