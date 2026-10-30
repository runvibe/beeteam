import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanRevision } from "@/api/types";
import type { usePlanPages } from "./plan-pages";

export function PlanCarousel({
  plans,
  current,
  onSelect,
  feedback,
  children,
}: {
  plans: ReturnType<typeof usePlanPages>;
  current: PlanRevision | null | undefined;
  onSelect: (id: string) => void;
  feedback: ReactNode;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const moving = useRef(false);
  const selection = useRef(current?.planId);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    selection.current = current?.planId;
  }, [current?.planId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const index = plans.items.findIndex(
    (item) => item.planId === current?.planId,
  );
  const external = !!current && index < 0;
  const slides = external ? [current] : plans.items;
  const active = external ? 0 : Math.max(0, index);
  const canNext =
    !external && (active < slides.length - 1 || plans.query.hasNextPage);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    node.scrollLeft = active * node.clientWidth;
    const panel = node.querySelector<HTMLElement>("[data-plan-scroll]");
    if (panel && current)
      panel.scrollTop = positions.current.get(current.planId) ?? 0;
  }, [active, current?.planId]);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      node.scrollLeft = active * node.clientWidth;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);
  const move = async (target: number) => {
    if (moving.current || target < 0 || external) return;
    const existing = slides[target];
    if (existing) {
      onSelect(existing.planId);
      return;
    }
    if (!plans.query.hasNextPage || plans.query.isFetching || plans.query.error)
      return;
    moving.current = true;
    const requestedFrom = current?.planId;
    try {
      const result = await plans.loadMore();
      const next = [
        ...new Map(
          result?.data?.pages
            .flatMap((page) => page.items)
            .map((item) => [item.planId, item]) ?? [],
        ).values(),
      ][target];
      if (next && mounted.current && selection.current === requestedFrom)
        onSelect(next.planId);
    } finally {
      moving.current = false;
      if (root.current && selection.current === requestedFrom)
        root.current.scrollLeft = active * root.current.clientWidth;
    }
  };
  return (
    <div className="task-plan-mobile">
      <nav
        className="task-plan-mobile-controls"
        aria-label="Navegação entre planos"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Plano anterior"
          disabled={external || active === 0}
          onClick={() => void move(active - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span aria-live="polite">{current?.title ?? "Planos"}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo plano"
          disabled={!canNext || plans.query.isFetching}
          onClick={() => void move(active + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
      {external && (
        <Button
          variant="ghost"
          onClick={() => onSelect(plans.items[0]?.planId ?? "")}
        >
          Ir ao primeiro plano
        </Button>
      )}
      <div
        ref={root}
        className="task-plan-carousel"
        aria-label="Páginas dos planos"
        role="region"
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          if (
            event.target !== node ||
            !node.clientWidth ||
            window.getSelection()?.toString()
          )
            return;
          const nearest = Math.round(node.scrollLeft / node.clientWidth);
          if (
            Math.abs(node.scrollLeft - nearest * node.clientWidth) > 2 ||
            nearest === active
          )
            return;
          void move(nearest);
        }}
      >
        {slides.map((item, i) => (
          <div
            className="task-plan-slide"
            key={item.planId}
            aria-hidden={i !== active}
            inert={i !== active}
          >
            {i === active ? (
              <div
                className="task-plan-mobile-reading"
                data-plan-scroll
                tabIndex={0}
                aria-label="Conteúdo do plano"
                role="region"
                onScroll={(event) => {
                  positions.current.set(
                    item.planId,
                    event.currentTarget.scrollTop,
                  );
                }}
              >
                {children}
              </div>
            ) : (
              <p>{item.title}</p>
            )}
          </div>
        ))}
        {!external && plans.query.hasNextPage && (
          <div className="task-plan-slide" aria-hidden="true">
            <p>Próximo plano</p>
          </div>
        )}
      </div>
      {!slides.length && children}
      {feedback}
    </div>
  );
}
