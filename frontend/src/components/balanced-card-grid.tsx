import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./balanced-card-grid.css";

export function BalancedCardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className: "board-grid" | "agent-grid";
}) {
  const count = Children.count(children);
  const columns = count <= 3 ? Math.max(1, count) : Math.ceil(Math.sqrt(count));
  const region = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = region.current;
    if (!node) return;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const capacity = Math.max(1, Math.floor((width + 14) / 294));
  const saturated = width > 0 && columns >= capacity;
  return (
    <div ref={region} className="balanced-card-region">
      <div
        className={`${className} balanced-card-grid`}
        data-saturated={saturated}
        style={
          {
            "--grid-width": `${columns * 280 + (columns - 1) * 14}px`,
            "--grid-columns": capacity,
          } as CSSProperties
        }
      >
        {Children.map(children, (child) =>
          isValidElement<Record<string, unknown>>(child)
            ? cloneElement(child, { "data-card-id": String(child.key) })
            : child,
        )}
      </div>
    </div>
  );
}
