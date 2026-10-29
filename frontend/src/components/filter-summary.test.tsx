import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { FilterSummary } from "./filter-summary";

it("keeps the same trigger while entering and leaving the tag stack repeatedly", async () => {
  const user = userEvent.setup();
  render(
    <FilterSummary
      filters={[
        { label: "Busca", value: "Projeto" },
        { label: "Bloqueio", value: "Bloqueadas" },
      ]}
    />,
  );
  const trigger = screen.getByRole("button");
  const list = document.getElementById(trigger.getAttribute("aria-controls")!)!;
  for (let index = 0; index < 5; index++) {
    await user.hover(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.hover(list);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.unhover(list);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(list).toHaveAttribute("inert");
    expect(screen.getByRole("button")).toBe(trigger);
  }
});

it("supports touch toggling, keyboard focus and Escape without changing filters", async () => {
  const user = userEvent.setup();
  render(
    <FilterSummary
      filters={[
        { label: "Busca", value: "Projeto" },
        { label: "Bloqueio", value: "Bloqueadas" },
      ]}
    />,
  );
  const toggle = screen.getByRole("button");
  const list = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(list).toHaveAttribute("inert");
  fireEvent.pointerEnter(toggle, { pointerType: "touch" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle, { detail: 1 });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(list).not.toHaveAttribute("inert");
  fireEvent.click(toggle, { detail: 1 });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await user.tab();
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{Escape}");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveTextContent("Busca: Projeto");
});
