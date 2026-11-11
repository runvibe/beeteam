import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CHAT_PANEL_MIN_WIDTH = 320;
export const CHAT_PANEL_MAX_VIEWPORT_PERCENT = 80;

export function getMaxChatPanelWidth(viewportWidth: number) {
  return Math.max(
    CHAT_PANEL_MIN_WIDTH,
    (viewportWidth * CHAT_PANEL_MAX_VIEWPORT_PERCENT) / 100,
  );
}

export type ChatPanelSide = "left" | "right";
type ChatPanelState = {
  teamId: string | null;
  /** Session to show in the team chat; null starts a new conversation or restores the latest one. */
  conversationId: string | null;
  /** True while the user is choosing a team; otherwise no selection means the system team. */
  picking: boolean;
  open: boolean;
  side: ChatPanelSide;
  width: number;
  openTeam: (teamId: string) => void;
  openConversation: (teamId: string, conversationId: string) => void;
  setConversation: (conversationId: string | null) => void;
  close: () => void;
  show: () => void;
  chooseTeam: () => void;
  setSide: (side: ChatPanelSide) => void;
  setWidth: (width: number) => void;
};
export const useChatPanel = create<ChatPanelState>()(
  persist(
    (set) => ({
      teamId: null,
      conversationId: null,
      picking: false,
      open: true,
      side: "right",
      width: 440,
      openTeam: (teamId) =>
        set({ teamId, conversationId: null, picking: false, open: true }),
      openConversation: (teamId, conversationId) =>
        set({ teamId, conversationId, picking: false, open: true }),
      setConversation: (conversationId) => set({ conversationId }),
      close: () => set({ open: false }),
      show: () => set({ open: true }),
      chooseTeam: () =>
        set({ teamId: null, conversationId: null, picking: true, open: true }),
      setSide: (side) => set({ side }),
      setWidth: (width) =>
        set({
          width: Math.min(
            getMaxChatPanelWidth(window.innerWidth),
            Math.max(CHAT_PANEL_MIN_WIDTH, width),
          ),
        }),
    }),
    {
      name: "beeteam-chat-panel",
      partialize: ({ side, width, teamId, conversationId, picking, open }) => ({
        side,
        width,
        teamId,
        conversationId,
        picking,
        open,
      }),
    },
  ),
);
