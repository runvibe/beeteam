import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PlanRevision } from "@/api/types";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure } from "@/components/shared";
import type { usePlanPages } from "./plan-pages";
import { PlanCarousel } from "./plan-carousel";
import "./plan-navigation.css";

export function PlanNavigation({
  taskId,
  plans,
  current,
  onSelect,
  children,
}: {
  taskId: string;
  plans: ReturnType<typeof usePlanPages>;
  current: PlanRevision | null | undefined;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.("(max-width: 1055px)").matches ?? false,
  );
  const list = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { query } = plans;
  useLayoutEffect(() => {
    const node = list.current;
    if (mobile || !node) return;
    const main = node.closest("[data-detail-scroll]");
    const measure = () => {
      const bottom = main?.getBoundingClientRect().bottom ?? window.innerHeight;
      node.style.maxHeight = `${Math.max(160, bottom - node.getBoundingClientRect().top - 8)}px`;
    };
    measure();
    main?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      main?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [mobile]);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 1055px)");
    if (!media) return;
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (
      mobile ||
      !sentinel.current ||
      !query.hasNextPage ||
      query.isFetching ||
      query.error ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void query.fetchNextPage({ cancelRefetch: false });
      },
      { root: list.current, rootMargin: "0px 0px 160px 0px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [
    mobile,
    query.hasNextPage,
    query.isFetching,
    query.error,
    query.fetchNextPage,
  ]);
  const feedback = (
    <>
      {query.isFetching && <LoadingIndicator label="Carregando planos" />}
      {query.error && (
        <Failure error={query.error} retry={() => void plans.retry()} />
      )}
    </>
  );
  return mobile ? (
    <PlanCarousel
      key={taskId}
      plans={plans}
      current={current}
      onSelect={onSelect}
      feedback={feedback}
    >
      {children}
    </PlanCarousel>
  ) : (
    <div className="task-plan-workspace">
      <nav
        ref={list}
        className="task-plan-navigation"
        aria-label="Planos disponíveis"
        tabIndex={0}
      >
        <h3>Planos</h3>
        {current &&
          !plans.items.some((item) => item.planId === current.planId) && (
            <Button
              variant="ghost"
              aria-current="page"
              onClick={() => onSelect(current.planId)}
            >
              {current.title}
            </Button>
          )}
        {plans.items.map((item) => (
          <Button
            key={item.planId}
            variant="ghost"
            aria-current={item.planId === current?.planId ? "page" : undefined}
            onClick={() => onSelect(item.planId)}
          >
            {item.title}
          </Button>
        ))}
        <div ref={sentinel} style={{ minHeight: 1 }}>
          {feedback}
        </div>
      </nav>
      <div className="task-plan-content">{children}</div>
    </div>
  );
}
