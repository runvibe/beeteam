import { useLocale, t as tr } from "@/i18n";

import type { TaskOverviewData } from "@/api/task-overview";
import {
  CompactNarrative,
  TaskDescription,
  TaskCurrentSummary,
} from "./task-header-content";
import { useEffect, useRef, useState } from "react";
import type { Task } from "@/api/types";
import { Ban } from "lucide-react";
import { TaskProgress } from "./task-progress";
import { Markdown } from "@/components/markdown";

export function useTaskHeaderVisibility() {
  const primary = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const [pastHeader, setPastHeader] = useState(false);
  useEffect(() => {
    const root = primary.current;
    const target = hero.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") return;
    const media = window.matchMedia("(min-width: 1056px)");
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      setPastHeader(false);
      if (!media.matches) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry)
            setPastHeader(
              !entry.isIntersecting &&
                entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0),
            );
        },
        { root, threshold: 0 },
      );
      observer.observe(target);
    };
    observe();
    media.addEventListener("change", observe);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", observe);
    };
  }, []);
  return { primary, hero, pastHeader };
}

/** Keep the original hero and forms mounted; compact prose can be expanded accessibly. */
export function TaskCompactHeader({
  task,
  visible,
  overview,
}: {
  task: Task;
  visible: boolean;
  overview?: TaskOverviewData;
}) {
  useLocale();
  return (
    <div
      className="task-compact-header"
      data-visible={visible}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="task-compact-clip">
        <div className="task-compact-body">
          <p className="task-compact-title">{task.title}</p>
          <CompactNarrative
            label={tr("common.description")}
            text={task.description || tr("tasks.noDescriptionRecorded")}
          >
            <TaskDescription task={task} />
          </CompactNarrative>
          <div aria-hidden="true">
            <TaskProgress percent={task.progress?.percent} />
          </div>
          {task.block.blocked && (
            <div className="task-compact-blocked">
              <Ban aria-hidden="true" />
              <div>
                <strong>{tr("tasks.taskBlocked")}</strong>
                <div className="task-compact-reason" inert>
                  <Markdown headingOffset={2}>{task.block.reason}</Markdown>
                </div>
              </div>
            </div>
          )}
          <CompactNarrative
            label={tr("tasks.currentWorkSummary")}
            text={task.currentSummary || tr("boards.noUpdateRecorded")}
          >
            <TaskCurrentSummary task={task} overview={overview} />
          </CompactNarrative>
        </div>
      </div>
    </div>
  );
}
