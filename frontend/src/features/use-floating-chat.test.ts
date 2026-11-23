import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useFloatingChat } from "./use-floating-chat";

let size = { width: 300, height: 500 };
let resizeElement: () => void;
const disconnect = vi.fn();
beforeEach(() => {
  size = { width: 300, height: 500 };
  Object.defineProperty(window, "innerWidth", {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeElement = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  disconnect.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

function setup(position: { x: number; y: number } | null = null) {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => size as DOMRect;
  const onPositionChange = vi.fn();
  const hook = renderHook(
    ({ active, position }) =>
      useFloatingChat({ active, element, position, onPositionChange }),
    {
      initialProps: { active: true, position },
    },
  );
  const start = (target: Element = element) => {
    const event = {
      target,
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      stopPropagation: vi.fn(),
    };
    act(() =>
      hook.result.current.onPointerDown(
        event as unknown as ReactPointerEvent<HTMLElement>,
      ),
    );
    return event;
  };
  return { ...hook, element, start, onPositionChange };
}
function pointer(type: string, x = 100, y = 100, pointerId = 1, buttons = 1) {
  act(() => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId, buttons });
    window.dispatchEvent(event);
  });
}

it("defaults to bottom right and clamps viewport and element resizing", () => {
  const hook = setup();
  expect(hook.result.current.style).toEqual({ left: 688, top: 288 });
  Object.defineProperty(window, "innerWidth", {
    value: 600,
    configurable: true,
  });
  act(() => window.dispatchEvent(new Event("resize")));
  expect(hook.result.current.style.left).toBe(288);
  size = { width: 580, height: 790 };
  act(() => resizeElement());
  expect(hook.result.current.style).toEqual({ left: 10, top: 5 });
});

it("drags only matching pointers, clamps, and Escape restores pre-drag position", () => {
  const hook = setup({ x: 100, y: 100 });
  expect(hook.start().stopPropagation).toHaveBeenCalledOnce();
  pointer("pointermove", 300, 300, 2);
  expect(hook.result.current.style).toEqual({ left: 100, top: 100 });
  pointer("pointermove", -500, 900);
  expect(hook.result.current.style).toEqual({ left: 12, top: 288 });
  act(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(hook.result.current.style).toEqual({ left: 100, top: 100 });
  pointer("pointermove", 250, 250);
  expect(hook.result.current.style).toEqual({ left: 100, top: 100 });
});

it("leaves nested controls alone and cleans listeners on cancel, dock and unmount", () => {
  const hook = setup({ x: 100, y: 100 });
  const button = document.createElement("button");
  const icon = document.createElement("span");
  button.append(icon);
  hook.element.append(button);
  expect(hook.start(icon).stopPropagation).not.toHaveBeenCalled();
  pointer("pointermove", 250, 250);
  expect(hook.result.current.style.left).toBe(100);
  hook.start();
  pointer("pointercancel");
  pointer("pointermove", 250, 250);
  expect(hook.result.current.style.left).toBe(100);
  hook.start();
  hook.rerender({ active: false, position: { x: 100, y: 100 } });
  pointer("pointermove", 250, 250);
  expect(hook.result.current.style).toEqual({});
  expect(hook.onPositionChange).not.toHaveBeenCalled();
  hook.rerender({ active: true, position: { x: 100, y: 100 } });
  hook.start();
  hook.unmount();
  pointer("pointermove", 250, 250);
  expect(hook.onPositionChange).not.toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalledTimes(2);
});

it("ends drag when the window loses focus", () => {
  const hook = setup({ x: 100, y: 100 });
  hook.start();
  pointer("pointermove", 120, 120);
  act(() => window.dispatchEvent(new Event("blur")));
  pointer("pointermove", 250, 250);
  expect(hook.result.current.style).toEqual({ left: 120, top: 120 });
  expect(hook.onPositionChange).toHaveBeenCalledTimes(1);
});

it("ends drag if the pointer returns with its button released", () => {
  const hook = setup({ x: 100, y: 100 });
  hook.start();
  pointer("pointermove", 250, 250, 1, 0);
  pointer("pointermove", 300, 300);
  expect(hook.result.current.style).toEqual({ left: 100, top: 100 });
  expect(hook.onPositionChange).not.toHaveBeenCalled();
});
