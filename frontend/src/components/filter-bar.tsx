import { useCallback, useId, useState, type ReactNode } from "react";
import { Tooltip } from "radix-ui";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { movingControls, ClearFilterMotion } from "./filter-motion";
import {
  CompactFilters,
  FilterSummaryContext,
  type ActiveFilter,
} from "./filter-context";
import { FilterSummary } from "./filter-summary";
import "./filters.css";
import { HeaderFilters } from "./header-filters";
export function FilterBar({
  search,
  children,
  active = false,
  onClear,
  trailingAction,
  inHeader = false,
}: {
  search?: ReactNode;
  children: ReactNode;
  active?: boolean;
  onClear: () => void;
  trailingAction?: ReactNode;
  inHeader?: boolean;
}) {
  const groupId = useId();
  const reduced = !!useReducedMotion();
  const [summaries, setSummaries] = useState<Record<string, ActiveFilter>>({});
  const register = useCallback((id: string, filter?: ActiveFilter) => {
    setSummaries((current) => {
      if (!filter && !current[id]) return current;
      if (
        filter &&
        current[id]?.label === filter.label &&
        current[id]?.value === filter.value
      )
        return current;
      const next = { ...current };
      if (filter) next[id] = filter;
      else delete next[id];
      return next;
    });
  }, []);
  return (
    <CompactFilters.Provider value={true}>
      <FilterSummaryContext.Provider value={register}>
        <Tooltip.Provider delayDuration={300}>
          <HeaderFilters enabled={inHeader}>
            <div
              className="compact-filter-bar"
              role="group"
              aria-label="Filtros"
            >
              <LayoutGroup id={groupId}>
                <motion.div className="filter-controls-row" layoutScroll>
                  {movingControls(search, "search", active, reduced)}
                  {movingControls(children, "filter", active, reduced)}
                  <AnimatePresence initial={false}>
                    {active && (
                      <ClearFilterMotion key="clear" onClear={onClear} />
                    )}
                  </AnimatePresence>
                  {movingControls(trailingAction, "action", active, reduced)}
                </motion.div>
              </LayoutGroup>
              {Object.keys(summaries).length > 0 && (
                <FilterSummary filters={Object.values(summaries)} />
              )}
            </div>
          </HeaderFilters>
        </Tooltip.Provider>
      </FilterSummaryContext.Provider>
    </CompactFilters.Provider>
  );
}
