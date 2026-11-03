import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import { categories } from "./attachment-item";
import { attachmentCategory } from "./attachment-presentation";
import type { Resources } from "@/api/types";
import { useUrlState, booleanValues } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-controls";
import { Choice, Search } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { TaskFilters } from "./task-filter-layout";
import { TaskRecordList } from "./task-record-list";

export function AttachmentRecords({
  taskId,
  children,
}: {
  taskId: string;
  children: (row: Resources["attachments"]) => ReactNode;
}) {
  const [fileName, setName] = useUrlState<string>("attachments.fileName", "");
  const [mediaType, setType] = useUrlState<string>("attachments.mediaType", "");
  const [includeRemoved, setRemoved] = useUrlState<string>(
    "attachments.includeRemoved",
    "false",
    { values: booleanValues },
  );
  const active = !!fileName || !!mediaType || includeRemoved === "true";
  return (
    <div className="detail-section">
      <TaskFilters active={active}>
        <FilterBar
          active={active}
          onClear={() => {
            setName("");
            setType("");
            setRemoved("false");
          }}
          search={
            <Search
              label="Nome do arquivo"
              value={fileName}
              onChange={setName}
            />
          }
        >
          <FilterPopover
            label="Tipo de arquivo"
            summary={mediaType || "Todos os tipos"}
            active={!!mediaType}
            onClear={() => setType("")}
          >
            <MediaTypeInput
              taskId={taskId}
              includeRemoved={includeRemoved === "true"}
              value={mediaType}
              onApply={setType}
            />
          </FilterPopover>
          <Choice
            label="Arquivos removidos"
            value={includeRemoved}
            onChange={setRemoved}
            options={[
              { value: "false", label: "Somente disponíveis" },
              { value: "true", label: "Incluir removidos" },
            ]}
          />
        </FilterBar>
      </TaskFilters>
      <TaskRecordList
        resource="attachments"
        scope={taskId}
        filters={{
          limit: 10,
          fileName: fileName || undefined,
          mediaType: mediaType || undefined,
          includeRemoved: includeRemoved === "true",
        }}
        empty="Nenhum arquivo encontrado"
        emptyDescription="Ajuste os filtros ou aguarde o registro de arquivos nesta tarefa."
      >
        {children}
      </TaskRecordList>
    </div>
  );
}
function MediaTypeInput({
  taskId,
  includeRemoved,
  value,
  onApply,
}: {
  taskId: string;
  includeRemoved: boolean;
  value: string;
  onApply: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const api = useApi();
  const types = useQuery({
    queryKey: ["attachments", taskId, "mime-choices", includeRemoved],
    queryFn: async ({ signal }) => {
      const pages = [];
      const found = new Map<string, string>();
      let offset: number | undefined = 0;
      while (offset !== undefined) {
        const page = await api.list("attachments", taskId, { offset, limit: 100, includeRemoved }, signal);
        pages.push(page);
        for (const row of page.items) found.set(row.mediaType, row.originalName);
        offset = nextPageOffset(page, pages, row => row.id);
      }
      return [...found].sort(([a], [b]) => a.localeCompare(b));
    },
  });
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const next = draft.trim();
    if (next === value || (next && !/^[^\s/;]+\/[^\s/;]+$/.test(next))) return;
    const timer = setTimeout(() => onApply(next), 300);
    return () => clearTimeout(timer);
  }, [draft, value, onApply]);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}
    >
      {!!types.data?.length && <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos presentes nos arquivos">
        {types.data.map(([mime, name]) => {
          const Icon = categories[attachmentCategory(mime, name)].icon;
          return <Button key={mime} type="button" size="sm" variant={value === mime ? "secondary" : "outline"}
            aria-label={`Filtrar ${mime}`} title={mime} aria-pressed={value === mime}
            onClick={() => { setDraft(mime); onApply(mime); }}><Icon aria-hidden="true" /><span>{name.includes(".") ? name.split(".").at(-1)!.toUpperCase() : mime.split("/").at(-1)}</span></Button>;
        })}
      </div>}
      {types.isPending && <span role="status">Carregando tipos…</span>}
      {types.isError && <span role="status">Não foi possível carregar os tipos. Digite o MIME abaixo.</span>}
      <Field>
        <FieldLabel htmlFor={id}>Tipo MIME exato</FieldLabel>
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={200}
          pattern={String.raw`[^\s\/;]+/[^\s\/;]+`}
          placeholder="application/pdf"
        />
        <FieldDescription>
          Use o tipo completo, por exemplo application/pdf ou image/png.
        </FieldDescription>
      </Field>
    </form>
  );
}
