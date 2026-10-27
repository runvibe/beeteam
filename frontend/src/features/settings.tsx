import { StatusSettings } from "./status-settings";
import { useState } from "react";
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
            Metadados, autonomia e status. Alterações ficam somente no mock
            desta sessão.
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
  const [name, setName] = useState(board.name),
    [description, setDescription] = useState(board.description),
    [mode, setMode] = useState(board.autonomyMode);
  const [baseline, setBaseline] = useState(board);
  // Status writes change the board version without editing these fields.
  // Preserve drafts, but retain the old version if metadata changed elsewhere.
  const expectedVersion =
    board.name === baseline.name &&
    board.description === baseline.description &&
    board.autonomyMode === baseline.autonomyMode
      ? board.version
      : baseline.version;
  const mutation = useMutation({
    mutationFn: () =>
      api.patch(
        "boards",
        board.id,
        { name, description, autonomyMode: mode },
        expectedVersion,
      ),
    onSuccess: (saved) => {
      setBaseline(saved);
      return client.invalidateQueries();
    },
  });
  return (
    <form
      className="detail-section"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="board-name">Nome</FieldLabel>
          <Input
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            onChange={(e) => setDescription(e.target.value)}
            disabled={!!board.archivedAt}
          />
        </Field>
        <Choice
          label="Autonomia do board de origem"
          value={mode}
          onChange={(v) => setMode(v as Board["autonomyMode"])}
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
      <Button type="submit" disabled={mutation.isPending || !!board.archivedAt}>
        {mutation.isPending ? "Salvando…" : "Salvar board"}
      </Button>
      <SaveFeedback mutation={mutation} />
      {mutation.error && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setName(board.name);
            setDescription(board.description);
            setMode(board.autonomyMode);
            setBaseline(board);
            mutation.reset();
          }}
        >
          Recarregar formulário
        </Button>
      )}
    </form>
  );
}
export function TaskMode({ task }: { task: Task }) {
  const api = useApi(),
    client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (mode: Task["autonomyMode"]) =>
      api.patch("tasks", task.id, { autonomyMode: mode }, task.version),
    onSuccess: () => client.invalidateQueries(),
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
        value={task.autonomyMode}
        onChange={(v) =>
          !task.archivedAt &&
          !mutation.isPending &&
          mutation.mutate(v as Task["autonomyMode"])
        }
        options={[
          { value: "manual", label: "Manual" },
          { value: "automatic", label: "Automático" },
        ]}
      />
      {task.archivedAt && (
        <p className="small-note">Task arquivada: somente leitura.</p>
      )}
      <SaveFeedback mutation={mutation} />
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
          Salvo nesta sessão de demonstração.
        </p>
      )}
    </>
  );
}
