import {
  useSettingsAutosave,
  AutosaveFeedback,
} from "@/components/settings-autosave";
import { useState, useRef } from "react";
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
  const intent = useRef<{ body: string; key: string } | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ name, isDone: done });
      if (intent.current?.body !== body)
        intent.current = { body, key: crypto.randomUUID() };
      return api.createStatus(
        board.id,
        { name, isDone: done },
        intent.current.key,
      );
    },
    onSuccess: () => {
      intent.current = null;
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
            <div className="status-config" key={s.id}>
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
  status: latest,
  disabled,
}: {
  status: Status;
  disabled: boolean;
}) {
  const api = useApi();
  const autosave = useSettingsAutosave({
    resource: "statuses",
    load: async () => {
      const page = await api.list("statuses", latest.boardId, { limit: 100 });
      const fresh = page.items.find((item) => item.id === latest.id);
      if (!fresh) throw new Error("Status indisponível.");
      return { ...fresh, archivedAt: disabled ? "disabled" : null };
    },
    latest: { ...latest, archivedAt: disabled ? "disabled" : null },
    values: (status: Status) => ({ name: status.name, isDone: status.isDone }),
    save: (draft, version) =>
      api.patch("statuses", latest.id, draft, version, latest.boardId),
  });
  const { name, isDone: done } = autosave.draft;
  const status = latest;
  return (
    <form {...autosave.formProps} className="status-form">
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
          onChange={(e) => autosave.change("name", e.target.value)}
        />
      </Field>
      <Field orientation="horizontal">
        <Switch
          id={`done-${status.id}`}
          checked={done}
          onCheckedChange={(value) => autosave.change("isDone", value, true)}
          disabled={disabled}
        />
        <FieldLabel htmlFor={`done-${status.id}`}>Conclusão</FieldLabel>
      </Field>
      {latest.version > autosave.version && (
        <p role="status" className="small-note">
          Este registro foi atualizado em outra sessão. Seu rascunho foi
          preservado. Use Recarregar formulário após o conflito para descartar o
          rascunho e carregar a versão atual.
        </p>
      )}
      <AutosaveFeedback state={autosave} />
    </form>
  );
}
