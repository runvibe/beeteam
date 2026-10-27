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
  tasks: Pick<import("./generated/kanban/PatchTask").PatchTask, "autonomyMode">;
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
export interface Filters {
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
  types?: string;
  actorId?: string;
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
  list<K extends keyof Resources>(
    resource: K,
    scope?: string,
    filters?: Filters,
  ): Promise<Page<Resources[K]>>;
  get<K extends keyof Entities>(resource: K, id: string): Promise<Entities[K]>;
  board(id: string, filters?: Filters): Promise<BoardView>;
  patch<K extends keyof Patches>(
    resource: K,
    id: string,
    body: Patches[K],
    version: number,
  ): Promise<PatchResults[K]>;
  revisions(
    taskId: string,
    planId: string,
    filters?: Filters,
  ): Promise<Page<PlanRevision>>;
  resume(agentId: string): Promise<ResumeContext>;
  createStatus(
    boardId: string,
    input: import("./generated/kanban/StatusInput").StatusInput,
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
