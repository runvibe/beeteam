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

/** Visual echo only: the original task heading, progress and alert remain accessible. */
export function TaskCompactHeader({
  task,
  visible,
}: {
  task: Task;
  visible: boolean;
}) {
  return (
    <div
      className="task-compact-header"
      data-visible={visible}
      aria-hidden="true"
    >
      <div className="task-compact-clip">
        <div className="task-compact-body">
          <p className="task-compact-title">{task.title}</p>
          <TaskProgress percent={task.progress.percent} />
          {task.block.blocked && (
            <div className="task-compact-blocked">
              <Ban aria-hidden="true" />
              <div>
                <strong>Task bloqueada</strong>
                <div className="task-compact-reason" inert>
                  <Markdown headingOffset={2}>{task.block.reason}</Markdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
