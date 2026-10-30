import type { Agent, Resources } from "@/api/types";
export function conversationAuthor(
  comment: Resources["comments"],
  agent?: Agent,
) {
  if (comment.actorKind === "human")
    return { name: "Pessoa", role: "Identidade não informada", leader: false };
  if (!agent || agent.deletedAt)
    return {
      name: "Agente indisponível",
      role: "Papel não identificado",
      leader: false,
    };
  const leader = !!agent.bindings.leaderTeamId;
  return {
    name: agent.name,
    leader,
    role: leader
      ? "Leader · papel atual"
      : agent.bindings.collaboratorTeamId
        ? "Collaborator · papel atual"
        : "Papel não identificado",
  };
}
