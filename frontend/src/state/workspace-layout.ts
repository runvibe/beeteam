import type { ChatPanelSide } from "./chat-panel";

export type WorkspacePanel = "sessions" | "content" | "chat";
export const SESSIONS_PANEL_WIDTH = 280;
export const SESSIONS_PANEL_MIN_WIDTH = 200;
export const CONTENT_PANEL_MIN_WIDTH = 180;

export function defaultPanelOrder(side: ChatPanelSide): WorkspacePanel[] {
  return side === "left"
    ? ["sessions", "chat", "content"]
    : ["sessions", "content", "chat"];
}

export function isPanelOrder(value: unknown): value is WorkspacePanel[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    new Set(value).size === 3 &&
    value.every(
      (panel) =>
        panel === "sessions" || panel === "content" || panel === "chat",
    )
  );
}

export function chatSide(order: readonly WorkspacePanel[]): ChatPanelSide {
  return order.indexOf("chat") < order.indexOf("content") ? "left" : "right";
}

export function movePanel(
  order: readonly WorkspacePanel[],
  panel: WorkspacePanel,
  visible: readonly WorkspacePanel[],
  position: number,
): WorkspacePanel[] {
  if (
    !isPanelOrder(order) ||
    !visible.includes(panel) ||
    visible.some((item) => !order.includes(item)) ||
    new Set(visible).size !== visible.length ||
    !Number.isInteger(position) ||
    position < 0 ||
    position >= visible.length
  ) {
    throw new Error("Invalid workspace panel move");
  }
  if (visible.indexOf(panel) === position) return [...order];
  const others = visible.filter((item) => item !== panel);
  if (!others.length) return [...order];
  const next = order.filter((item) => item !== panel);
  const anchor = others[position];
  const index = anchor
    ? next.indexOf(anchor)
    : next.indexOf(others[others.length - 1]) + 1;
  next.splice(index, 0, panel);
  return next;
}
