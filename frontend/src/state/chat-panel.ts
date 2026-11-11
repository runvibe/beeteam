import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  chatSide,
  defaultPanelOrder,
  isPanelOrder,
  SESSIONS_PANEL_MIN_WIDTH,
  SESSIONS_PANEL_WIDTH,
  type WorkspacePanel,
} from "./workspace-layout";

export const CHAT_PANEL_MIN_WIDTH = 320;
export const CHAT_PANEL_MAX_VIEWPORT_PERCENT = 80;

export function getMaxChatPanelWidth(viewportWidth: number) {
  return Math.max(
    CHAT_PANEL_MIN_WIDTH,
    (viewportWidth * CHAT_PANEL_MAX_VIEWPORT_PERCENT) / 100,
  );
}

function clampChatPanelWidth(width: number) {
  return Math.min(
    getMaxChatPanelWidth(window.innerWidth),
    Math.max(CHAT_PANEL_MIN_WIDTH, width),
  );
}

export type ChatPanelSide = "left" | "right";
type LayoutWidths = Partial<Record<"chat" | "sessions", number>>;
type ChatPanelState = {
  teamId: string | null;
  /** Session to show in the team chat; null starts a new conversation or restores the latest one. */
  conversationId: string | null;
  /** An explicit request for a blank session, rather than restoring the latest one. */
  freshConversation: boolean;
  /** True while the user is choosing a team; otherwise no selection means the system team. */
  picking: boolean;
  open: boolean;
  side: ChatPanelSide;
  panelOrder: WorkspacePanel[];
  width: number;
  sessionsWidth: number;
  openTeam: (teamId: string) => void;
  startNewSession: (teamId: string | null) => void;
  openConversation: (teamId: string, conversationId: string) => void;
  setConversation: (conversationId: string | null) => void;
  close: () => void;
  show: () => void;
  chooseTeam: () => void;
  setSide: (side: ChatPanelSide) => void;
  setPanelOrder: (order: readonly WorkspacePanel[]) => void;
  setWidth: (width: number) => void;
  setLayoutWidths: (widths: LayoutWidths) => void;
};
export const useChatPanel = create<ChatPanelState>()(
  persist(
    (set) => ({
      teamId: null,
      conversationId: null,
      freshConversation: false,
      picking: false,
      open: true,
      side: "right",
      panelOrder: defaultPanelOrder("right"),
      width: 440,
      sessionsWidth: SESSIONS_PANEL_WIDTH,
      openTeam: (teamId) =>
        set({ teamId, conversationId: null, freshConversation: false, picking: false, open: true }),
      startNewSession: (teamId) =>
        set({ teamId, conversationId: null, freshConversation: true, picking: false, open: true }),
      openConversation: (teamId, conversationId) =>
        set({ teamId, conversationId, freshConversation: false, picking: false, open: true }),
      setConversation: (conversationId) => set({ conversationId, freshConversation: false }),
      close: () => set({ open: false }),
      show: () => set({ open: true }),
      chooseTeam: () =>
        set({ teamId: null, conversationId: null, freshConversation: false, picking: true, open: true }),
      setSide: (side) =>
        set((state) => {
          if (chatSide(state.panelOrder) === side) return { side };
          const order: WorkspacePanel[] = state.panelOrder.filter(
            (panel) => panel !== "chat",
          );
          const content = order.indexOf("content");
          order.splice(side === "left" ? content : content + 1, 0, "chat");
          return { side, panelOrder: order };
        }),
      setPanelOrder: (order) => {
        if (!isPanelOrder(order))
          throw new Error("Invalid workspace panel order");
        set({ panelOrder: [...order], side: chatSide(order) });
      },
      setWidth: (width) => set({ width: clampChatPanelWidth(width) }),
      setLayoutWidths: (widths) => {
        if (
          (widths.chat !== undefined && !Number.isFinite(widths.chat)) ||
          (widths.sessions !== undefined && !Number.isFinite(widths.sessions))
        )
          throw new Error("Invalid workspace panel width");
        set((state) => ({
          width:
            widths.chat === undefined
              ? state.width
              : clampChatPanelWidth(widths.chat),
          sessionsWidth:
            widths.sessions === undefined
              ? state.sessionsWidth
              : Math.max(SESSIONS_PANEL_MIN_WIDTH, widths.sessions),
        }));
      },
    }),
    {
      name: "beeteam-chat-panel",
      partialize: ({
        side,
        panelOrder,
        width,
        sessionsWidth,
        teamId,
        conversationId,
        picking,
        open,
      }) => ({
        side,
        panelOrder,
        width,
        sessionsWidth,
        teamId,
        conversationId,
        picking,
        open,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ChatPanelState>;
        const side =
          saved.side === "left" || saved.side === "right"
            ? saved.side
            : current.side;
        const panelOrder = isPanelOrder(saved.panelOrder)
          ? [...saved.panelOrder]
          : defaultPanelOrder(side);
        const savedSessionsWidth = saved.sessionsWidth;
        const validSessionsWidth =
          typeof savedSessionsWidth === "number" &&
          Number.isFinite(savedSessionsWidth) &&
          savedSessionsWidth >= SESSIONS_PANEL_MIN_WIDTH;
        if (savedSessionsWidth !== undefined && !validSessionsWidth)
          console.warn("Invalid saved sessions panel width; using the default.");
        const sessionsWidth = validSessionsWidth
          ? savedSessionsWidth
          : SESSIONS_PANEL_WIDTH;
        return {
          ...current,
          ...saved,
          panelOrder,
          side: chatSide(panelOrder),
          sessionsWidth,
        };
      },
    },
  ),
);
