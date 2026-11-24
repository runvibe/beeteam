import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessMode } from "@/api/generated/chat/AccessMode";

export const accessModes = [
  "read_only",
  "standard",
  "full_access",
  "codex_config",
] as const satisfies readonly AccessMode[];
export type { AccessMode };

export function isAccessMode(value: unknown): value is AccessMode {
  return (
    typeof value === "string" && accessModes.some((mode) => mode === value)
  );
}

type ChatAccessState = {
  defaultMode: AccessMode;
  byChat: Record<string, AccessMode>;
  setDefault: (mode: AccessMode) => void;
  choose: (chatId: string, mode: AccessMode) => void;
  moveChoice: (from: string, to: string) => void;
};

export const useChatAccess = create<ChatAccessState>()(
  persist(
    (set) => ({
      defaultMode: "standard",
      byChat: {},
      setDefault: (defaultMode) => set({ defaultMode }),
      choose: (chatId, mode) =>
        set((state) => ({ byChat: { ...state.byChat, [chatId]: mode } })),
      moveChoice: (from, to) =>
        set((state) => {
          const selected = state.byChat[from];
          if (!selected) return state;
          const byChat = { ...state.byChat, [to]: selected };
          delete byChat[from];
          return { byChat };
        }),
    }),
    {
      name: "beeteam-chat-access",
      partialize: ({ defaultMode, byChat }) => ({ defaultMode, byChat }),
      merge: (saved, current) => {
        if (!saved || typeof saved !== "object") return current;
        const state = saved as Partial<ChatAccessState>;
        const byChat: Record<string, AccessMode> = {};
        if (state.byChat && typeof state.byChat === "object") {
          for (const [id, mode] of Object.entries(state.byChat)) {
            if (isAccessMode(mode)) byChat[id] = mode;
            else console.warn("Invalid saved chat access mode", id);
          }
        }
        if (state.defaultMode !== undefined && !isAccessMode(state.defaultMode))
          console.warn("Invalid saved default chat access mode");
        return {
          ...current,
          defaultMode: isAccessMode(state.defaultMode)
            ? state.defaultMode
            : current.defaultMode,
          byChat,
        };
      },
    },
  ),
);

export const useChatAccessSettings = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>()((set) => ({ open: false, setOpen: (open) => set({ open }) }));
