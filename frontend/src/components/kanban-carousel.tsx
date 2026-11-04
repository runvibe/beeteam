import { formatNumber, useLocale, t as tr } from "@/i18n";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import "./kanban-carousel.css";

type Column = { id: string; name: string; total: number };
export function KanbanCarousel({
  columns,
  children,
}: {
  columns: Column[];
  children: ReactNode;
}) {
  useLocale();
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const current = useRef(0);
  const reduced = useReducedMotion();
  const last = Math.max(0, columns.length - 1);
  const index = Math.min(active, last);
  const move = (target: number, behavior: ScrollBehavior) => {
    const node = root.current;
    if (!node) return;
    const bounded = Math.max(0, Math.min(last, target));
    const child = node.children[bounded] as HTMLElement | undefined;
    const first = node.children[0] as HTMLElement | undefined;
    if (child && first)
      node.scrollTo({ left: child.offsetLeft - first.offsetLeft, behavior });
  };
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === width) return;
      width = node.clientWidth;
      const first = node.children[0] as HTMLElement | undefined;
      const child = node.children[current.current] as HTMLElement | undefined;
      if (first && child)
        node.scrollTo({
          left: child.offsetLeft - first.offsetLeft,
          behavior: "instant",
        });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <nav
        className="kanban-mobile-navigation"
        aria-label={tr("common.columnNavigation")}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={tr("common.previousColumn")}
          disabled={index === 0}
          onClick={() => move(index - 1, reduced ? "instant" : "smooth")}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div aria-live="polite" aria-atomic="true">
          <span className="kanban-current-name">{columns[index]?.name}</span>
          <span className="kanban-current-total">
            {formatNumber(columns[index]?.total ?? 0)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tr("common.nextColumn")}
          disabled={index === last}
          onClick={() => move(index + 1, reduced ? "instant" : "smooth")}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
      <div
        ref={root}
        className="kanban kanban-carousel"
        role="region"
        aria-label={tr("common.taskBoard")}
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          if (event.target !== node) return;
          const first = node.children[0] as HTMLElement | undefined;
          if (!first) return;
          let nearest = 0,
            distance = Infinity;
          Array.from(node.children).forEach((child, i) => {
            const delta = Math.abs(
              (child as HTMLElement).offsetLeft -
                first.offsetLeft -
                node.scrollLeft,
            );
            if (delta < distance) {
              distance = delta;
              nearest = i;
            }
          });
          current.current = nearest;
          setActive(nearest);
        }}
      >
        {children}
      </div>
    </>
  );
}
