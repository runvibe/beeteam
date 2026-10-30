import {
  useId,
  useState,
  useRef,
  useLayoutEffect,
  type MouseEvent,
} from "react";
import type { ActiveFilter } from "./filter-context";
import { X } from "lucide-react";

function RemoveFilter({
  filter,
  onRemove,
}: {
  filter: ActiveFilter;
  onRemove: (
    filter: ActiveFilter,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  if (!filter.onRemove) return null;
  return (
    <button
      type="button"
      className="filter-remove"
      aria-label={`Remover filtro ${filter.label}: ${filter.value}`}
      onClick={(event) => {
        event.stopPropagation();
        onRemove(filter, event);
      }}
    >
      <X aria-hidden="true" />
    </button>
  );
}

export function FilterSummary({ filters }: { filters: ActiveFilter[] }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [area, setArea] = useState<{
    width: number;
    height: number;
    head: number;
  } | null>(null);
  const expanded = pinned || hovered || focused;
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const buttons =
      root.current?.querySelectorAll<HTMLButtonElement>(".filter-remove");
    buttons?.[Math.min(pendingFocus.current, buttons.length - 1)]?.focus();
    pendingFocus.current = null;
  }, [filters]);
  const remove = (
    filter: ActiveFilter,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const node = root.current;
    if (filters.length === 1) {
      node
        ?.closest(".compact-filter-bar")
        ?.querySelector<HTMLButtonElement>(
          "button:not(.filter-remove):not(.filter-summary-toggle)",
        )
        ?.focus();
    } else {
      if (expanded && node) {
        const bounds = node.getBoundingClientRect();
        const head = node
          .querySelector(".filter-summary-head")!
          .getBoundingClientRect();
        const list = node
          .querySelector(".filter-summary-list")!
          .getBoundingClientRect();
        setArea({
          width: bounds.width,
          height: Math.max(bounds.height, list.bottom - bounds.top),
          head: head.height,
        });
      }
      if (event.detail === 0) {
        pendingFocus.current = filters.indexOf(filter);
        setFocused(true);
      }
    }
    filter.onRemove?.();
  };
  return (
    <div
      ref={root}
      className="filter-summary"
      style={
        area
          ? { width: area.width, minHeight: area.height, pointerEvents: "auto" }
          : undefined
      }
      data-expanded={expanded}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setPinned(false);
        setArea(null);
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          pendingFocus.current === null
        ) {
          setFocused(false);
          if (!hovered) setArea(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinned(false);
          setFocused(false);
          setHovered(false);
          setArea(null);
        }
      }}
    >
      <div className="filter-summary-head">
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
        <RemoveFilter filter={filters[0]} onRemove={remove} />
      </div>
      <ul
        id={id}
        className="filter-summary-list"
        style={area ? { top: area.head } : undefined}
        aria-label="Filtros ativos"
        inert={!expanded}
      >
        {filters.slice(1).map((filter) => (
          <li key={filter.label} className="filter-summary-tag">
            {filter.label}: {filter.value}
            <RemoveFilter filter={filter} onRemove={remove} />
          </li>
        ))}
      </ul>
    </div>
  );
}
