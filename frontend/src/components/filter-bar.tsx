import type { ReactNode } from "react";
import { Tooltip } from "radix-ui";
import { FilterX } from "lucide-react";
import { Button } from "./ui/button";
import { CompactFilters } from "./filter-context";
import "./filters.css";
export function FilterBar({
  search,
  children,
  active = false,
  onClear,
}: {
  search?: ReactNode;
  children: ReactNode;
  active?: boolean;
  onClear: () => void;
}) {
  return (
    <CompactFilters.Provider value={true}>
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
                <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
                  Limpar filtros
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </div>
      </Tooltip.Provider>
    </CompactFilters.Provider>
  );
}
