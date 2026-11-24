import type { components } from "@/api/generated/managed-agents";
type S = components["schemas"];
/** Keep complete recent message objects within the native context byte budget. */
export function voiceHistory(messages: S["Message"][]) {
  const eligible = messages.filter(
    (message) => message.role === "requester" || message.role === "agent",
  );
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of [...eligible].reverse()) {
    const item = {
      role:
        message.role === "requester"
          ? ("user" as const)
          : ("assistant" as const),
      content: message.content,
    };
    const candidate = [item, ...history];
    if (new TextEncoder().encode(JSON.stringify(candidate)).length > 23000)
      break;
    history.unshift(item);
  }
  return { messages: history, truncated: history.length < eligible.length };
}
