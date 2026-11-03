import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";

it("keeps the active form mounted through rerenders and restores its opener on Escape", async () => {
  const user = userEvent.setup();
  const View = ({ title }: { title: string }) => (
    <Dialog>
      <DialogTrigger>Editar</DialogTrigger>
      <DialogContent className="detail-dialog" aria-describedby={undefined}>
        <DialogTitle>{title}</DialogTitle>
        <input aria-label="Nome" defaultValue="Original" />
      </DialogContent>
    </Dialog>
  );
  const view = render(<View title="Configuração" />);
  const opener = screen.getByRole("button", { name: "Editar" });
  await user.click(opener);
  const input = screen.getByRole("textbox", { name: "Nome" });
  await user.type(input, " alterado");
  view.rerender(<View title="Configuração atualizada" />);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("Original alterado");
  expect(input).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(opener).toHaveFocus();
});
