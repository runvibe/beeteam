import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEventHandler,
  type KeyboardEventHandler,
} from "react";
import {
  fitFloatingBounds,
  resizeFloatingBounds,
  type FloatingBounds,
  type FloatingSize,
  type ResizeCorner,
} from "./floating-chat-bounds";

type Options = {
  active: boolean;
  element: HTMLElement | null;
  size: FloatingSize | null;
  onBoundsChange: (bounds: FloatingBounds) => void;
  onResizeStart: () => void;
};
const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

export function useFloatingChatResize(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const cleanupRef = useRef<(() => void) | null>(null);
  const [resizing, setResizing] = useState(false);
  function readBounds(): FloatingBounds | null {
    const rect = latest.current.element?.getBoundingClientRect();
    return rect
      ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      : null;
  }
  useLayoutEffect(() => {
    setResizing(false);
    if (!options.active || !options.element) return;
    const fit = () => {
      const bounds = readBounds();
      if (!bounds || !latest.current.size) return;
      const next = fitFloatingBounds(
        { ...bounds, ...latest.current.size },
        viewport(),
      );
      if (
        next.x !== bounds.x ||
        next.y !== bounds.y ||
        next.width !== latest.current.size.width ||
        next.height !== latest.current.size.height
      ) {
        latest.current.onResizeStart();
        latest.current.onBoundsChange(next);
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      cleanupRef.current?.();
      window.removeEventListener("resize", fit);
    };
  }, [options.active, options.element]);

  function handleProps(corner: ResizeCorner): {
    onPointerDown: PointerEventHandler<HTMLButtonElement>;
    onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  } {
    return {
      onPointerDown(event) {
        if (
          !latest.current.active ||
          event.button !== 0 ||
          event.isPrimary === false
        )
          return;
        const initial = readBounds();
        if (!initial) return;
        event.stopPropagation();
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        cleanupRef.current?.();
        latest.current.onResizeStart();
        latest.current.onBoundsChange(fitFloatingBounds(initial, viewport()));
        setResizing(true);
        const { clientX, clientY, pointerId } = event;
        const move = (pointer: PointerEvent) => {
          if (pointer.pointerId !== pointerId) return;
          if (pointer.buttons === 0) {
            finish();
            return;
          }
          pointer.preventDefault();
          latest.current.onBoundsChange(
            resizeFloatingBounds(
              initial,
              corner,
              pointer.clientX - clientX,
              pointer.clientY - clientY,
              viewport(),
            ),
          );
        };
        const end = (pointer: PointerEvent) => {
          if (pointer.pointerId !== pointerId) return;
          if (pointer.type === "pointercancel")
            latest.current.onBoundsChange(
              fitFloatingBounds(initial, viewport()),
            );
          finish();
        };
        const key = (keyboard: KeyboardEvent) => {
          if (keyboard.key !== "Escape") return;
          keyboard.preventDefault();
          keyboard.stopPropagation();
          latest.current.onBoundsChange(fitFloatingBounds(initial, viewport()));
          finish();
        };
        const cleanup = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
          window.removeEventListener("keydown", key, true);
          window.removeEventListener("blur", finish);
          cleanupRef.current = null;
        };
        const finish = () => {
          cleanup();
          setResizing(false);
        };
        cleanupRef.current = cleanup;
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        window.addEventListener("keydown", key, true);
        window.addEventListener("blur", finish);
      },
      onKeyDown(event) {
        const direction = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[event.key];
        if (!latest.current.active || !direction) return;
        const initial = readBounds();
        if (!initial) return;
        event.preventDefault();
        event.stopPropagation();
        latest.current.onResizeStart();
        const step = event.shiftKey ? 40 : 10;
        latest.current.onBoundsChange(
          resizeFloatingBounds(
            initial,
            corner,
            direction[0] * step,
            direction[1] * step,
            viewport(),
          ),
        );
      },
    };
  }
  return { resizing, handleProps };
}
