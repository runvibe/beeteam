import { readFileSync } from "node:fs";
import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useConversationToolbar } from "./conversation-toolbar";

it("tracks the real tabs height on resize without creating a spacer and cleans up", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(
    "src/features/task-conversation.css",
    "utf8",
  );
  document.head.append(style);
  let height = 53;
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      return {
        height: this.classList.contains("task-section-navigation") ? height : 0,
      } as DOMRect;
    });
  function Toolbar() {
    const ref = useConversationToolbar();
    return (
      <div ref={ref} className="conversation-filters">
        Filters
      </div>
    );
  }
  const view = render(
    <div className="task-detail-tabs">
      <nav className="task-section-navigation" />
      <Toolbar />
    </div>,
  );
  const toolbar = view.getByText("Filters");
  expect(toolbar.style.top).toBe("53px");
  expect(getComputedStyle(toolbar).position).toBe("sticky");
  expect(getComputedStyle(toolbar).zIndex).toBe("19");
  height = 84;
  act(resize);
  expect(toolbar.style.top).toBe("84px");
  expect(toolbar.parentElement?.children).toHaveLength(2);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  style.remove();
  bounds.mockRestore();
  vi.unstubAllGlobals();
});
