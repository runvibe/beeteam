import type { Page, Resources } from "./types";
/** Lightweight projection confirmed by the shared Timeline points contract. */
export type TimelinePoint = Pick<
  Resources["timeline"],
  "id" | "taskId" | "type" | "occurredAt" | "sequence"
>;
export type TimelinePointPage = Page<TimelinePoint>;
