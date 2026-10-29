import { useUrlState, usePageSize } from "@/routing/query";
import { useEntity, useList } from "@/api/context";
import { Choice, Pager, QueryState } from "./shared";
import { Input } from "./ui/input";
import { useCompactFilters } from "./filter-context";
import { FilterPopover, FilterOptions } from "./filter-controls";
/** A searchable, paginated selector: options beyond the first page remain reachable. */
export function EntityFilter({
  resource,
  label,
  value,
  onChange,
}: {
  resource: "agents" | "teams";
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const compact = useCompactFilters();
  const scope = `selector-${resource}-${label}`;
  const [name, setName] = useUrlState<string>(`${scope}.name`, ""),
    [offset, setOffset] = useUrlState<number>(`${scope}.offset`, 0);
  const limit = usePageSize(scope, 25);
  const q = useList(resource, "", {
    name: name || undefined,
    offset,
    limit,
    sortBy: "name",
  });
  const selected = useEntity(resource, value);
  const options =
    q.data?.items.map((i) => ({ value: i.id, label: i.name })) ?? [];
  if (value && !options.some((o) => o.value === value))
    options.unshift({ value, label: selected.data?.name ?? "Selecionado" });
  const Options = compact ? FilterOptions : Choice;
  const content = (
    <div className="entity-filter">
      <Options
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        all="Todos"
      />
      {(q.data?.hasMore || offset > 0 || name) && (
        <div className="selector-pages">
          <Input
            aria-label={`Buscar opções de ${label}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setOffset(0);
            }}
            placeholder="Filtrar opções…"
          />
          <QueryState query={q}>
            {q.data && <Pager page={q.data} onOffset={setOffset} />}
          </QueryState>
        </div>
      )}
      {q.error && <QueryState query={q}>{null}</QueryState>}
    </div>
  );
  return compact ? (
    <FilterPopover
      label={label}
      onClear={() => onChange("")}
      active={!!value}
      summary={
        options.find((option) => option.value === value)?.label || "Todos"
      }
    >
      {content}
    </FilterPopover>
  ) : (
    content
  );
}
