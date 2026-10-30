import { useId, useState } from "react";
import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApi, useEntity } from "@/api/context";
import { useCompactFilters } from "./filter-context";
import { FilterPopover } from "./filter-controls";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

type Props = { label: string; value: string; onChange: (id: string) => void };
export function TeamFilter(props: Props) {
  const compact = useCompactFilters();
  const selected = useEntity("teams", props.value);
  const content = <TeamSuggestions {...props} autoFocus={compact} />;
  return compact ? (
    <FilterPopover
      label={props.label}
      active={!!props.value}
      summary={selected.data?.name || "Time selecionado"}
      onClear={() => props.onChange("")}
    >
      {content}
    </FilterPopover>
  ) : (
    content
  );
}
function TeamSuggestions({
  label,
  value,
  onChange,
  autoFocus,
}: Props & { autoFocus: boolean }) {
  const api = useApi();
  const id = useId();
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const term = text.trim();
  const selected = useEntity("teams", value);
  const selectedOnly = !!value && !term;
  const filters = term
    ? { name: term, limit: 5, offset: 0, sortBy: "name" }
    : { limit: 5, offset: 0, sortBy: "createdAt", sortOrder: "desc" as const };
  const query = useQuery({
    enabled: !selectedOnly,
    queryKey: ["teams", "autocomplete", filters],
    queryFn: ({ signal }) => api.list("teams", "", filters, signal),
  });
  const items = selectedOnly
    ? selected.data
      ? [selected.data]
      : []
    : !query.isFetching
      ? (query.data?.items ?? []).slice(0, 5)
      : [];
  const loading = selectedOnly ? selected.isPending : query.isFetching;
  const error = selectedOnly ? selected.error : query.error;
  const choose = (index: number) => {
    const item = items[index];
    if (item) {
      onChange(item.id === value ? "" : item.id);
      setText("");
      setActive(-1);
    }
  };
  return (
    <div className="team-autocomplete">
      <Input
        role="combobox"
        aria-label={`Buscar opções de ${label}`}
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        aria-expanded={items.length > 0}
        aria-activedescendant={
          active >= 0 && items[active] ? `${id}-${active}` : undefined
        }
        aria-describedby={`${id}-status`}
        autoFocus={autoFocus}
        value={text}
        maxLength={200}
        placeholder="Digite o nome do time…"
        onChange={(e) => {
          setText(e.target.value);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((index) =>
              items.length
                ? index < 0
                  ? e.key === "ArrowDown"
                    ? 0
                    : items.length - 1
                  : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                    items.length
                : -1,
            );
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(active);
          }
        }}
      />
      <div id={`${id}-status`} role="status" className="small-note">
        {loading
          ? "Buscando times…"
          : error
            ? "Não foi possível buscar times."
            : !items.length
              ? "Nenhum time encontrado."
              : selectedOnly
                ? ""
                : !term
                  ? ""
                  : `${items.length} sugestões disponíveis.`}
      </div>
      {error && (
        <Button
          onClick={() =>
            void (selectedOnly ? selected.refetch() : query.refetch())
          }
        >
          Tentar novamente
        </Button>
      )}
      <ul id={`${id}-list`} role="listbox" aria-label="Sugestões de times">
        {items.map((item, index) => (
          <li
            key={item.id}
            id={`${id}-${index}`}
            role="option"
            aria-selected={item.id === value}
            data-active={index === active}
            onPointerMove={() => setActive(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{item.name}</span>
            {item.id === value && <Check aria-hidden="true" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
