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
  /** True while the user is choosing a team; otherwise no selection means the system team. */
  picking: boolean;
  open: boolean;
  side: ChatPanelSide;
  width: number;
  openTeam: (teamId: string) => void;
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
      picking: false,
      open: true,
      side: "right",
      width: 440,
      openTeam: (teamId) => set({ teamId, picking: false, open: true }),
      close: () => set({ open: false }),
      show: () => set({ open: true }),
      chooseTeam: () => set({ teamId: null, picking: true, open: true }),
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
      partialize: ({ side, width, teamId, picking, open }) => ({
        side,
        width,
        teamId,
        picking,
        open,
      }),
    },
  ),
);
