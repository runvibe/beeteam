import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { TaskSections } from "./task-detail-layout";

function Harness() {
  const [value, setValue] = useState("overview");
  return (
    <Tabs value={value} onValueChange={setValue} activationMode="manual">
      <TaskSections value={value} />
    </Tabs>
  );
}

it("provides one named tablist with complete labels and manual keyboard activation", async () => {
  render(<Harness />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(
    screen.getByRole("tablist", { name: "Seção da tarefa" }),
  ).toBeVisible();
  expect(screen.getAllByRole("tab")).toHaveLength(8);
  const first = screen.getByRole("tab", { name: "Visão geral" });
  first.focus();
  await userEvent.keyboard("{End}");
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Timeline" })).toHaveFocus(),
  );
  expect(first).toHaveAttribute("aria-selected", "true");
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("tab", { name: "Timeline" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await userEvent.keyboard("{Home}{Space}");
  await waitFor(() => expect(first).toHaveFocus());
});

it("reveals only the tab strip, leaves its position on rerender and exposes overflow controls", () => {
  const view = render(<Harness />);
  const list = screen.getByRole("tablist", { name: "Seção da tarefa" });
  const scroll = list.parentElement!;
  Object.defineProperties(scroll, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 800 },
  });
  scroll.getBoundingClientRect = () =>
    ({ left: 10, right: 210, width: 200 }) as DOMRect;
  const last = screen.getByRole("tab", { name: "Timeline" });
  last.getBoundingClientRect = () =>
    ({ left: 700, right: 800, width: 100 }) as DOMRect;
  const scrollBy = vi.fn();
  scroll.scrollBy = scrollBy;
  fireEvent.scroll(scroll);
  expect(
    screen.getByRole("button", { name: "Mostrar próximas abas" }),
  ).toBeEnabled();
  fireEvent.focus(last);
  expect(scroll.scrollLeft).toBe(590);
  view.rerender(<Harness />);
  expect(scroll.scrollLeft).toBe(590);
  fireEvent.click(
    screen.getByRole("button", { name: "Mostrar próximas abas" }),
  );
  expect(scrollBy).toHaveBeenCalled();
});
