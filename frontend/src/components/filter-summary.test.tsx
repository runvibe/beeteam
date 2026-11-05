import { useState } from "react";
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
  const list = document.getElementById(
    trigger.getAttribute("aria-controls")!,
  )!;
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
  const list = document.getElementById(
    toggle.getAttribute("aria-controls")!,
  )!;
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

it("keeps an expanded stack during successive removals and transfers keyboard focus", async () => {
  const user = userEvent.setup();
  const Harness = () => {
    const [items, setItems] = useState(["A", "B", "C"]);
    return (
      <div className="compact-filter-bar">
        <button>Buscar</button>
        {items.length > 0 && (
          <FilterSummary
            filters={items.map((label) => ({
              label,
              value: label,
              onRemove: () =>
                setItems((current) =>
                  current.filter((item) => item !== label),
                ),
            }))}
          />
        )}
      </div>
    );
  };
  render(<Harness />);
  await user.hover(
    screen.getByRole("button", { name: "Expandir 3 filtros ativos" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Remover filtro B: B" }),
  );
  expect(
    screen.getByRole("button", { name: "Recolher 2 filtros ativos" }),
  ).toBeInTheDocument();
  const removeA = screen.getByRole("button", { name: "Remover filtro A: A" });
  removeA.focus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("button", { name: "Remover filtro C: C" }),
  ).toHaveFocus();
  expect(
    screen.getByRole("button", { name: "Recolher 1 filtro ativo" }),
  ).toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Buscar" })).toHaveFocus();
  expect(
    screen.queryByRole("button", { name: /filtros ativos/ }),
  ).not.toBeInTheDocument();
});

it("returns focus to the toggle before collapsing a focused tag on Escape", async () => {
  const user = userEvent.setup();
  render(
    <FilterSummary
      filters={[
        { label: "Busca", value: "Projeto" },
        { label: "Papel", value: "Worker", onRemove: () => {} },
      ]}
    />,
  );
  const toggle = screen.getByRole("button", { name: /Expandir/ });
  await user.tab();
  await user.tab();
  expect(
    screen.getByRole("button", { name: /Remover filtro Papel/ }),
  ).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    document.getElementById(toggle.getAttribute("aria-controls")!),
  ).toHaveAttribute("inert");
});
