import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  TaskFilterProvider,
  TaskFilterSlot,
  TaskFilters,
} from "./task-filter-layout";

it("docks off-screen filters between the navigation and preferences without losing their state", () => {
  let update = () => {};
  let resize = (_element: Element) => {};
  let bottom = 200;
  let navigationBottom = 300;
  let footerTop = 650;
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private observed = new Set<Element>();
      constructor(callback: () => void) {
        resize = (element) => {
          if (this.observed.has(element)) callback();
        };
      }
      observe(element: Element) {
        this.observed.add(element);
      }
      disconnect() {
        this.observed.clear();
      }
    },
  );
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("navigation-logo"))
        return { bottom: 37, width: 33 } as DOMRect;
      if (this.classList.contains("navigation-rail"))
        return { top: 0, bottom: window.innerHeight, left: 0, width: 51 } as DOMRect;
      if (this.tagName === "NAV")
        return { top: 41, bottom: navigationBottom } as DOMRect;
      if (this.classList.contains("navigation-footer"))
        return { top: footerTop } as DOMRect;
      if (this.classList.contains("task-filter-origin"))
        return { bottom, top: bottom - 44 } as DOMRect;
      return { left: 0, height: 44 } as DOMRect;
    });
  function Harness({ active }: { active: boolean }) {
    return (
      <>
        <aside className="navigation-rail">
          <a className="navigation-logo">Logo</a>
          <nav>Navigation</nav>
          <div className="navigation-footer">Preferences</div>
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
    const view = render(<Harness active={false} />);
    const control = screen.getByRole("button", { name: "Filter" });
    const host = control.parentElement!;
    const rail = document.querySelector(".navigation-rail")!;
    const nav = rail.querySelector("nav")!;
    const footer = rail.querySelector(".navigation-footer")!;
    expect(host).toHaveAttribute("data-docked", "false");
    bottom = -1;
    act(update);
    expect(host).toHaveAttribute("data-docked", "true");
    expect(host.style.top).toBe("308px");
    expect(host.style.left).toBe("9px");
    expect(host.style.getPropertyValue("--filter-dock-height")).toBe("334px");
    expect(screen.getByRole("button", { name: "Filter" })).toBe(control);
    expect(screen.getByLabelText("Draft")).toHaveValue("kept");
    expect(screen.getAllByRole("button", { name: "Filter" })).toHaveLength(1);

    footerTop = 343;
    act(() => resize(footer));
    expect(host).toHaveAttribute("data-docked", "false");
    footerTop = 344;
    act(() => resize(footer));
    expect(host).toHaveAttribute("data-docked", "true");
    expect(host.style.top).toBe("300px");
    expect(host.style.getPropertyValue("--filter-dock-height")).toBe("44px");

    footerTop = 650;
    act(() => resize(footer));
    navigationBottom = 342;
    act(() => resize(nav));
    expect(host.style.top).toBe("350px");
    expect(host.style.getPropertyValue("--filter-dock-height")).toBe("292px");

    footerTop = 900;
    act(() => resize(footer));
    expect(host.style.getPropertyValue("--filter-dock-height")).toBe("410px");
    navigationBottom = -10;
    footerTop = 100;
    act(() => rail.dispatchEvent(new Event("scroll")));
    expect(host.style.top).toBe("8px");
    expect(host.style.getPropertyValue("--filter-dock-height")).toBe("84px");

    act(() => screen.getByLabelText("Draft").focus());
    view.rerender(<Harness active={false} />);
    expect(host).toHaveAttribute("data-docked", "true");
    act(() => {
      screen.getByLabelText("Draft").blur();
      update();
    });
    expect(host).toHaveAttribute("data-docked", "true");
    bottom = 200;
    act(update);
    expect(host).toHaveAttribute("data-docked", "false");
    expect(screen.getByRole("button", { name: "Filter" })).toBe(control);
  } finally {
    bounds.mockRestore();
    vi.unstubAllGlobals();
  }
});
