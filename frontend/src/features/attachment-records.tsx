import { useId, useState, type ReactNode } from "react";
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
              key={mediaType}
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
  value,
  onApply,
}: {
  value: string;
  onApply: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}
    >
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
      <Button type="submit" variant="outline">
        Aplicar tipo
      </Button>
    </form>
  );
}
