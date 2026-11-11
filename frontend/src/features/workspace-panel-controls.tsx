import { useContext, useLayoutEffect, useRef } from "react";
import { GripHorizontal, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locale, t } from "@/i18n";
import type { WorkspacePanel } from "@/state/workspace-layout";
import {
  WorkspaceDockContext,
  workspacePanelName,
} from "./workspace-panel-dock";

export function WorkspacePanelGrip({ panel }: { panel: WorkspacePanel }) {
  const dock = useContext(WorkspaceDockContext);
  if (!dock?.draggable || !dock.visible.includes(panel)) return null;
  return (
    <span
      className="workspace-panel-grip"
      aria-hidden
      title={t("workspace.dragToDock")}
    >
      <GripHorizontal />
    </span>
  );
}

export function WorkspacePanelControls({ panel }: { panel: WorkspacePanel }) {
  const dock = useContext(WorkspaceDockContext);
  const controls = useRef<HTMLSpanElement>(null);
  const focusDirection = useRef<"left" | "right" | null>(null);
  const index = dock?.visible.indexOf(panel) ?? -1;
  useLayoutEffect(() => {
    const direction = focusDirection.current;
    if (!direction) return;
    focusDirection.current = null;
    const target =
      controls.current?.querySelector<HTMLButtonElement>(
        `[data-direction="${direction}"]`,
      ) ?? controls.current?.querySelector<HTMLButtonElement>("button");
    target?.focus({ preventScroll: true });
  }, [index]);
  if (!dock?.draggable) return null;
  if (index < 0) return null;
  const name = workspacePanelName(panel).toLocaleLowerCase(locale());
  const left = t("workspace.moveLeft", { panel: name });
  const right = t("workspace.moveRight", { panel: name });
  return (
    <span ref={controls} className="workspace-panel-controls">
      {index > 0 && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={left}
          title={left}
          data-direction="left"
          onClick={(event) => {
            if (document.activeElement === event.currentTarget)
              focusDirection.current = "left";
            dock.move(panel, index - 1);
          }}
        >
          <PanelLeft aria-hidden />
        </Button>
      )}
      {index < dock.visible.length - 1 && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={right}
          title={right}
          data-direction="right"
          onClick={(event) => {
            if (document.activeElement === event.currentTarget)
              focusDirection.current = "right";
            dock.move(panel, index + 1);
          }}
        >
          <PanelRight aria-hidden />
        </Button>
      )}
    </span>
  );
}
