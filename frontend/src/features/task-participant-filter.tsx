import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { ApiError, type TaskParticipant } from "@/api/types";
import { FilterPopover, FilterOptions } from "@/components/filter-controls";
import { Input } from "@/components/ui/input";
import { Failure } from "@/components/shared";
import { LoadingIndicator } from "@/components/loading-indicator";

export function TaskParticipantFilter({
  taskId,
  actorId,
  actorKind,
  onChange,
}: {
  taskId: string;
  actorId: string;
  actorKind: string;
  onChange: (id: string, kind: "" | "human" | "agent") => void;
}) {
  const api = useApi();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["task-participants", taskId],
    queryFn: async ({ signal }) => {
      const all = new Map<string, TaskParticipant>();
      let offset = 0;
      while (true) {
        const page = await api.participants(
          taskId,
          { offset, limit: 100 },
          signal,
        );
        for (const item of page.items)
          all.set(`${item.actorKind}:${item.actorId}`, item);
        if (!page.hasMore) return [...all.values()];
        if (
          page.nextOffset === null ||
          page.nextOffset <= offset ||
          !page.items.length
        )
          throw new ApiError(
            502,
            "invalid_pagination",
            "A lista de participantes retornou uma paginação inválida.",
          );
        offset = page.nextOffset;
      }
    },
  });
  const options = (query.data ?? [])
    .filter((item) => !actorKind || item.actorKind === actorKind)
    .map((item) => ({
      value: item.actorKind === "human" ? "human" : item.actorId!,
      label:
        item.actorKind === "human"
          ? "Pessoas (sem identificação individual)"
          : `${item.agentName || `Agente ${item.actorId}`} ${item.agentDeleted ? "(excluído)" : item.agentArchived ? "(arquivado)" : ""}`.trim(),
    }));
  const value = actorKind === "human" ? "human" : actorId;
  const selected = options.find((item) => item.value === value)?.label;
  const visible = options.filter((item) =>
    item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <FilterPopover
      label="Autor da fala"
      active={!!value}
      summary={selected || (value ? "Participante selecionado" : "Todos")}
      onClear={() =>
        onChange("", actorKind === "human" ? "" : (actorKind as "" | "agent"))
      }
    >
      <Input
        aria-label="Buscar participantes desta tarefa"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Filtrar participantes…"
      />
      {query.isPending && <LoadingIndicator label="Carregando participantes" />}
      {query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <FilterOptions
            label="Autor da fala"
            value={value}
            all="Todos"
            options={visible}
            onChange={(id) =>
              onChange(
                id === "human" ? "" : id,
                id === "human"
                  ? "human"
                  : id
                    ? "agent"
                    : actorKind === "human"
                      ? ""
                      : (actorKind as "" | "agent"),
              )
            }
          />
          {!query.isPending && !visible.length && (
            <p className="small-note">
              Nenhum participante corresponde à busca.
            </p>
          )}
        </>
      )}
    </FilterPopover>
  );
}
