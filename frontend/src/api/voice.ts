export type VoiceEvent = {
  cursor: number;
  type: "execute_codex" | "transcript" | "closed" | "error";
  callId?: string;
  content?: string;
  role?: string;
};
export type VoiceContext = {
  agentId: string;
  teamId?: string;
  conversationId?: string;
};
export type VoiceSession = { id: string; sdp: string; conversationId: string };
export type VoiceApi = {
  start: (sdp: string, context: VoiceContext) => Promise<VoiceSession>;
  events: (
    id: string,
    after: number,
  ) => Promise<{ events: VoiceEvent[]; cursor: number }>;
  result: (id: string, callId: string, content: string) => Promise<unknown>;
  context: (id: string, content: string) => Promise<unknown>;
  stop: (id: string) => Promise<unknown>;
};
