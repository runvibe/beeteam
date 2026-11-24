import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useVoiceDrag } from "./use-voice-drag";
beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
  });
});
function setup() {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ width: 320, height: 108 }) as DOMRect;
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  const onPositionChange = vi.fn();
  const hook = renderHook(() =>
    useVoiceDrag({ element, position: { x: 200, y: 150 }, onPositionChange }),
  );
  const start = (target: Element = element, pointerType = "mouse") =>
    act(() =>
      hook.result.current.onPointerDown({
        target,
        currentTarget: element,
        button: 0,
        pointerId: 1,
        pointerType,
        clientX: 250,
        clientY: 190,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as ReactPointerEvent<HTMLDivElement>),
    );
  return { ...hook, element, onPositionChange, start };
}
function pointer(type: string, x: number, y: number) {
  act(() => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, clientX: x, clientY: y });
    window.dispatchEvent(event);
  });
}
it("moves freely without snapping and captures both mouse and touch gestures", () => {
  for (const pointerType of ["mouse", "touch"]) {
    const h = setup();
    h.start(h.element, pointerType);
    expect(h.element.setPointerCapture).toHaveBeenCalledWith(1);
    pointer("pointermove", 373, 277);
    pointer("pointerup", 373, 277);
    expect(h.onPositionChange).toHaveBeenLastCalledWith({ x: 323, y: 237 });
    expect(h.element.releasePointerCapture).toHaveBeenCalledWith(1);
    h.unmount();
  }
});
it("restores the previous position on Escape and pointer cancellation", () => {
  const h = setup();
  h.start();
  pointer("pointermove", 400, 300);
  act(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(h.onPositionChange).toHaveBeenLastCalledWith({ x: 200, y: 150 });
  h.start();
  pointer("pointermove", 400, 300);
  pointer("pointercancel", 400, 300);
  expect(h.onPositionChange).toHaveBeenLastCalledWith({ x: 200, y: 150 });
});
it("ignores controls and clamps to the viewport on drag and resize", () => {
  const h = setup();
  const button = document.createElement("button");
  h.start(button);
  expect(h.element.setPointerCapture).not.toHaveBeenCalled();
  h.start();
  pointer("pointermove", 2000, 2000);
  pointer("pointerup", 2000, 2000);
  expect(h.onPositionChange).toHaveBeenLastCalledWith({ x: 680, y: 692 });
  Object.defineProperty(window, "innerWidth", {
    value: 400,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: 300,
    configurable: true,
  });
  act(() => window.dispatchEvent(new Event("resize")));
  expect(h.onPositionChange).toHaveBeenLastCalledWith({ x: 80, y: 192 });
});
