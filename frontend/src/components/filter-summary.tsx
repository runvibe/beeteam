import { useId, useState } from "react";
import type { ActiveFilter } from "./filter-context";

export function FilterSummary({ filters }: { filters: ActiveFilter[] }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const id = useId();
  const expanded = pinned || hovered || focused;
  return (
    <div
      className="filter-summary"
      data-expanded={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinned(false);
          setFocused(false);
          setHovered(false);
        }
      }}
    >
      <button
        type="button"
        className="filter-summary-toggle"
        aria-label={`${expanded ? "Recolher" : "Expandir"} ${filters.length} filtros ativos`}
        aria-expanded={expanded}
        aria-controls={id}
        aria-describedby={`${id}-first`}
        onClick={(event) => {
          setPinned(!pinned);
          // Pointer activation toggles on touch without trapping the focus-open state.
          if (event.detail > 0) setFocused(false);
        }}
      >
        <span id={`${id}-first`}>
          {filters[0].label}: {filters[0].value}
        </span>
        {filters.length > 1 && (
          <span className="filter-summary-count">+{filters.length - 1}</span>
        )}
      </button>
      <ul
        id={id}
        className="filter-summary-list"
        aria-label="Filtros ativos"
        inert={!expanded}
      >
        {filters.slice(1).map((filter) => (
          <li key={filter.label} className="filter-summary-tag">
            {filter.label}: {filter.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
