import { useLocale, t as tr } from "@/i18n";

import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { PlanRevision } from "@/api/types";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure } from "@/components/shared";
import type { usePlanPages } from "./plan-pages";
import { usePlanReveal } from "./plan-reveal";
import { PlanCarousel } from "./plan-carousel";
import "./plan-navigation.css";

export function PlanNavigation({
  taskId,
  plans,
  current,
  selectedId,
  revealConsumed,
  onSelect,
  children,
}: {
  taskId: string;
  plans: ReturnType<typeof usePlanPages>;
  current: PlanRevision | null | undefined;
  selectedId?: string;
  revealConsumed: RefObject<boolean>;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  useLocale();
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

  const reveal = usePlanReveal(list, selectedId, plans, mobile, revealConsumed);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 1055px)");
    if (!media) return;
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useInfiniteScroll({
    sentinel,
    getRoot: () => list.current,
    identity: taskId,
    progress: plans.items.map((item) => item.planId).join(","),
    enabled: !mobile && !plans.locating,
    hasMore: !!query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    margin: 160,
    loadMore: plans.loadMore,
  });
  const feedback = (
    <>
      {query.isFetching &&
        (query.isFetchingNextPage || !plans.items.length) && (
          <LoadingIndicator label={tr("tasks.loadingPlans")} />
        )}
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
        aria-label={tr("tasks.availablePlans")}
        tabIndex={0}
        onWheelCapture={reveal.manuallyInteracted}
        onPointerDownCapture={reveal.manuallyInteracted}
        onTouchStartCapture={reveal.manuallyInteracted}
        onKeyDownCapture={reveal.manuallyInteracted}
      >
        <h3>{tr("tasks.plans")}</h3>
        {plans.items.map((item) => (
          <Button
            key={item.planId}
            data-plan-id={item.planId}
            variant="ghost"
            aria-current={item.planId === current?.planId ? "page" : undefined}
            onClick={() => onSelect(item.planId)}
          >
            {item.title}
          </Button>
        ))}
        <div ref={sentinel} style={{ minHeight: 60 }}>
          {feedback}
        </div>
      </nav>
      <div className="task-plan-content">{children}</div>
    </div>
  );
}
