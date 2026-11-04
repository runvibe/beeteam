import { DetailShell } from "@/components/detail-layout/detail-shell";
import { DetailHeader } from "@/components/detail-layout/detail-header";
import { TaskInfoButton, useTaskContextView } from "./task-context-view";
import { useLocale, t as tr } from "@/i18n";

import { TimelineEventCard } from "./timeline-event-card";
import { TaskSpecification } from "./task-specification";
import { SummaryCommits } from "./summary-commits";
import { Attachment } from "./attachment-item";
import { AttachmentRecords } from "./attachment-records";
import { SummaryBrowser } from "./summary-index";
import { SubtaskCharts, ProgressHistory } from "./task-overview-charts";
import { ChildRow } from "./subtask-row";
import { SubtaskFilterChoices } from "./subtask-filter-choices";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TaskExecutionTimeline } from "./task-execution-tracking";
import { SummaryUsage } from "./summary-usage";
import { useQuery } from "@tanstack/react-query";
import { TaskDescription, TaskCurrentSummary } from "./task-header-content";
import { openOverviewChildren, TaskOverviewPanel } from "./task-overview-panel";
import { TaskRecordList } from "./task-record-list";
import { TaskConversation } from "./task-conversation";
import { useUrlState, usePageSize, booleanValues } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { usePageEntrance } from "@/components/motion-settings";
import { Plans } from "./plans";
import { Markdown } from "@/components/markdown";
import { Ban, ExternalLink } from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import type { Resources, Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Choice,
  QueryState,
  Failure,
  formatDate,
  safeUrl,
} from "@/components/shared";
import { AgentName } from "@/components/names";
import { TaskContext, TaskSections } from "./task-detail-layout";
import "./task-detail.css";
import { useTaskHeaderVisibility } from "./task-scroll-header";
import { TaskProgress } from "./task-progress";
import { TaskFilterProvider, TaskFilters } from "./task-filter-layout";
export function TaskPage() {
  useLocale();
  const id = useUi((s) => s.taskId);
  return id ? (
    <section className="task-page detail-page" aria-label={tr("tasks.task")}>
      <TaskDetail key={id} id={id} />
    </section>
  ) : null;
}
function TaskDetail({ id }: { id: string }) {
  const contextView = useTaskContextView();
  useLocale();
  const q = useEntity("tasks", id);
  const api = useApi();
  const overview = useQuery({
    queryKey: ["task-overview", id, q.data?.version],
    queryFn: ({ signal }) => api.overview(id, signal),
    enabled: !!q.data,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const planRevealConsumed = useRef(false);
  const reading = useRef<HTMLDivElement>(null);
  const [conversationPlaceholderHeight, setConversationPlaceholderHeight] =
    useState(0);
  const conversationReady = useCallback(
    () => setConversationPlaceholderHeight(0),
    [],
  );
  const { primary, hero, pastHeader } = useTaskHeaderVisibility();
  const [tab, setTab] = useUrlState<string>("tab", "overview", {
    values: [
      "overview",
      "specification",
      "children",
      "plans",
      "comments",
      "attachments",
      "summaries",
      "timeline",
    ],
  });
  const panelAnimation = usePageEntrance(tab);
  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  return (
    <DetailShell
      primaryRef={primary}
      heroRef={hero}
      primaryHidden={contextView && !!q.data}
      primaryClassName="task-detail-primary"
      heroClassName="task-detail-hero"
      overlays={q.data && <TaskInfoButton />}
      context={
        q.data && (
          <TaskContext
            task={q.data}
            compactHeader={pastHeader}
            overview={overview.data}
          />
        )
      }
      hero={
        <>
          <DetailHeader
            className="task-detail-heading"
            titleRef={heading}
            title={q.data?.title ?? tr("tasks.taskDetails2")}
          />
          {q.data && <TaskDescription task={q.data} />}
          {q.data && (
            <>
              <div
                className="task-detail-state"
                aria-label={tr("tasks.taskState")}
              >
                <TaskProgress percent={q.data.progress?.percent} />
                {q.data.archivedAt && (
                  <Badge variant="secondary">
                    {tr("tasks.archivedReadOnly")}
                  </Badge>
                )}
              </div>
              {q.data.block.blocked && (
                <Alert variant="destructive" className="task-blocked-alert">
                  <Ban className="size-9" aria-hidden="true" />
                  <div className="task-blocked-message">
                    <AlertTitle>{tr("tasks.taskBlocked")}</AlertTitle>
                    <AlertDescription>
                      <Markdown headingOffset={2}>
                        {q.data.block.reason}
                      </Markdown>
                    </AlertDescription>
                  </div>
                </Alert>
              )}
              <TaskCurrentSummary
                task={q.data}
                overview={overview.data}
                relativeDate
              />
            </>
          )}
        </>
      }
    >
      <QueryState query={q}>
        {q.data && (
          <>
            <TaskFilterProvider>
              <Tabs
                value={tab}
                activationMode="manual"
                onValueChange={(value) => {
                  // Keep the outgoing height while comments resolve, so the shared
                  // scroller cannot clamp to the much shorter loading placeholder.
                  setConversationPlaceholderHeight(
                    value === "comments"
                      ? (reading.current?.getBoundingClientRect().height ?? 0)
                      : 0,
                  );
                  setTab(value);
                }}
                className="task-detail-tabs"
              >
                <TaskSections value={tab} />
                <motion.div
                  className="task-detail-reading"
                  ref={reading}
                  style={{
                    minHeight:
                      tab === "comments"
                        ? conversationPlaceholderHeight
                        : undefined,
                  }}
                  animate={panelAnimation}
                  data-task-section={tab}
                >
                  <TabsContent value="overview">
                    <TaskOverviewPanel task={q.data} onTab={setTab} />
                  </TabsContent>
                  <TabsContent value="specification">
                    <TaskSpecification
                      taskId={q.data.id}
                      specification={q.data.specification}
                      scope={q.data.workScope}
                    />
                  </TabsContent>
                  <TabsContent value="children">
                    <Children task={q.data} />
                  </TabsContent>
                  <TabsContent value="plans">
                    <Plans task={q.data} revealConsumed={planRevealConsumed} />
                  </TabsContent>
                  <TabsContent value="comments">
                    <TaskConversation
                      taskId={q.data.id}
                      onReady={conversationReady}
                    />
                  </TabsContent>
                  <TabsContent value="attachments">
                    <AttachmentRecords taskId={q.data.id}>
                      {(item) => <Attachment item={item} />}
                    </AttachmentRecords>
                  </TabsContent>
                  <TabsContent value="summaries">
                    {overview.data && (
                      <ProgressHistory
                        taskId={q.data.id}
                        data={overview.data.progressHistory}
                        mode="chart"
                      />
                    )}
                    <SummaryBrowser
                      taskId={q.data.id}
                      progress={overview.data?.progressHistory.items ?? []}
                    >
                      <Records resource="summaries" task={q.data} />
                    </SummaryBrowser>
                  </TabsContent>
                  <TabsContent value="timeline">
                    <TaskExecutionTimeline
                      key={q.data.id}
                      taskId={q.data.id}
                      version={q.data.version}
                    />
                    <Records resource="timeline" task={q.data} />
                  </TabsContent>
                </motion.div>
              </Tabs>
            </TaskFilterProvider>
          </>
        )}
      </QueryState>
    </DetailShell>
  );
}
function Children({ task }: { task: Task }) {
  useLocale();
  const api = useApi();
  const overview = useQuery({
    queryKey: ["task-overview", task.id, task.version],
    queryFn: ({ signal }) => api.overview(task.id, signal),
  });
  const [offset] = useUrlState<number>("children.offset", 0);
  const limit = usePageSize("children", 10);
  const [statusId, setStatus] = useUrlState<string>("children.statusId", "");
  const [executorAgentId, setExecutor] = useUrlState<string>(
    "children.executorAgentId",
    "",
  );
  const [blocked, setBlocked] = useUrlState<string>("children.blocked", "", {
    values: booleanValues,
  });
  const [includeArchived, setArchived] = useUrlState<string>(
    "children.includeArchived",
    "false",
    { values: booleanValues },
  );
  const filtered = !!(statusId || executorAgentId || blocked);
  useEffect(() => {
    if (filtered)
      document
        .querySelector<HTMLElement>('[role="tab"][data-state="active"]')
        ?.focus({ preventScroll: true });
  }, [filtered, statusId, executorAgentId, blocked]);
  return (
    <div className="detail-section">
      <TaskFilters active={filtered || includeArchived === "true"}>
        <FilterBar
          active={filtered || includeArchived === "true"}
          onClear={() => {
            setStatus("");
            setExecutor("");
            setBlocked("");
            setArchived("false");
          }}
        >
          <SubtaskFilterChoices
            task={task}
            statusId={statusId}
            executorAgentId={executorAgentId}
            blocked={blocked}
            includeArchived={includeArchived}
            setStatus={setStatus}
            setExecutor={setExecutor}
            setBlocked={setBlocked}
            setArchived={setArchived}
          />
        </FilterBar>
      </TaskFilters>
      {overview.error && (
        <Failure error={overview.error} retry={() => void overview.refetch()} />
      )}
      {overview.data && (
        <div className="overview-chart-grid">
          <SubtaskCharts
            data={overview.data.directSubtasks}
            onFilter={openOverviewChildren}
          />
        </div>
      )}
      <TaskRecordList
        resource="tasks"
        scope=""
        filters={{
          parentId: task.id,
          offset,
          limit,
          sortBy: "position",
          statusId: statusId || undefined,
          executorAgentId: executorAgentId || undefined,
          blocked: blocked ? blocked === "true" : undefined,
          includeArchived: includeArchived === "true",
        }}
        empty={tr("tasks.noSubtasks2")}
        emptyDescription={tr("tasks.thisTaskHasNoDirectSubtasksYet2")}
      >
        {(child) => <ChildRow task={child} />}
      </TaskRecordList>
    </div>
  );
}
type RecordKind = "attachments" | "summaries" | "timeline";
function Records({ resource, task }: { resource: RecordKind; task: Task }) {
  useLocale();
  const [offset, setOffset] = useUrlState<number>(`${resource}.offset`, 0);
  const [includeChildren, setInclude] = useUrlState<string>(
    "timeline.includeChildren",
    "false",
    { values: booleanValues },
  );
  const limit = usePageSize(resource, 10);
  const scopeFilters =
    resource === "timeline"
      ? {
          includeChildren: includeChildren === "true",
          sortBy: "sequence",
          sortOrder: "desc" as const,
        }
      : {};
  const list = (
    <TaskRecordList
      resource={resource}
      scope={task.id}
      filters={{ offset, limit, ...scopeFilters }}
      empty={tr("tasks.noRecordsInThisSection")}
      emptyDescription={tr(
        "tasks.recordsLinkedToTheTaskWillAppearHereWhenAvailable",
      )}
    >
      {(row) => <RecordContent kind={resource} row={row} />}
    </TaskRecordList>
  );
  return (
    <div
      className={`detail-section${resource === "timeline" ? " task-timeline" : ""}`}
    >
      {resource === "timeline" ? (
        <SummaryBrowser
          resource="timeline"
          taskId={task.id}
          progress={[]}
          filters={scopeFilters}
          filtersActive={includeChildren !== "false"}
          clearFilters={() => {
            setInclude("false");
            setOffset(0);
          }}
          filterControls={
            <Choice
              label={tr("tasks.events2")}
              value={includeChildren}
              onChange={(value) => {
                setInclude(value);
                setOffset(0);
              }}
              options={[
                { value: "false", label: tr("tasks.thisTaskOnly") },
                { value: "true", label: tr("tasks.includeAllDescendants") },
              ]}
            />
          }
        >
          {list}
        </SummaryBrowser>
      ) : (
        list
      )}
    </div>
  );
}
function RecordContent({
  kind,
  row,
}: {
  kind: RecordKind;
  row: Resources[RecordKind];
}) {
  useLocale();
  if (kind === "attachments")
    return <Attachment item={row as Resources["attachments"]} />;
  if (kind === "summaries") {
    const r = row as Resources["summaries"];
    return (
      <Card
        role="article"
        aria-label={tr("tasks.summaryFrom", { date: formatDate(r.createdAt) })}
        className="task-execution-summary"
      >
        <CardHeader className="summary-record-header">
          <CardTitle>{tr("tasks.workSummary")}</CardTitle>
          <Author id={r.actorId} date={r.createdAt} />
          <Badge variant="secondary">
            {
              {
                progress: tr("tasks.inProgress"),
                completed: tr("tasks.completed"),
                blocked: tr("boards.blocked2"),
              }[r.outcome]
            }
          </Badge>
        </CardHeader>
        <CardContent className="summary-record-content">
          <section
            className="task-reading-block"
            aria-label={tr("tasks.summaryContent")}
          >
            <Markdown headingOffset={2} sectionDividers>
              {r.summary}
            </Markdown>
          </section>
          <SummaryCommits report={r.commitReport} />
          <SummaryUsage report={r.usageReport} />
          <section
            className="task-reading-block"
            aria-label={tr("tasks.deliverables")}
          >
            <h4>{tr("tasks.deliverables")}</h4>
            {r.deliverables.length ? (
              r.deliverables.map((d, i) => (
                <div key={i}>
                  {safeUrl(d.url) ? (
                    <a href={safeUrl(d.url)} target="_blank" rel="noreferrer">
                      {d.label} <ExternalLink size={12} />
                    </a>
                  ) : (
                    d.label
                  )}
                </div>
              ))
            ) : (
              <p className="small-note">{tr("tasks.noDeliverablesRecorded")}</p>
            )}
          </section>
          <section
            className="task-reading-block"
            aria-label={tr("tasks.pendingWork")}
          >
            <h4>{tr("tasks.pendingWork")}</h4>
            {r.pending.length ? (
              <ul className="list-disc pl-5">
                {r.pending.map((p, i) => (
                  <li key={i}>
                    <Markdown headingOffset={2}>{p}</Markdown>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small-note">{tr("tasks.noPendingWorkRecorded")}</p>
            )}
          </section>
        </CardContent>
      </Card>
    );
  }
  return <TimelineEventCard event={row as Resources["timeline"]} />;
}
function Author({ id, date }: { id: string | null; date: string }) {
  useLocale();
  return (
    <div className="record-author">
      <AgentName id={id} />
      <time dateTime={date}>{formatDate(date)}</time>
    </div>
  );
}
