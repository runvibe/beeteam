import { formatPercent, useLocale, t as tr } from "@/i18n";

import {
  RecordedProgress,
  recordedPercent,
} from "@/components/recorded-progress";
import type { CSSProperties } from "react";

export function TaskProgress({ percent }: { percent?: number | null }) {
  useLocale();
  const value = recordedPercent(percent);
  return (
    <div
      className="task-progress"
      style={{ "--task-progress": `${value ?? 0}%` } as CSSProperties}
    >
      <div className="task-progress-meter">
        <span className="task-progress-value" aria-hidden="true">
          {value === undefined ? tr("tasks.noData") : formatPercent(value)}
        </span>
        <RecordedProgress
          percent={value}
          label={tr("tasks.recordedProgress2")}
          className="task-progress-track"
        />
      </div>
    </div>
  );
}
