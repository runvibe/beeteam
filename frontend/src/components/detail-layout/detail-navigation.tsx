import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { revealInScrollStrip } from "@/components/scroll-reveal";
import "./detail-navigation.css";

export function DetailNavigation({
  value,
  items,
  ariaLabel,
  previousLabel,
  nextLabel,
  filterSlot,
  heightProperty = "--detail-navigation-height",
}: {
  value: string;
  items: ReadonlyArray<readonly [string, string]>;
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
  filterSlot?: ReactNode;
  heightProperty?: string;
}) {
  const navigation = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({
    overflow: false,
    start: true,
    end: true,
  });
  const measure = () => {
    const node = viewport.current;
    if (!node) return;
    const next = {
      overflow: node.scrollWidth > node.clientWidth + 1,
      start: node.scrollLeft <= 1,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 1,
    };
    setEdges((old) =>
      old.overflow === next.overflow &&
      old.start === next.start &&
      old.end === next.end
        ? old
        : next,
    );
  };
  useLayoutEffect(() => {
    const nav = navigation.current;
    const node = viewport.current;
    if (!nav || !node) return;
    const page = nav.closest<HTMLElement>(".detail-page");
    const html = document.documentElement;
    const property = heightProperty;
    const oldHtml = html.style.getPropertyValue(property);
    const oldPage = page?.style.getPropertyValue(property) ?? "";
    const resize = () => {
      const height = `${nav.getBoundingClientRect().height || nav.querySelector(".detail-section-navigation-strip")?.getBoundingClientRect().height || 0}px`;
      page?.style.setProperty(property, height);
      html.style.setProperty(property, height);
      measure();
      const focus = node.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
      const selected = node.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (focus || selected) revealInScrollStrip(node, (focus || selected)!);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(nav);
    if (nav.firstElementChild) observer.observe(nav.firstElementChild);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => {
      observer.disconnect();
      if (oldHtml) html.style.setProperty(property, oldHtml);
      else html.style.removeProperty(property);
      if (oldPage) page?.style.setProperty(property, oldPage);
      else page?.style.removeProperty(property);
    };
  }, [heightProperty]);
  useLayoutEffect(() => {
    const node = viewport.current;
    const selected = node?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (node && selected) revealInScrollStrip(node, selected);
    measure();
  }, [value]);
  function move(direction: -1 | 1) {
    const node = viewport.current;
    if (!node || (direction < 0 ? edges.start : edges.end)) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.75,
      behavior: "instant",
    });
  }
  return (
    <div
      ref={navigation}
      className="detail-section-navigation"
      data-overflow={edges.overflow}
    >
      <div className="detail-section-navigation-strip">
        <div
          className="detail-section-viewport"
          ref={viewport}
          onScroll={measure}
          onFocusCapture={(event) => {
            if (viewport.current && event.target.getAttribute("role") === "tab")
              revealInScrollStrip(viewport.current, event.target);
          }}
        >
          <TabsList className="detail-section-list" aria-label={ariaLabel}>
            {items.map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Button
          className="detail-section-arrow"
          variant="ghost"
          aria-label={previousLabel}
          aria-disabled={edges.start}
          onClick={() => move(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          className="detail-section-arrow"
          variant="ghost"
          aria-label={nextLabel}
          aria-disabled={edges.end}
          onClick={() => move(1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      {filterSlot}
    </div>
  );
}
