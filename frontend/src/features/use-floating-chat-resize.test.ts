import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PointerEvent, KeyboardEvent } from "react";
import { useFloatingChatResize } from "./use-floating-chat-resize";
import type { ResizeCorner } from "./floating-chat-bounds";
afterEach(() => vi.unstubAllGlobals());
function mount(size: { width: number; height: number } | null = null) {
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("innerHeight", 800);
  const element = document.createElement("div");
  let bounds = { x: 200, y: 150, width: 440, height: 400 };
  element.getBoundingClientRect = () =>
    ({ ...bounds, left: bounds.x, top: bounds.y }) as DOMRect;
  const change = vi.fn((next: typeof bounds) => {
    bounds = next;
  });
  const interrupt = vi.fn();
  const hook = renderHook(
    ({ active }) =>
      useFloatingChatResize({
        active,
        element,
        size,
        onBoundsChange: change,
        onResizeStart: interrupt,
      }),
    { initialProps: { active: true } },
  );
  const start = (corner: ResizeCorner = "se") =>
    act(() =>
      hook.result.current.handleProps(corner).onPointerDown({
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        currentTarget: document.createElement("button"),
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent<HTMLButtonElement>),
    );
  return { ...hook, start, change, interrupt, bounds: () => bounds };
}
function pointer(type: string, x = 150, y = 150, buttons = 1) {
  act(() => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, buttons });
    window.dispatchEvent(event);
  });
}
it("resizes without magnetic settling and restores initial bounds with Escape", () => {
  const hook = mount();
  hook.start("nw");
  expect(hook.interrupt).toHaveBeenCalledOnce();
  pointer("pointermove", 50, 40);
  expect(hook.bounds()).toEqual({ x: 150, y: 90, width: 490, height: 460 });
  expect(hook.result.current.resizing).toBe(true);
  act(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(hook.bounds()).toEqual({ x: 200, y: 150, width: 440, height: 400 });
  expect(hook.result.current.resizing).toBe(false);
  const count = hook.change.mock.calls.length;
  pointer("pointermove");
  expect(hook.change).toHaveBeenCalledTimes(count);
});
it.each(["pointercancel", "blur", "released", "dock", "unmount"])(
  "cleans the gesture on %s",
  (reason) => {
    const hook = mount();
    hook.start();
    pointer("pointermove");
    if (reason === "dock") hook.rerender({ active: false });
    else if (reason === "unmount") hook.unmount();
    else if (reason === "blur")
      act(() => window.dispatchEvent(new Event("blur")));
    else if (reason === "released") pointer("pointermove", 400, 400, 0);
    else pointer("pointercancel");
    const count = hook.change.mock.calls.length;
    pointer("pointermove", 500, 500);
    expect(hook.change).toHaveBeenCalledTimes(count);
    if (reason === "pointercancel")
      expect(hook.bounds()).toEqual({
        x: 200,
        y: 150,
        width: 440,
        height: 400,
      });
  },
);
it("supports keyboard steps and preserves the opposite corner", () => {
  const hook = mount();
  act(() =>
    hook.result.current.handleProps("nw").onKeyDown({
      key: "ArrowLeft",
      shiftKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent<HTMLButtonElement>),
  );
  expect(hook.bounds()).toEqual({ x: 160, y: 150, width: 480, height: 400 });
  act(() =>
    hook.result.current.handleProps("se").onKeyDown({
      key: "ArrowDown",
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent<HTMLButtonElement>),
  );
  expect(hook.bounds().height).toBe(410);
});

it("clamps restored dimensions and responds to smaller viewports", () => {
  const hook = mount({ width: 2000, height: 1200 });
  expect(hook.bounds()).toEqual({ x: 12, y: 12, width: 976, height: 776 });
  vi.stubGlobal("innerWidth", 280);
  vi.stubGlobal("innerHeight", 240);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(hook.bounds()).toEqual({ x: 12, y: 12, width: 256, height: 216 });
});
