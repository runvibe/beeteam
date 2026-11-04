import {
  formatNumber,
  LocalizedError,
  message,
  useLocale,
  t as tr,
} from "@/i18n";

import { StatusCreateForm } from "./status-create-form";
import {
  useSettingsAutosave,
  AutosaveFeedback,
} from "@/components/settings-autosave";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useApi, useList } from "@/api/context";
import type { Board, Status } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { QueryState, Failure } from "@/components/shared";
export function StatusSettings({ board }: { board: Board }) {
  useLocale();
  const api = useApi(),
    client = useQueryClient();
  const q = useList("statuses", board.id, { limit: 100, sortBy: "position" });
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
      <h3>{tr("boards.boardStatuses")}</h3>
      <p className="small-note">
        {tr("boards.orderIsConfigurableChangingCompletionOrArchivingAStatusIn")}
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
                  aria-label={tr("boards.moveStatusUp", { name: s.name })}
                  disabled={i === 0 || order.isPending || !!board.archivedAt}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tr("boards.moveStatusDown", { name: s.name })}
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
      <StatusCreateForm key={board.id} board={board} />
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
  useLocale();
  const api = useApi();
  const autosave = useSettingsAutosave({
    resource: "statuses",
    load: async () => {
      const page = await api.list("statuses", latest.boardId, { limit: 100 });
      const fresh = page.items.find((item) => item.id === latest.id);
      if (!fresh) throw new LocalizedError(message("boards.statusUnavailable"));
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
          {tr("boards.status")} {formatNumber(status.position + 1)}
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
          aria-describedby={`done-help-${status.id}`}
          checked={done}
          onCheckedChange={(value) => autosave.change("isDone", value, true)}
          disabled={disabled}
        />
        <FieldLabel htmlFor={`done-${status.id}`}>
          {tr("boards.countsAsCompleted")}
        </FieldLabel>
      </Field>
      <FieldDescription id={`done-help-${status.id}`}>
        {tr("boards.tasksInThisStatusAreConsideredCompleted")}
      </FieldDescription>
      {latest.version > autosave.version && (
        <p role="status" className="small-note">
          {tr("agents.thisRecordWasUpdatedInAnotherSessionYourDraftWas")}
        </p>
      )}
      <AutosaveFeedback state={autosave} />
    </form>
  );
}
