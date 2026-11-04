import type { Board } from "./generated/kanban/Board";
import type { BoardView } from "./generated/kanban/BoardView";
import type { Task } from "./generated/kanban/Task";
import type { Status } from "./generated/kanban/Status";
import type { PlanRevision } from "./generated/kanban/PlanRevision";
import type { Comment } from "./generated/kanban/Comment";
import type { Attachment } from "./generated/kanban/Attachment";
import type { ExecutionSummary } from "./generated/kanban/ExecutionSummary";
import type { Event } from "./generated/kanban/Event";
import type { Agent } from "./generated/ra/Agent";
import type { Team } from "./generated/ra/Team";
import type { Member } from "./generated/ra/Member";
import type { ChatReference } from "./generated/ra/ChatReference";
import type { ActivityLink } from "./generated/ra/ActivityLink";
import type { ResumeContext } from "./generated/ra/ResumeContext";
import type { PatchAgent } from "./generated/ra/PatchAgent";
import type { PatchTeam } from "./generated/ra/PatchTeam";
import type { PatchBoard } from "./generated/kanban/PatchBoard";
import type { PatchStatus } from "./generated/kanban/PatchStatus";
export type { Board, BoardView, Task, Status, Agent, Team, PlanRevision };
export interface Resources {
  boards: Board;
  tasks: Task;
  statuses: Status;
  plans: PlanRevision;
  comments: Comment;
  attachments: Attachment;
  summaries: ExecutionSummary;
  timeline: Event;
  agents: Agent;
  teams: Team;
  members: Member;
  chats: ChatReference;
  activities: ActivityLink;
}
export interface Entities {
  boards: Board;
  tasks: Task;
  agents: Agent;
  teams: Team;
}
export interface Patches {
  tasks: import("./generated/kanban/PatchTask").PatchTask;
  boards: PatchBoard;
  agents: PatchAgent;
  teams: PatchTeam;
  statuses: PatchStatus;
}
export type PatchResults = Pick<Resources, keyof Patches>;
export interface Page<T> {
  items: T[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}
export interface TaskParticipant {
  actorKind: "agent" | "human";
  actorId: string | null;
  agentName: string | null;
  agentArchived: boolean;
  agentDeleted: boolean;
}
export interface Filters {
  id?: string;
  offset?: number;
  limit?: number;
  title?: string;
  name?: string;
  label?: string;
  teamId?: string;
  executorAgentId?: string;
  authorAgentId?: string;
  boardId?: string;
  statusId?: string;
  parentId?: string;
  includeArchived?: boolean;
  rootOnly?: boolean;
  archived?: boolean;
  blocked?: boolean;
  role?: "leader" | "collaborator";
  relation?: "authored" | "executing" | "worked" | "any";
  harness?: string;
  includeChildren?: boolean;
  includeRemoved?: boolean;
  fileName?: string;
  mediaType?: string;
  types?: string;
  actorId?: string;
  actorKind?: "human" | "agent";
  text?: string;
  createdFrom?: string;
  createdBefore?: string;
  updatedFrom?: string;
  updatedBefore?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limitPerColumn?: number;
}
/** UI port. An HTTP implementation can replace this without changing feature components. */
export interface BeeApi {
  timelinePoints(taskId:string,pagination?:Pick<Filters,"offset"|"limit">,signal?:AbortSignal):Promise<import("./timeline-points").TimelinePointPage>;
  comment(taskId: string, commentId: string, signal?: AbortSignal): Promise<Resources["comments"]>;
  openProject(
    taskId: string,
    projectKey: string,
    application: import("./local-projects").ProjectApplication,
  ): Promise<import("./local-projects").OpenProjectResponse>;
  executionIntervalUsage(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<
    import("./generated/kanban/TaskExecutionIntervalUsage").TaskExecutionIntervalUsage
  >;
  executionIntervals(
    taskId: string,
    pagination?: Pick<Filters, "offset" | "limit">,
    signal?: AbortSignal,
  ): Promise<
    import("./generated/kanban/TaskExecutionIntervalPage").TaskExecutionIntervalPage
  >;
  executionTrackingEvents(
    taskId: string,
    pagination?: Pick<Filters, "offset" | "limit"> & {summaryId?: string},
    signal?: AbortSignal,
  ): Promise<
    import("./generated/kanban/TaskExecutionTrackingEventPage").TaskExecutionTrackingEventPage
  >;
  executionIntervalRevisions(
    taskId: string,
    intervalId: string,
    pagination?: Pick<Filters, "offset" | "limit">,
    signal?: AbortSignal,
  ): Promise<
    import("./generated/kanban/TaskExecutionIntervalRevisionPage").TaskExecutionIntervalRevisionPage
  >;
  usage(
    taskId: string,
    pagination?: Pick<Filters, "offset" | "limit">,
    signal?: AbortSignal,
  ): Promise<import("./generated/kanban/TaskUsage").TaskUsage>;
  usageDimensions(
    taskId: string,
    kind: "model" | "harness",
    pagination?: Pick<Filters, "offset" | "limit">,
    signal?: AbortSignal,
  ): Promise<
    import("./generated/kanban/UsageDimensionPage").UsageDimensionPage
  >;
  overview(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<import("./task-overview").TaskOverviewData>;
  participants(
    taskId: string,
    pagination?: Pick<Filters, "offset" | "limit">,
    signal?: AbortSignal,
  ): Promise<Page<TaskParticipant>>;
  resolveSlug(
    resource: "agents" | "teams" | "tasks",
    slug: string,
  ): Promise<import("./generated/kanban/SlugResolution").SlugResolution>;
  list<K extends keyof Resources>(
    resource: K,
    scope?: string,
    filters?: Filters,
    signal?: AbortSignal,
  ): Promise<Page<Resources[K]>>;
  get<K extends keyof Entities>(resource: K, id: string): Promise<Entities[K]>;
  board(id: string, filters?: Filters): Promise<BoardView>;
  patch<K extends keyof Patches>(
    resource: K,
    id: string,
    body: Patches[K],
    version: number,
    scope?: string,
  ): Promise<PatchResults[K]>;
  revisions(
    taskId: string,
    planId: string,
    filters?: Filters,
    signal?: AbortSignal,
  ): Promise<Page<PlanRevision>>;
  resume(agentId: string): Promise<ResumeContext>;
  createStatus(
    boardId: string,
    input: import("./generated/kanban/StatusInput").StatusInput,
    idempotencyKey?: string,
  ): Promise<Status>;
  reorderStatuses(
    boardId: string,
    statusIds: string[],
    version: number,
  ): Promise<import("./generated/kanban/StatusOrderResult").StatusOrderResult>;
  download(taskId: string, attachmentId: string): Promise<Blob>;
  image(agentId: string): Promise<Blob>;
}
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
