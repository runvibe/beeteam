import { t as tr } from "@/i18n";
import type { Resources } from "@/api/types";
export const eventLabels: Record<string, string> = {
  get "task.created"() {
    return tr("execution.taskCreated");
  },
  get "task.updated"() {
    return tr("execution.taskUpdated");
  },
  get "assignment.changed"() {
    return tr("execution.executorChanged");
  },
  get "position.changed"() {
    return tr("common.positionChanged");
  },
  get "block.changed"() {
    return tr("common.blockUpdated");
  },
  get "plan.created"() {
    return tr("common.planRecorded");
  },
  get "plan.revised"() {
    return tr("common.planRevised");
  },
  get "comment.created"() {
    return tr("common.commentRecorded");
  },
  get "attachment.added"() {
    return tr("common.fileAttached");
  },
  get "attachment.removed"() {
    return tr("common.fileSoftDeleted");
  },
  get "execution.recorded"() {
    return tr("execution.executionSummaryRecorded");
  },
  get "task.archived"() {
    return tr("execution.taskArchived");
  },
  get "task.restored"() {
    return tr("execution.taskRestored");
  },
  get "subtask.created"() {
    return tr("execution.subtaskCreated");
  },
};
export function eventTitle(row: Resources["timeline"]) {
  return `${eventLabels[row.type] ?? row.type} · ${row.sequence}`;
}
