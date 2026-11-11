import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { SessionBoardPicker } from "./session-board-picker";

it("announces the current board with the board action", async () => {
  await i18n.changeLanguage("en");
  render(
    <SessionBoardPicker
      value="board"
      boards={[{ id: "board", name: "Planning" }]}
      disabled={false}
      hasMore={false}
      loading={false}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Session board" })).toHaveAccessibleDescription("Planning");
});

it("prevents board changes if the session becomes locked while the picker is open", async () => {
  await i18n.changeLanguage("en");
  const onChange = vi.fn();
  const picker = (disabled: boolean) => (
    <SessionBoardPicker
      value=""
      boards={[{ id: "board", name: "Planning" }]}
      disabled={disabled}
      hasMore
      loading={false}
      onMore={vi.fn()}
      onChange={onChange}
    />
  );
  const view = render(picker(false));
  fireEvent.click(screen.getByRole("button", { name: "Session board" }));
  const option = await screen.findByRole("radio", { name: "Planning" });
  view.rerender(picker(true));
  expect(option).toBeDisabled();
  expect(screen.getByRole("button", { name: "More boards" })).toBeDisabled();
  fireEvent.click(option);
  expect(onChange).not.toHaveBeenCalled();
});
