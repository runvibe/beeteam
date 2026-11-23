import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
} from "react";

export type FloatingChatPosition = { x: number; y: number };
type Options = {
  active: boolean;
  element: HTMLElement | null;
  position: FloatingChatPosition | null;
  onPositionChange: (position: FloatingChatPosition) => void;
};

const interactive =
  "button, a, input, textarea, select, option, [role='button'], [role='link'], [contenteditable]:not([contenteditable='false']), [data-no-drag]";

export function useFloatingChat(options: Options): {
  style: CSSProperties;
  settling: boolean;
  onPointerDown: PointerEventHandler<HTMLElement>;
} {
  const latest = useRef(options);
  latest.current = options;
  const current = useRef<FloatingChatPosition | null>(options.position);
  const [resolved, setResolved] = useState(options.position);
  const endDrag = useRef<(() => void) | null>(null);
  const settledAnchor = useRef<number | null>(null);
  const [settling, setSettling] = useState(false);
  const settlingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearSettlingTimer() {
    if (settlingTimer.current !== null) clearTimeout(settlingTimer.current);
    settlingTimer.current = null;
  }

  function clamp(position: FloatingChatPosition | null): FloatingChatPosition {
    const rect = latest.current.element?.getBoundingClientRect();
    const width = rect?.width ?? 0;
    const height = rect?.height ?? 0;
    const marginX = Math.min(12, Math.max(0, (window.innerWidth - width) / 2));
    const marginY = Math.min(
      12,
      Math.max(0, (window.innerHeight - height) / 2),
    );
    const maxX = Math.max(marginX, window.innerWidth - width - marginX);
    const maxY = Math.max(marginY, window.innerHeight - height - marginY);
    return {
      x: Math.min(maxX, Math.max(marginX, position?.x ?? maxX)),
      y: Math.min(maxY, Math.max(marginY, position?.y ?? maxY)),
    };
  }

  function update(position: FloatingChatPosition | null) {
    const next = clamp(position);
    const changed =
      current.current?.x !== next.x || current.current?.y !== next.y;
    current.current = next;
    setResolved((previous) =>
      previous?.x === next.x && previous?.y === next.y ? previous : next,
    );
    if (changed || latest.current.position === null)
      latest.current.onPositionChange(next);
  }

  function anchors() {
    const min = clamp({ x: 0, y: 0 });
    const max = clamp(null);
    return [min.x, (min.x + max.x) / 2, max.x].flatMap((x) =>
      [min.y, max.y].map((y) => ({ x, y })),
    );
  }

  function nearest(position: FloatingChatPosition) {
    return anchors()
      .map((point, index) => ({
        point,
        index,
        distance: Math.hypot(position.x - point.x, position.y - point.y),
      }))
      .reduce((best, candidate) =>
        candidate.distance < best.distance ? candidate : best,
      );
  }

  useLayoutEffect(() => {
    if (!options.active || !options.element) return;
    update(options.position);
  }, [
    options.active,
    options.element,
    options.position?.x,
    options.position?.y,
  ]);

  useLayoutEffect(() => {
    setSettling(false);
    if (!options.active || !options.element) return;
    const resize = () =>
      update(
        settledAnchor.current === null
          ? current.current
          : anchors()[settledAnchor.current],
      );
    window.addEventListener("resize", resize);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(options.element);
    return () => {
      window.removeEventListener("resize", resize);
      observer?.disconnect();
      endDrag.current?.();
      clearSettlingTimer();
    };
  }, [options.active, options.element]);

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (
      !latest.current.active ||
      !latest.current.element ||
      event.button !== 0 ||
      event.isPrimary === false
    )
      return;
    if (event.target instanceof Element && event.target.closest(interactive))
      return;
    endDrag.current?.();
    clearSettlingTimer();
    const visual = settling
      ? latest.current.element.getBoundingClientRect()
      : null;
    if (visual && Number.isFinite(visual.left) && Number.isFinite(visual.top)) {
      update({ x: visual.left, y: visual.top });
    }
    setSettling(false);
    // Only the draggable header owns this gesture; controls keep their normal behavior.
    event.stopPropagation();
    const origin = clamp(current.current);
    const originAnchor = settledAnchor.current;
    settledAnchor.current = null;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const settle = () => {
      const anchor = nearest(clamp(current.current));
      settledAnchor.current = anchor.index;
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setSettling(!reducedMotion);
      if (!reducedMotion)
        settlingTimer.current = setTimeout(() => {
          settlingTimer.current = null;
          setSettling(false);
        }, 180);
      update(anchor.point);
      cleanup();
    };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      if (pointer.buttons === 0) {
        settle();
        return;
      }
      pointer.preventDefault();
      const candidate = clamp({
        x: origin.x + pointer.clientX - startX,
        y: origin.y + pointer.clientY - startY,
      });
      // Smooth compact weights avoid a jump at the capture radius, including
      // tiny viewports where the influence of neighboring anchors overlaps.
      let weight = 0;
      let offsetX = 0;
      let offsetY = 0;
      for (const anchor of anchors()) {
        const distance = Math.hypot(
          candidate.x - anchor.x,
          candidate.y - anchor.y,
        );
        const proximity = Math.max(0, 1 - distance / 96);
        const influence = proximity * proximity * (3 - 2 * proximity);
        weight += influence;
        offsetX += (anchor.x - candidate.x) * influence;
        offsetY += (anchor.y - candidate.y) * influence;
      }
      update({
        x: candidate.x + offsetX / Math.max(1, weight),
        y: candidate.y + offsetY / Math.max(1, weight),
      });
    };
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      if (pointer.type === "pointerup") settle();
      else cleanup();
    };
    const key = (keyboard: KeyboardEvent) => {
      if (keyboard.key !== "Escape") return;
      keyboard.preventDefault();
      keyboard.stopPropagation();
      update(origin);
      settledAnchor.current = originAnchor;
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("blur", cleanup);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", key, true);
      if (endDrag.current === cleanup) endDrag.current = null;
    };
    endDrag.current = cleanup;
    window.addEventListener("blur", cleanup);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", key, true);
  };

  return {
    style: options.active
      ? { left: resolved?.x ?? 12, top: resolved?.y ?? 12 }
      : {},
    onPointerDown,
    settling: options.active && settling,
  };
}
