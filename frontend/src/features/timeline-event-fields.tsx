import { formatNumber, useLocale, t as tr } from "@/i18n";

import { Markdown } from "@/components/markdown";
import { AgentName } from "@/components/names";

const labels: Record<string, string> = {
  get title() {
    return tr("execution.title");
  },
  get description() {
    return tr("common.description");
  },
  get specification() {
    return tr("tasks.specification");
  },
  get currentSummary() {
    return tr("execution.workSynthesis");
  },
  get previousCurrentSummary() {
    return tr("execution.previousSynthesis");
  },
  get progress() {
    return tr("tasks.progress");
  },
  get percent() {
    return tr("execution.percentage");
  },
  get note() {
    return tr("execution.note");
  },
  get executorAgentId() {
    return tr("boards.executor");
  },
  get previousExecutorAgentId() {
    return tr("execution.previousExecutor");
  },
  get authorAgentId() {
    return tr("tasks.author");
  },
  get statusId() {
    return tr("execution.recordedStatusId");
  },
  get previousStatusId() {
    return tr("execution.previousStatusId");
  },
  get beforeTaskId() {
    return tr("execution.nextTaskId");
  },
  get parentId() {
    return tr("execution.parentTaskId");
  },
  get linkedTaskId() {
    return tr("execution.linkedTaskId");
  },
  get previousParentId() {
    return tr("execution.previousParentTaskId");
  },
  get previousExecutionContext() {
    return tr("execution.previousExecutionContext");
  },
  get executionContext() {
    return tr("execution.executionContext");
  },
  get rootTaskId() {
    return tr("execution.rootTaskId");
  },
  get originBoardId() {
    return tr("execution.originBoardId");
  },
  get originBoardMode() {
    return tr("execution.originBoardMode");
  },
  get effectiveMode() {
    return tr("execution.effectiveMode");
  },
  get mode() {
    return tr("execution.coordinationMode");
  },
  get conversationRef() {
    return tr("execution.conversationReference");
  },
  get approvalRef() {
    return tr("execution.approvalReference");
  },
  get boardId() {
    return tr("execution.boardId");
  },
  get blocked() {
    return tr("boards.blocked2");
  },
  get reason() {
    return tr("execution.reason");
  },
  get block() {
    return tr("boards.block");
  },
  get previous() {
    return tr("execution.before");
  },
  get changes() {
    return tr("execution.after");
  },
  get archived() {
    return tr("tasks.archived");
  },
  get autonomyMode() {
    return tr("common.autonomy");
  },
  get coordinationContext() {
    return tr("execution.coordinationContext");
  },
  get commentId() {
    return tr("execution.commentId");
  },
  get planId() {
    return tr("execution.planId");
  },
  get revisionId() {
    return tr("execution.revisionId");
  },
  get revision() {
    return tr("tasks.revision");
  },
  get attachmentId() {
    return tr("execution.fileId");
  },
  get executionSummaryId() {
    return tr("execution.summaryId");
  },
  get workScope() {
    return tr("execution.workScope");
  },
  get projects() {
    return tr("tasks.projects");
  },
  get name() {
    return tr("agents.name");
  },
  get key() {
    return tr("execution.key");
  },
  get rootPath() {
    return tr("execution.localFolder");
  },
  get message() {
    return tr("execution.message");
  },
  get content() {
    return tr("execution.content");
  },
};
export function asFields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function fieldLabel(key: string) {
  return Object.hasOwn(labels, key)
    ? labels[key]
    : key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}
export function EventValue({
  value,
  field = "",
}: {
  value: unknown;
  field?: string;
}) {
  useLocale();
  if (value === undefined || value === null)
    return <span className="small-note">{tr("usage.notProvided2")}</span>;
  if (typeof value === "boolean")
    return <span>{value ? tr("execution.yes") : tr("execution.no")}</span>;
  if (typeof value === "number")
    return (
      <span>
        {formatNumber(value)}
        {field === "percent" ? "%" : ""}
      </span>
    );
  if (typeof value === "string") {
    if (!value)
      return <span className="small-note">{tr("execution.empty")}</span>;
    if (field.endsWith("AgentId"))
      return (
        <span title={value}>
          <AgentName id={value} />
        </span>
      );
    if (field.endsWith("Id") || field === "rootPath")
      return <span className="timeline-literal">{value}</span>;
    if (
      ["autonomyMode", "originBoardMode", "effectiveMode", "mode"].includes(
        field,
      )
    )
      return (
        <span>
          {value === "manual"
            ? tr("common.manual")
            : value === "automatic"
              ? field === "autonomyMode"
                ? tr("execution.automatic")
                : tr("common.automatic")
              : value === "standard"
                ? tr("common.standard")
                : value}
        </span>
      );
    return <Markdown headingOffset={2}>{value}</Markdown>;
  }
  if (Array.isArray(value))
    return value.length ? (
      <ul className="timeline-value-list">
        {value.map((item, index) => (
          <li key={index}>
            <EventValue value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="small-note">{tr("execution.noItems")}</span>
    );
  return <EventFields data={asFields(value)} />;
}
export function EventFields({ data }: { data: Record<string, unknown> }) {
  useLocale();
  return Object.keys(data).length ? (
    <dl className="timeline-event-fields">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{fieldLabel(key)}</dt>
          <dd>
            <EventValue field={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="small-note">{tr("execution.noAdditionalDetailsRecorded")}</p>
  );
}
export function ChangedFields({
  previous,
  changes,
}: {
  previous: unknown;
  changes: unknown;
}) {
  useLocale();
  const before = asFields(previous),
    after = asFields(changes);
  return Object.keys(after).length ? (
    <div className="timeline-changes">
      {Object.entries(after).map(([key, value]) => (
        <section
          className="task-reading-block"
          key={key}
          aria-label={fieldLabel(key)}
        >
          <h4>{fieldLabel(key)}</h4>
          <div className="timeline-change-values">
            <div>
              <h5>{tr("execution.before")}</h5>
              <EventValue field={key} value={before[key]} />
            </div>
            <div>
              <h5>{tr("execution.after")}</h5>
              <EventValue field={key} value={value} />
            </div>
          </div>
        </section>
      ))}
    </div>
  ) : (
    <p className="small-note">
      {tr("execution.changedFieldsWereNotRecordedInThisEvent")}
    </p>
  );
}
