import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ChatPanelSide } from "@/state/chat-panel";

const narrowQuery = "(max-width: 850px)";
const dragThreshold = 6;

function subscribeNarrow(notify: () => void) {
  const media = window.matchMedia?.(narrowQuery);
  media?.addEventListener?.("change", notify);
  return () => media?.removeEventListener?.("change", notify);
}
const narrowSnapshot = () => window.matchMedia?.(narrowQuery).matches ?? false;

export type ChatPanelDrag = { target: ChatPanelSide; dx: number; dy: number };

const nearestSide = (clientX: number): ChatPanelSide =>
  clientX < window.innerWidth / 2 ? "left" : "right";

/** Drags the chat panel by its header and docks it on the side nearest to the pointer. */
export function useChatPanelDock(onDock: (side: ChatPanelSide) => void) {
  const narrow = useSyncExternalStore(subscribeNarrow, narrowSnapshot, () => false);
  const [drag, setDrag] = useState<ChatPanelDrag | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (narrow || event.button !== 0) return;
      if ((event.target as Element).closest("button, a, input, [contenteditable]"))
        return;
      cleanup.current?.();
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;
      let cancelled = false;
      const move = (e: PointerEvent) => {
        if (cancelled) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!active && Math.hypot(dx, dy) < dragThreshold) return;
        active = true;
        setDrag({ target: nearestSide(e.clientX), dx, dy });
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key);
        cleanup.current = null;
        setDrag(null);
      };
      const up = (e: PointerEvent) => {
        const dock = active && !cancelled;
        stop();
        if (dock) onDock(nearestSide(e.clientX));
      };
      const cancel = () => {
        cancelled = true;
        stop();
      };
      const key = (e: KeyboardEvent) => {
        if (e.key === "Escape" && active) {
          e.preventDefault();
          cancel();
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key);
      cleanup.current = stop;
    },
    [narrow, onDock],
  );

  return { drag, draggable: !narrow, onPointerDown };
}
