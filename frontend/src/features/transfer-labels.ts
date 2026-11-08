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
  leader_session_operations: "transfer.stage.leader_session_operations",
  leader_chats: "transfer.stage.leader_chats",
  leader_chat_turns: "transfer.stage.leader_chat_turns",
  leader_chat_messages: "transfer.stage.leader_chat_messages",
  leader_chat_approvals: "transfer.stage.leader_chat_approvals",
  leader_chat_events: "transfer.stage.leader_chat_events",
  leader_chat_tools: "transfer.stage.leader_chat_tools",
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
  agent_session_bindings: "transfer.stage.agent_session_bindings",
  session_deliveries: "transfer.stage.session_deliveries",
  task_executions: "transfer.stage.task_executions",
  task_execution_intervals: "transfer.stage.task_execution_intervals",
  task_execution_interval_counters:
    "transfer.stage.task_execution_interval_counters",
  task_execution_tracking_events:
    "transfer.stage.task_execution_tracking_events",
  task_execution_interval_revisions:
    "transfer.stage.task_execution_interval_revisions",
  images: "transfer.stage.images",
  memberships: "transfer.stage.memberships",
  board_events: "transfer.stage.board_events",
  file_contents: "transfer.stage.file_contents",
  request_replays: "transfer.stage.request_replays",
  archive_ready: "transfer.stage.archive_ready",
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
