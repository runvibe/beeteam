import { create } from "zustand";
import { persist } from "zustand/middleware";

type ChatPanelState = {
  teamId: string | null;
  open: boolean;
  side: "left" | "right";
  width: number;
  openTeam: (teamId: string) => void;
  close: () => void;
  show: () => void;
  chooseTeam: () => void;
  setSide: (side: "left" | "right") => void;
  setWidth: (width: number) => void;
};
export const useChatPanel = create<ChatPanelState>()(
  persist(
    (set) => ({
      teamId: null,
      open: false,
      side: "right",
      width: 440,
      openTeam: (teamId) => set({ teamId, open: true }),
      close: () => set({ open: false }),
      show: () => set({ open: true }),
      chooseTeam: () => set({ teamId: null, open: true }),
      setSide: (side) => set({ side }),
      setWidth: (width) => set({ width: Math.min(720, Math.max(320, width)) }),
    }),
    {
      name: "beeteam-chat-panel",
      partialize: ({ side, width, teamId, open }) => ({
        side,
        width,
        teamId,
        open,
      }),
    },
  ),
);
