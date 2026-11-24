import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FloatingSessionInformation } from "./floating-session-information";

afterEach(() => vi.unstubAllGlobals());

it("tracks the actual rendered position and size during drag and snap, then cancels tracking", () => {
  let nextFrame: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 7;
  });
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const anchor = document.createElement("aside");
  let rect = { left: 220, top: 100, width: 440, height: 600 };
  anchor.getBoundingClientRect = () => rect as DOMRect;
  const view = render(
    <FloatingSessionInformation
      onClose={() => {}}
      anchor={anchor}
      area={{ x: 200, y: 80, width: 1100, height: 720 }}
    >
      <span>Information</span>
    </FloatingSessionInformation>,
  );
  const panel = document.querySelector<HTMLElement>(
    ".floating-session-information",
  )!;
  expect(panel.style.left).toBe("672px");
  // CSS snap interpolation changes the rendered rectangle without a React render.
  rect = { left: 260, top: 120, width: 440, height: 600 };
  act(() => nextFrame(16));
  expect(panel.style.left).toBe("712px");
  expect(panel.style.top).toBe("120px");
  rect = { left: 260, top: 120, width: 480, height: 400 };
  act(() => nextFrame(32));
  expect(panel.style.left).toBe("752px");
  expect(panel.style.height).toBe("400px");
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(7);
  expect(document.querySelector(".floating-session-information")).toBeNull();
});

it("leaves Escape cancellation to active drag or resize gestures", () => {
  const onClose = vi.fn();
  const view = render(
    <FloatingSessionInformation
      anchor={document.createElement("aside")}
      area={{ x: 0, y: 0, width: 900, height: 700 }}
      onClose={onClose}
    >
      Information
    </FloatingSessionInformation>,
  );
  const escape = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  escape.preventDefault();
  act(() => window.dispatchEvent(escape));
  expect(onClose).not.toHaveBeenCalled();
  act(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(onClose).toHaveBeenCalledOnce();
  view.unmount();
});
