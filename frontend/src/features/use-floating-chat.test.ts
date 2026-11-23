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
  expect(hook.result.current.style).toEqual({ left: 12, top: 12 });
  expect(hook.onPositionChange).toHaveBeenCalledTimes(1);
});

it.each([12, 350, 688].flatMap((x) => [12, 288].map((y) => [x, y])))(
  "magnetizes anchor %s,%s and retains it after release",
  (x, y) => {
    const hook = setup({ x: 100, y: 100 });
    hook.start();
    pointer("pointermove", x + 20, y + 15);
    expect(Number(hook.result.current.style.left)).toBeGreaterThanOrEqual(x);
    expect(Number(hook.result.current.style.left)).toBeLessThan(x + 20);
    expect(Number(hook.result.current.style.top)).toBeGreaterThanOrEqual(y);
    expect(Number(hook.result.current.style.top)).toBeLessThan(y + 15);
    pointer("pointerup", x + 20, y + 15);
    expect(hook.result.current.style).toEqual({ left: x, top: y });
  },
);

it("moves freely outside magnetic radius then settles on nearest anchor", () => {
  const hook = setup({ x: 100, y: 100 });
  hook.start();
  pointer("pointermove", 240, 220);
  expect(hook.result.current.style).toEqual({ left: 240, top: 220 });
  hook.rerender({ active: true, position: { x: 240, y: 220 } });
  expect(hook.result.current.style).toEqual({ left: 240, top: 220 });
  pointer("pointerup", 240, 220);
  expect(hook.result.current.style).toEqual({ left: 350, top: 288 });
  Object.defineProperty(window, "innerWidth", {
    value: 1200,
    configurable: true,
  });
  act(() => window.dispatchEvent(new Event("resize")));
  expect(hook.result.current.style).toEqual({ left: 450, top: 288 });
});

it("attracts continuously at the capture boundary and animates only settling", () => {
  vi.useFakeTimers();
  const hook = setup({ x: 100, y: 100 });
  hook.start();
  pointer("pointermove", 350, 109);
  expect(hook.result.current.style.top).toBe(109);
  pointer("pointermove", 350, 107);
  expect(Number(hook.result.current.style.top)).toBeGreaterThan(106);
  expect(Number(hook.result.current.style.top)).toBeLessThan(107);
  expect(hook.result.current.settling).toBe(false);
  pointer("pointermove", 350, 60);
  expect(Number(hook.result.current.style.top)).toBeLessThan(60);
  expect(Number(hook.result.current.style.top)).toBeGreaterThan(12);
  pointer("pointerup", 350, 60);
  expect(hook.result.current.style.top).toBe(12);
  expect(hook.result.current.settling).toBe(true);
  act(() => vi.advanceTimersByTime(180));
  expect(hook.result.current.settling).toBe(false);
  hook.unmount();
  vi.useRealTimers();
});

it.each([12, 350, 688])("does not settle at removed middle anchor %s", (x) => {
  const hook = setup({ x: 100, y: 100 });
  hook.start();
  pointer("pointermove", x, 150);
  expect(hook.result.current.style).toEqual({ left: x, top: 150 });
  pointer("pointerup", x, 150);
  expect(hook.result.current.style).toEqual({ left: x, top: 12 });
});

it("respects reduced motion on release and cancels settling for a new drag", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  const hook = setup({ x: 100, y: 100 });
  hook.start();
  pointer("pointermove", 240, 220);
  pointer("pointerup", 240, 220);
  expect(hook.result.current.settling).toBe(false);
  expect(hook.result.current.style).toEqual({ left: 350, top: 288 });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  hook.start();
  pointer("pointermove", 200, 200);
  pointer("pointerup", 200, 200);
  expect(hook.result.current.settling).toBe(true);
  hook.start();
  expect(hook.result.current.settling).toBe(false);
  hook.unmount();
});

it("forgets magnetic anchor and settle animation before manual resize", () => {
  const hook = setup({x:100,y:100});
  hook.start();
  pointer("pointermove",350,20);
  pointer("pointerup",350,20);
  expect(hook.result.current.settling).toBe(true);
  act(() => hook.result.current.onResizeStart());
  hook.rerender({active:true,position:{x:250,y:100}});
  size = {width:500,height:400};
  act(() => resizeElement());
  expect(hook.result.current.settling).toBe(false);
  expect(hook.result.current.style).toEqual({left:250,top:100});
});
