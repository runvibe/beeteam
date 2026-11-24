import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { MouseEvent } from "react";
import { useCompactFloatingChat } from "./use-compact-floating-chat";
it("ignores interactive header descendants and double clicks immediately after dragging", () => {
  const collapsed = vi.fn();
  const dragged = vi.fn(() => false);
  const element = document.createElement("div");
  const hook = renderHook(() =>
    useCompactFloatingChat({
      active: true,
      element,
      wasDraggedRecently: dragged,
      onCollapse: collapsed,
    }),
  );
  const click = (target: Element) =>
    act(() =>
      hook.result.current.onDoubleClick({
        target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as MouseEvent<HTMLElement>),
    );
  const button = document.createElement("button");
  const icon = document.createElement("span");
  button.append(icon);
  click(icon);
  expect(hook.result.current.compact).toBe(false);
  dragged.mockReturnValue(true);
  click(element);
  expect(hook.result.current.compact).toBe(false);
  dragged.mockReturnValue(false);
  click(element);
  expect(hook.result.current.compact).toBe(true);
  expect(collapsed).toHaveBeenCalledOnce();
  click(element);
  expect(hook.result.current.compact).toBe(false);
});
