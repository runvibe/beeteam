import { useCallback, useState, type ReactNode } from "react";
import { Tooltip } from "radix-ui";
import { FilterX } from "lucide-react";
import { Button } from "./ui/button";
import {
  CompactFilters,
  FilterSummaryContext,
  type ActiveFilter,
} from "./filter-context";
import { FilterSummary } from "./filter-summary";
import "./filters.css";
export function FilterBar({
  search,
  children,
  active = false,
  onClear,
  trailingAction,
}: {
  search?: ReactNode;
  children: ReactNode;
  active?: boolean;
  onClear: () => void;
  trailingAction?: ReactNode;
}) {
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
          <div className="compact-filter-bar" role="group" aria-label="Filtros">
            {search}
            {children}
            {active && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="filter-icon"
                    aria-label="Limpar filtros"
                    onClick={onClear}
                  >
                    <FilterX aria-hidden="true" />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="navigation-tooltip"
                    sideOffset={6}
                  >
                    Limpar filtros
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
            {trailingAction}
            {Object.keys(summaries).length > 0 && (
              <FilterSummary filters={Object.values(summaries)} />
            )}
          </div>
        </Tooltip.Provider>
      </FilterSummaryContext.Provider>
    </CompactFilters.Provider>
  );
}
