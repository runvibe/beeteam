import { useContext } from "react";
import { useChatPanel } from "@/state/chat-panel";
import { t } from "@/i18n";
import {
  WorkspaceResizeContext,
  workspacePanelSizes,
  workspaceResizeBounds,
  type ResizablePanel,
} from "./workspace-panel-sizes";

export function WorkspacePanelResizer({ panel }: { panel: ResizablePanel }) {
  const config = useContext(WorkspaceResizeContext);
  const chatWidth = useChatPanel((state) => state.width);
  const sessionsWidth = useChatPanel((state) => state.sessionsWidth);
  if (!config) return null;

  const sizes = workspacePanelSizes(config, chatWidth, sessionsWidth);
  const bounds = workspaceResizeBounds(config, sizes, panel);
  if (!bounds) return null;

  const resize = (width: number) => {
    const state = useChatPanel.getState();
    const current = workspacePanelSizes(config, state.width, state.sessionsWidth);
    const range = workspaceResizeBounds(config, current, panel);
    if (!range) return;
    const next = Math.max(range.min, Math.min(range.max, width));
    if (next === current[panel]) return;
    const widths: Partial<Record<ResizablePanel, number>> = { [panel]: next };
    if (range.neighbor !== "content")
      widths[range.neighbor] = range.total - next;
    else {
      // Preserve a constrained third panel at its visible width.
      const other = panel === "chat" ? "sessions" : "chat";
      if (config.visible.includes(other)) widths[other] = current[other];
    }
    state.setLayoutWidths(widths);
  };
  const label = t(panel === "chat" ? "chat.resizePanel" : "sessions.resizePanel");
  return (
    <div
      className={
        panel === "chat"
          ? "workspace-panel-resizer chat-panel-resizer"
          : "workspace-panel-resizer"
      }
      data-resize-edge={bounds.edge}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={panel === "chat" ? "leader-chat-panel" : "sessions-sidebar"}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={sizes[panel]}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const state = useChatPanel.getState();
        const current = workspacePanelSizes(config, state.width, state.sessionsWidth);
        resize(
          current[panel] +
            (event.key === "ArrowRight" ? 20 : -20) *
              (bounds.edge === "right" ? 1 : -1),
        );
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = event.currentTarget.parentElement!.getBoundingClientRect();
        resize(
          bounds.edge === "right"
            ? event.clientX - rect.left
            : rect.right - event.clientX,
        );
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    />
  );
}
