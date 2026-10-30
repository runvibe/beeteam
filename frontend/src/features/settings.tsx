import { StatusSettings } from "./status-settings";
import {
  useSettingsAutosave,
  AutosaveFeedback,
} from "@/components/settings-autosave";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Board, Task } from "@/api/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Choice, Failure, modeLabels } from "@/components/shared";
import { AgentName, BoardName } from "@/components/names";
export function BoardSettings({
  board,
  open,
  onOpenChange,
}: {
  board: Board;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="detail-dialog">
        <DialogHeader>
          <DialogTitle>Configurações do board</DialogTitle>
          <DialogDescription>
            Metadados, autonomia e status do board.
          </DialogDescription>
        </DialogHeader>
        <BoardForm key={board.id} board={board} />
        <StatusSettings board={board} />
      </DialogContent>
    </Dialog>
  );
}
function BoardForm({ board }: { board: Board }) {
  const api = useApi(),
    client = useQueryClient();
  const autosave = useSettingsAutosave({
    resource: "boards",
    latest: board,
    values: (value: Board) => ({
      name: value.name,
      description: value.description,
      autonomyMode: value.autonomyMode,
    }),
    save: (draft, version) => api.patch("boards", board.id, draft, version),
  });
  const { name, description, autonomyMode: mode } = autosave.draft;
  const reload = useMutation({
    mutationFn: () => api.get("boards", board.id),
    onSuccess: (fresh) => {
      client.setQueryData(["boards", board.id], fresh);
      autosave.reset(fresh);
    },
  });
  return (
    <form className="detail-section" {...autosave.formProps}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="board-name">Nome</FieldLabel>
          <Input
            id="board-name"
            value={name}
            onChange={(e) => autosave.change("name", e.target.value)}
            required
            maxLength={200}
            disabled={!!board.archivedAt}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="board-description">Descrição</FieldLabel>
          <Textarea
            id="board-description"
            value={description}
            onChange={(e) => autosave.change("description", e.target.value)}
            disabled={!!board.archivedAt}
          />
        </Field>
        <Choice
          label="Autonomia do board de origem"
          value={mode}
          onChange={(v) =>
            autosave.change("autonomyMode", v as Board["autonomyMode"], true)
          }
          options={Object.entries(modeLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <FieldDescription>
          Manual exige aprovação em toda a cadeia. Padrão respeita a flag de
          cada task. Automático cobre toda a cadeia, inclusive subtasks em
          outros boards.
        </FieldDescription>
      </FieldGroup>
      <div className="small-note">
        Criador preservado: <AgentName id={board.createdBy.actorId} />
      </div>
      <AutosaveFeedback state={autosave} />
      {autosave.error && (
        <Button
          type="button"
          variant="outline"
          disabled={reload.isPending}
          onClick={() => reload.mutate()}
        >
          Recarregar formulário
        </Button>
      )}
      {reload.error && <Failure error={reload.error} />}
    </form>
  );
}
export function TaskMode({ task }: { task: Task }) {
  const api = useApi();
  const autosave = useSettingsAutosave({
    resource: "tasks",
    latest: task,
    values: (value: Task) => ({ autonomyMode: value.autonomyMode }),
    save: (draft, version) => api.patch("tasks", task.id, draft, version),
  });
  return (
    <section className="record">
      <h3>Autonomia</h3>
      <p className="muted-copy">
        Origem da cadeia: <BoardName id={task.executionContext.originBoardId} />
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          Origem: {modeLabels[task.executionContext.originBoardMode]}
        </Badge>
        <Badge variant="secondary">
          Efetivo:{" "}
          {task.executionContext.effectiveMode === "automatic"
            ? "Automático"
            : "Manual"}
        </Badge>
      </div>
      <FieldDescription>
        Em modo padrão, a flag desta task vale individualmente. A flag do pai e
        o board de destino não substituem a origem.
      </FieldDescription>
      <Choice
        label="Configuração individual"
        value={autosave.draft.autonomyMode}
        onChange={(v) =>
          !task.archivedAt &&
          autosave.change("autonomyMode", v as Task["autonomyMode"], true)
        }
        options={[
          { value: "manual", label: "Manual" },
          { value: "automatic", label: "Automático" },
        ]}
      />
      {task.archivedAt && (
        <p className="small-note">Task arquivada: somente leitura.</p>
      )}
      <AutosaveFeedback state={autosave} />
    </section>
  );
}
export function SaveFeedback({
  mutation,
}: {
  mutation: { error: unknown; isSuccess: boolean };
}) {
  return (
    <>
      {mutation.error && <Failure error={mutation.error} />}{" "}
      {mutation.isSuccess && (
        <p role="status" className="small-note">
          Alterações salvas.
        </p>
      )}
    </>
  );
}
