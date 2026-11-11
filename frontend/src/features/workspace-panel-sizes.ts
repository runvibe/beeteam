import { createContext } from "react";
import {
  CHAT_PANEL_MIN_WIDTH,
  getMaxChatPanelWidth,
} from "@/state/chat-panel";
import {
  CONTENT_PANEL_MIN_WIDTH,
  SESSIONS_PANEL_MIN_WIDTH,
  type WorkspacePanel,
} from "@/state/workspace-layout";

export type ResizablePanel = "chat" | "sessions";

export type WorkspaceResizeConfiguration = {
  viewport: number;
  workspace: number;
  visible: readonly WorkspacePanel[];
  narrow: boolean;
};

type PanelSizes = Record<WorkspacePanel, number> & {
  chatMax: number;
  contentMin: number;
};

export const WorkspaceResizeContext =
  createContext<WorkspaceResizeConfiguration | null>(null);

export function workspacePanelSizes(
  config: WorkspaceResizeConfiguration,
  chatWidth: number,
  sessionsWidth: number,
): PanelSizes {
  const sessionsVisible = !config.narrow && config.visible.includes("sessions");
  const chatVisible = !config.narrow && config.visible.includes("chat");
  const viewportMax = getMaxChatPanelWidth(config.viewport);
  // Keep the existing 80%-viewport chat limit when sessions are hidden.
  const contentMin = sessionsVisible
    ? CONTENT_PANEL_MIN_WIDTH
    : Math.min(
        CONTENT_PANEL_MIN_WIDTH,
        Math.max(0, config.workspace - viewportMax),
      );
  const sessionsMax = Math.max(
    SESSIONS_PANEL_MIN_WIDTH,
    config.workspace -
      CONTENT_PANEL_MIN_WIDTH -
      (chatVisible ? CHAT_PANEL_MIN_WIDTH : 0),
  );
  const sessions = sessionsVisible
    ? Math.max(
        SESSIONS_PANEL_MIN_WIDTH,
        Math.min(sessionsWidth, sessionsMax),
      )
    : 0;
  const chatMax = sessionsVisible
    ? Math.max(
        CHAT_PANEL_MIN_WIDTH,
        Math.min(
          viewportMax,
          config.workspace - sessions - CONTENT_PANEL_MIN_WIDTH,
        ),
      )
    : viewportMax;
  const chat = chatVisible
    ? Math.max(CHAT_PANEL_MIN_WIDTH, Math.min(chatWidth, chatMax))
    : 0;
  return {
    sessions,
    chat,
    content: Math.max(0, config.workspace - sessions - chat),
    chatMax,
    contentMin,
  };
}

export function workspaceResizeBounds(
  config: WorkspaceResizeConfiguration,
  sizes: PanelSizes,
  panel: ResizablePanel,
) {
  const index = config.visible.indexOf(panel);
  const contentIndex = config.visible.indexOf("content");
  if (config.narrow || index < 0 || contentIndex < 0) return null;
  const edge = index < contentIndex ? "right" : "left";
  const neighbor = config.visible[index + (edge === "right" ? 1 : -1)];
  if (!neighbor) return null;
  const total = sizes[panel] + sizes[neighbor];
  const viewportMax = getMaxChatPanelWidth(config.viewport);
  const minimum =
    panel === "chat" ? CHAT_PANEL_MIN_WIDTH : SESSIONS_PANEL_MIN_WIDTH;
  const neighborMinimum =
    neighbor === "chat"
      ? CHAT_PANEL_MIN_WIDTH
      : neighbor === "sessions"
        ? SESSIONS_PANEL_MIN_WIDTH
        : sizes.contentMin;
  const min = Math.max(minimum, neighbor === "chat" ? total - viewportMax : 0);
  const max = Math.max(
    min,
    Math.min(
      total - neighborMinimum,
      panel === "chat" ? viewportMax : Infinity,
    ),
  );
  return { edge, neighbor, min, max, total };
}
