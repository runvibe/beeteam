import { useLayoutEffect, useRef, type PointerEventHandler } from "react";
export type VoicePosition = { x: number; y: number };
type Options = {
  element: HTMLElement | null;
  position: VoicePosition | null;
  onPositionChange: (position: VoicePosition) => void;
};

/** Free viewport movement: intentionally no docking, attraction, or persisted layout. */
export function useVoiceDrag(options: Options) {
  const latest = useRef(options);
  const position = useRef(options.position);
  const cancel = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    latest.current = options;
  }, [options]);
  function clamp(point: VoicePosition | null): VoicePosition {
    const rect = latest.current.element?.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - (rect?.width ?? 320));
    const maxY = Math.max(0, window.innerHeight - (rect?.height ?? 108));
    return {
      x: Math.min(maxX, Math.max(0, point?.x ?? maxX - 16)),
      y: Math.min(maxY, Math.max(0, point?.y ?? 72)),
    };
  }
  function update(point: VoicePosition | null) {
    const next = clamp(point);
    position.current = next;
    latest.current.onPositionChange(next);
  }
  useLayoutEffect(() => {
    if (!options.element) return;
    update(options.position);
    const resize = () => {
      cancel.current?.();
      update(position.current);
    };
    window.addEventListener("resize", resize);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(options.element);
    return () => {
      cancel.current?.();
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [options.element]);
  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (
      event.button !== 0 ||
      event.isPrimary === false ||
      !latest.current.element
    )
      return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, [data-no-drag]")
    )
      return;
    cancel.current?.();
    const origin = clamp(position.current);
    const { clientX, clientY, pointerId, currentTarget: handle } = event;
    event.preventDefault();
    event.stopPropagation();
    const cleanup = () => {
      cancel.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", abort);
      window.removeEventListener("keydown", key);
      handle.removeEventListener("lostpointercapture", abort);
      if (handle.hasPointerCapture?.(pointerId) ?? true)
        handle.releasePointerCapture?.(pointerId);
      handle.removeAttribute("data-dragging");
    };
    const restore = () => {
      update(origin);
      cleanup();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      update({
        x: origin.x + e.clientX - clientX,
        y: origin.y + e.clientY - clientY,
      });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointerId) cleanup();
    };
    const abort = (e: PointerEvent) => {
      if (e.pointerId === pointerId) restore();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        restore();
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", abort);
    window.addEventListener("keydown", key);
    handle.addEventListener("lostpointercapture", abort);
    handle.setPointerCapture?.(pointerId);
    handle.setAttribute("data-dragging", "true");
    cancel.current = restore;
  };
  return { onPointerDown };
}
