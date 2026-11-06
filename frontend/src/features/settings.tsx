import { SlidersHorizontal } from "lucide-react";
import { useLocale, t as tr } from "@/i18n";

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
import { Choice, Failure, modeLabels } from "@/components/shared";
import { AgentName } from "@/components/names";
export function BoardSettings({
  board,
  open,
  onOpenChange,
}: {
  board: Board;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="detail-dialog"
        onEscapeKeyDown={(event) => {
          // Let the inline creation form consume Escape before dismissing settings.
          if (
            event.target instanceof Element &&
            event.target.closest(".status-create-form")
          )
            event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{tr("boards.boardSettings")}</DialogTitle>
          <DialogDescription>
            {tr("common.boardMetadataAutonomyAndStatuses")}
          </DialogDescription>
        </DialogHeader>
        <BoardForm key={board.id} board={board} />
        <StatusSettings board={board} />
      </DialogContent>
    </Dialog>
  );
}
function BoardForm({ board }: { board: Board }) {
  useLocale();
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
          <FieldLabel htmlFor="board-name">{tr("agents.name")}</FieldLabel>
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
          <FieldLabel htmlFor="board-description">
            {tr("common.description")}
          </FieldLabel>
          <Textarea
            id="board-description"
            value={description}
            onChange={(e) => autosave.change("description", e.target.value)}
            disabled={!!board.archivedAt}
          />
        </Field>
        <Choice
          label={tr("common.originBoardAutonomy")}
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
          {tr(
            "common.manualRequiresApprovalThroughoutTheChainStandardRespectsEachTask",
          )}
        </FieldDescription>
      </FieldGroup>
      <div className="small-note">
        {tr("common.originalCreator")}{" "}
        <AgentName id={board.createdBy.actorId} />
      </div>
      <AutosaveFeedback state={autosave} />
      {autosave.error && (
        <Button
          type="button"
          variant="outline"
          disabled={reload.isPending}
          onClick={() => reload.mutate()}
        >
          {tr("common.reloadForm")}
        </Button>
      )}
      {reload.error && <Failure error={reload.error} />}
    </form>
  );
}
export function TaskMode({ task }: { task: Task }) {
  useLocale();
  const api = useApi();
  const autosave = useSettingsAutosave({
    resource: "tasks",
    latest: task,
    values: (value: Task) => ({ autonomyMode: value.autonomyMode }),
    save: (draft, version) => api.patch("tasks", task.id, draft, version),
  });
  return (
    <section className="task-autonomy">
      <h2><SlidersHorizontal className="task-reference-icon" aria-hidden="true" />{tr("common.autonomy")}</h2>
      <p className="task-effective-mode">
        {tr("common.effectiveMode")}{" "}
        <strong>
          {task.executionContext.effectiveMode === "automatic"
            ? tr("common.automatic")
            : tr("common.manual")}
        </strong>
      </p>
      <details className="task-autonomy-explanation">
        <summary>{tr("common.howAutonomyIsDetermined")}</summary>
        <p>
          {tr("common.originMode")}{" "}
          {modeLabels[task.executionContext.originBoardMode]}
        </p>
        <p>
          {tr("common.inStandardModeThisTaskSSettingAppliesIndividuallyThe")}
        </p>
      </details>
      {task.archivedAt ? (
        <p>
          {tr("common.individualSetting")} {modeLabels[task.autonomyMode]}
        </p>
      ) : (
        <Choice
          label={tr("common.individualSetting2")}
          value={autosave.draft.autonomyMode}
          onChange={(v) =>
            !task.archivedAt &&
            autosave.change("autonomyMode", v as Task["autonomyMode"], true)
          }
          options={[
            { value: "manual", label: tr("common.manual") },
            { value: "automatic", label: tr("common.automatic") },
          ]}
        />
      )}
      {task.archivedAt && (
        <p className="small-note">{tr("common.archivedTaskReadOnly")}</p>
      )}
      <AutosaveFeedback state={autosave} />
    </section>
  );
}
