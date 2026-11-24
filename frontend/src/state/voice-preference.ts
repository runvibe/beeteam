import { create } from "zustand";
import { persist } from "zustand/middleware";

type VoicePreference = {
  voiceId: string | null;
  choose: (voiceId: string | null) => void;
};

export const useVoicePreference = create<VoicePreference>()(
  persist((set) => ({ voiceId: null, choose: (voiceId) => set({ voiceId }) }), {
    name: "beeteam-voice-preference",
    partialize: ({ voiceId }) => ({ voiceId }),
    merge: (saved, current) => {
      const value =
        saved && typeof saved === "object"
          ? (saved as { voiceId?: unknown }).voiceId
          : null;
      return {
        ...current,
        voiceId:
          typeof value === "string" && value.trim() && value.length <= 128
            ? value
            : null,
      };
    },
  }),
);
