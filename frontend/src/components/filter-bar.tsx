import { useState, useId, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";
export function FilterBar({
  search,
  children,
  active = false,
  onClear,
}: {
  search: ReactNode;
  children: ReactNode;
  active?: boolean;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="filter-bar">
      <div className="filter-search">
        {search}
        <Button
          className="filter-toggle"
          variant="outline"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal />
          Filtros{active ? " ativos" : ""}
        </Button>
      </div>
      <div id={id} className={`filter-options${expanded ? " expanded" : ""}`}>
        {children}
      </div>
      {active && (
        <Button variant="ghost" className="clear-filters" onClick={onClear}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
