export type MentionSelection = { id: string; name: string; slug: string };
export function mentionToken(agent: MentionSelection): string {
  return `[@${agent.name.replace(/[\\[\]]/g, "\\$&")}](/agents/${agent.slug})`;
}
export function selectedRecipients(
  body: string,
  selections: MentionSelection[],
): string[] {
  return [
    ...new Set(
      selections
        .filter((agent) => body.includes(mentionToken(agent)))
        .map((agent) => agent.id),
    ),
  ];
}
