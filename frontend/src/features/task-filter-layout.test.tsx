import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  TaskFilterProvider,
  TaskFilterSlot,
  TaskFilters,
} from "./task-filter-layout";

it("docks the same filter DOM only for active mobile filters outside their original area", () => {
  let update = () => {};
  let bottom = 200;
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: () => void) {
        update = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("navigation-logo"))
        return { bottom: 50 } as DOMRect;
      if (this.tagName === "NAV") return { top: 300 } as DOMRect;
      if (this.classList.contains("task-filter-origin"))
        return { bottom } as DOMRect;
      return { left: 0, height: 44 } as DOMRect;
    });
  function Harness({ active }: { active: boolean }) {
    return (
      <>
        <aside className="navigation-rail">
          <a className="navigation-logo">Logo</a>
          <nav>Navigation</nav>
        </aside>
        <TaskFilterProvider>
          <TaskFilterSlot />
          <TaskFilters active={active}>
            <button>Filter</button>
            <input aria-label="Draft" defaultValue="kept" />
          </TaskFilters>
        </TaskFilterProvider>
      </>
    );
  }
  try {
    const view = render(<Harness active />);
    const control = screen.getByRole("button", { name: "Filter" });
    const host = control.parentElement!;
    expect(host).toHaveAttribute("data-docked", "false");
    bottom = -1;
    act(update);
    expect(host).toHaveAttribute("data-docked", "true");
    expect(host.style.top).toBe("58px");
    expect(screen.getByRole("button", { name: "Filter" })).toBe(control);
    expect(screen.getByLabelText("Draft")).toHaveValue("kept");
    expect(screen.getAllByRole("button", { name: "Filter" })).toHaveLength(1);
    act(() => screen.getByLabelText("Draft").focus());
    view.rerender(<Harness active={false} />);
    expect(host).toHaveAttribute("data-docked", "true");
    act(() => {
      screen.getByLabelText("Draft").blur();
      update();
    });
    expect(host).toHaveAttribute("data-docked", "false");
    expect(screen.getByRole("button", { name: "Filter" })).toBe(control);
  } finally {
    bounds.mockRestore();
    vi.unstubAllGlobals();
  }
});
