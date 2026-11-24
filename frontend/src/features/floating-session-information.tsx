import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FloatingBounds } from "./floating-chat-bounds";
import { placeFloatingInformation } from "./floating-information-bounds";

export function FloatingSessionInformation({
  anchor,
  area,
  children,
  onClose,
}: {
  anchor: HTMLElement | null;
  area: FloatingBounds;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      // Drag/resize own Escape in capture phase; let their cancellation win.
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [onClose]);
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!anchor || !container.current) return;
    const element = container.current;
    let frame = 0;
    let previous = "";
    const track = () => {
      // Read the rendered rectangle, including intermediate magnetic snap frames.
      const rect = anchor.getBoundingClientRect();
      const placement = placeFloatingInformation(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        area,
      );
      const signature = `${placement.x},${placement.y},${placement.width},${placement.height}`;
      if (signature !== previous) {
        Object.assign(element.style, {
          left: `${placement.x}px`,
          top: `${placement.y}px`,
          width: `${placement.width}px`,
          height: `${placement.height}px`,
        });
        previous = signature;
      }
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [anchor, area]);
  return createPortal(
    <div ref={container} className="floating-session-information">
      {children}
    </div>,
    document.body,
  );
}
