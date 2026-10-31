import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import "./task-sections.css";

const sections = [
  ["overview", "Visão geral"],
  ["specification", "Especificação"],
  ["children", "Subtasks"],
  ["plans", "Planos"],
  ["comments", "Conversa"],
  ["attachments", "Arquivos"],
  ["summaries", "Resumos"],
  ["timeline", "Timeline"],
] as const;

/** Reveal within this strip only: scrollIntoView would also move the task/document. */
function reveal(viewport: HTMLElement, target: HTMLElement) {
  const bounds = viewport.getBoundingClientRect();
  const tab = target.getBoundingClientRect();
  if (tab.left < bounds.left) viewport.scrollLeft += tab.left - bounds.left;
  else if (tab.right > bounds.right)
    viewport.scrollLeft += tab.right - bounds.right;
}

export function TaskSections({ value }: { value: string }) {
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
    const page = nav.closest<HTMLElement>(".task-page");
    const html = document.documentElement;
    const property = "--task-sections-height";
    const oldHtml = html.style.getPropertyValue(property);
    const oldPage = page?.style.getPropertyValue(property) ?? "";
    const resize = () => {
      const height = `${nav.getBoundingClientRect().height}px`;
      page?.style.setProperty(property, height);
      html.style.setProperty(property, height);
      measure();
      const focus = node.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
      const selected = node.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (focus || selected) reveal(node, (focus || selected)!);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(nav);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => {
      observer.disconnect();
      if (oldHtml) html.style.setProperty(property, oldHtml);
      else html.style.removeProperty(property);
      if (oldPage) page?.style.setProperty(property, oldPage);
      else page?.style.removeProperty(property);
    };
  }, []);
  useLayoutEffect(() => {
    const node = viewport.current;
    const selected = node?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (node && selected) reveal(node, selected);
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
      className="task-section-navigation"
      data-overflow={edges.overflow}
    >
      <Button
        className="task-section-arrow"
        variant="ghost"
        aria-label="Mostrar abas anteriores"
        aria-disabled={edges.start}
        onClick={() => move(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div
        className="task-section-viewport"
        ref={viewport}
        onScroll={measure}
        onFocusCapture={(event) => {
          if (viewport.current && event.target.getAttribute("role") === "tab")
            reveal(viewport.current, event.target);
        }}
      >
        <TabsList className="task-section-list" aria-label="Seção da tarefa">
          {sections.map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <Button
        className="task-section-arrow"
        variant="ghost"
        aria-label="Mostrar próximas abas"
        aria-disabled={edges.end}
        onClick={() => move(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
