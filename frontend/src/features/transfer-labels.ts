import { transferErrorMessage } from "@/i18n/transfer-errors";
import { t } from "@/i18n";
const states: Record<string, string> = {
  queued: "transfer.state.queued",
  running: "transfer.state.running",
  restoring: "transfer.state.restoring",
  ready: "transfer.state.ready",
  completed: "transfer.state.completed",
  failed: "transfer.state.failed",
  cancelled: "transfer.state.cancelled",
  expired: "transfer.state.expired",
};
const stages: Record<string, string> = {
  validating: "transfer.stage.validating",
  snapshot: "transfer.stage.snapshot",
  upload: "transfer.stage.upload",
  restore: "transfer.stage.restore",
  validated: "transfer.stage.validated",
  packing: "transfer.stage.packing",
  agents: "transfer.stage.agents",
  teams: "transfer.stage.teams",
  boards: "transfer.stage.boards",
  tasks: "transfer.stage.tasks",
  statuses: "transfer.stage.statuses",
  comments: "transfer.stage.comments",
  plans: "transfer.stage.plans",
  plan_revisions: "transfer.stage.plan_revisions",
  events: "transfer.stage.events",
  attachments: "transfer.stage.attachments",
  execution_summaries: "transfer.stage.execution_summaries",
  chat_references: "transfer.stage.chat_references",
  execution_intervals: "transfer.stage.execution_intervals",
};
const busy: Record<string, string> = {
  preparing: "transfer.preparingArchive",
  uploading: "transfer.uploadingArchive",
  exporting: "transfer.startingExport",
  cancelling: "transfer.cancelling",
  restoring: "transfer.restoring",
};
export const transferState = (value: string) =>
  states[value] ? t(states[value]) : value;
export const transferStage = (value: string) =>
  stages[value] ? t(stages[value]) : transferState(value);
export const transferBusy = (value: string) =>
  busy[value] ? t(busy[value]) : value;

export function transferErrorText(value: string) {
  const result = transferErrorMessage(value);
  return typeof result === "string" ? result : t(result.key, result.options);
}
