import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Plus } from "lucide-react";
import { useApi, useList } from "@/api/context";
import type { Board, Status } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { QueryState, Failure } from "@/components/shared";
export function StatusSettings({ board }: { board: Board }) {
  const api = useApi(),
    client = useQueryClient();
  const q = useList("statuses", board.id, { limit: 100, sortBy: "position" });
  const [name, setName] = useState(""),
    [done, setDone] = useState(false);
  const create = useMutation({
    mutationFn: () => api.createStatus(board.id, { name, isDone: done }),
    onSuccess: () => {
      setName("");
      setDone(false);
      return client.invalidateQueries();
    },
  });
  const order = useMutation({
    mutationFn: (ids: string[]) =>
      api.reorderStatuses(board.id, ids, board.version),
    onSuccess: () => client.invalidateQueries(),
  });
  function move(index: number, direction: number) {
    const ids = q.data!.items.map((s) => s.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    order.mutate(ids);
  }
  return (
    <section className="detail-section">
      <h3>Status do board</h3>
      <p className="small-note">
        A ordem é configurável. Alterar conclusão ou arquivar status em uso é
        protegido; renomear preserva referências.
      </p>
      <QueryState query={q}>
        {q.data &&
          q.data.items.map((s, i) => (
            <div className="status-config" key={`${s.id}:${s.version}`}>
              <StatusForm status={s} disabled={!!board.archivedAt} />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Mover ${s.name} para cima`}
                  disabled={i === 0 || order.isPending || !!board.archivedAt}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Mover ${s.name} para baixo`}
                  disabled={
                    i === q.data!.items.length - 1 ||
                    order.isPending ||
                    !!board.archivedAt
                  }
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown />
                </Button>
              </div>
            </div>
          ))}
      </QueryState>
      {order.error && <Failure error={order.error} />}
      <form
        className="record"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-status">Novo status</FieldLabel>
            <Input
              id="new-status"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!board.archivedAt}
            />
          </Field>
          <Field orientation="horizontal">
            <Switch
              id="new-status-done"
              checked={done}
              onCheckedChange={setDone}
              disabled={!!board.archivedAt}
            />
            <FieldLabel htmlFor="new-status-done">
              Representa conclusão
            </FieldLabel>
          </Field>
        </FieldGroup>
        <Button
          type="submit"
          variant="outline"
          disabled={create.isPending || !!board.archivedAt}
        >
          <Plus data-icon="inline-start" />
          Adicionar status
        </Button>
        {create.error && <Failure error={create.error} />}
      </form>
    </section>
  );
}
function StatusForm({
  status,
  disabled,
}: {
  status: Status;
  disabled: boolean;
}) {
  const [name, setName] = useState(status.name),
    [done, setDone] = useState(status.isDone);
  const api = useApi(),
    client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.patch("statuses", status.id, { name, isDone: done }, status.version),
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="status-form"
    >
      <Field>
        <FieldLabel htmlFor={status.id}>
          Status {status.position + 1}
        </FieldLabel>
        <Input
          id={status.id}
          value={name}
          required
          maxLength={200}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="outline"
        disabled={mutation.isPending || disabled}
      >
        Salvar
      </Button>
      <Field orientation="horizontal">
        <Switch
          id={`done-${status.id}`}
          checked={done}
          onCheckedChange={setDone}
          disabled={disabled}
        />
        <FieldLabel htmlFor={`done-${status.id}`}>Conclusão</FieldLabel>
      </Field>
      {mutation.error && <Failure error={mutation.error} />}
    </form>
  );
}
