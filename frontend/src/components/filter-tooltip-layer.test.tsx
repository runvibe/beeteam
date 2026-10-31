import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { FilterBar } from "./filter-bar";
import { Choice } from "./shared";

it.each(["focus", "hover"])(
  "portals %s filter tooltips above the sticky navigation layer",
  async (mode) => {
    const style = document.createElement("style");
    style.textContent = readFileSync("src/navigation.css", "utf8");
    document.head.append(style);
    const view = render(
      <div style={{ position: "sticky", zIndex: 20 }}>
        <FilterBar onClear={() => {}}>
          <Choice
            label="Tipo de autor"
            value=""
            all="Todos"
            options={[]}
            onChange={() => {}}
          />
        </FilterBar>
      </div>,
    );
    try {
      if (mode === "focus") await userEvent.tab();
      else
        await userEvent.hover(
          screen.getByRole("button", { name: "Tipo de autor" }),
        );
      const label = await screen.findByRole("tooltip");
      const tooltip = label.closest<HTMLElement>(".navigation-tooltip")!;
      expect(view.container).not.toContainElement(tooltip);
      expect(getComputedStyle(tooltip).zIndex).toBe("50");
      await waitFor(() =>
        expect(getComputedStyle(tooltip.parentElement!).zIndex).toBe("50"),
      );
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("tooltip")).toBeNull();
    } finally {
      style.remove();
    }
  },
);
