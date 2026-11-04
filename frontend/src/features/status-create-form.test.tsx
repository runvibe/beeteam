import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { StatusSettings } from "./status-settings";
import { BoardSettings } from "./settings";

function setup(archived = false) {
  const api = createMockApi({ delay: 0 });
  const board = {
    ...makeSeed().boards[0],
    archivedAt: archived ? new Date().toISOString() : null,
  };
  const create = vi.spyOn(api, "createStatus");
  render(
    <ApiProvider api={api}>
      <StatusSettings board={board} />
    </ApiProvider>,
  );
  return { create, user: userEvent.setup() };
}
it("opens focused, saves, collapses and reopens empty with completion reset", async () => {
  const { user, create } = setup();
  expect(screen.queryByLabelText("Novo status")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Adicionar status" }));
  expect(screen.getByLabelText("Novo status")).toHaveFocus();
  await user.type(screen.getByLabelText("Novo status"), "Pronto para entrega");
  await user.click(
    screen.getAllByRole("switch", { name: "Conta como concluído" }).at(-1)!,
  );
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Novo status")).not.toBeInTheDocument(),
  );
  expect(create).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Adicionar status" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Adicionar status" }));
  expect(screen.getByLabelText("Novo status")).toHaveValue("");
  expect(
    screen.getAllByRole("switch", { name: "Conta como concluído" }).at(-1),
  ).not.toBeChecked();
});
it("preserves draft and error on failure, then retries the same intent", async () => {
  const { user, create } = setup();
  create.mockRejectedValueOnce(new Error("Falha de rede"));
  await user.click(screen.getByRole("button", { name: "Adicionar status" }));
  await user.type(screen.getByLabelText("Novo status"), "Revisão");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByText("Falha de rede")).toBeVisible();
  expect(screen.getByLabelText("Novo status")).toHaveValue("Revisão");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Novo status")).not.toBeInTheDocument(),
  );
  expect(create.mock.calls[0][2]).toBe(create.mock.calls[1][2]);
});
it("cancels via Escape without saving and keeps parent dialog escape untouched otherwise", async () => {
  const { user, create } = setup();
  await user.click(screen.getByRole("button", { name: "Adicionar status" }));
  await user.type(screen.getByLabelText("Novo status"), "Rascunho");
  await user.keyboard("{Escape}");
  expect(screen.queryByLabelText("Novo status")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Adicionar status" }),
  ).toHaveFocus();
  expect(create).not.toHaveBeenCalled();
});
it("blocks duplicate submissions and cancellation while pending", async () => {
  const { user, create } = setup();
  create.mockImplementation(() => new Promise(() => {}));
  await user.click(screen.getByRole("button", { name: "Adicionar status" }));
  await user.type(screen.getByLabelText("Novo status"), "Pendente");
  const form = screen.getByLabelText("Novo status").closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  expect(screen.getByLabelText("Novo status")).toBeDisabled();
});
it("keeps required validation and archived boards read-only", async () => {
  const { user, create } = setup();
  await user.click(screen.getByRole("button", { name: "Adicionar status" }));
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Novo status")).toBeInvalid();
});
it("does not allow opening creation in an archived board", () => {
  setup(true);
  expect(
    screen.getByRole("button", { name: "Adicionar status" }),
  ).toBeDisabled();
});
it("Escape cancels creation without dismissing the containing board dialog", async () => {
  const close = vi.fn();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <BoardSettings board={makeSeed().boards[0]} open onOpenChange={close} />
    </ApiProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Adicionar status" }),
  );
  await userEvent.keyboard("{Escape}");
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Novo status")).not.toBeInTheDocument();
});
