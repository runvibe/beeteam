import { t as tr } from "@/i18n";
import type { Agent, Resources } from "@/api/types";
export function conversationAuthor(
  comment: Resources["comments"],
  agent?: Agent,
) {
  if (comment.actorKind === "human")
    return {
      name: tr("tasks.person"),
      role: tr("tasks.identityNotProvided"),
      leader: false,
    };
  if (!agent || agent.deletedAt)
    return {
      name: tr("common.agentUnavailable"),
      role: tr("tasks.unidentifiedRole"),
      leader: false,
    };
  const leader = !!agent.bindings.leaderTeamId;
  return {
    name: agent.name,
    leader,
    role: leader
      ? tr("tasks.leaderCurrentRole")
      : agent.bindings.collaboratorTeamId
        ? tr("tasks.collaboratorCurrentRole")
        : tr("tasks.unidentifiedRole"),
  };
}
