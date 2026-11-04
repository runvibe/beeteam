# Collaborator bootstrap: chat before registration

## Leader prepares and waits

After the applicable approval of team composition and chat creation, first create the new Collaborator's CHAT. Do not preregister its profile or announce it as ready. In the created chat, explicitly request use of the bee-team-collaborator skill to identify/create/configure itself in Bee Team. Provide the approved role/context, actual team and its confirmed UUID, existing identity when available, and the authorization limits for creation/linking. The team and Leader identity may be prepared beforehand; this order concerns the Collaborator's profile.

Request the actual NAME when ready, accompanied by agentId, teamId, and readiness in a readable structure. The name serves the human; confirmed IDs are the association keys. If only a slug is available, resolve it through the typed endpoint/tool; do not derive a UUID or slug from a name/title. The initial title uses the destination team's resolved collaborator Unicode (🐝 only as an explicitly unresolved/no-team fallback) and proposed role/name, without treating it as a persisted identity; the Collaborator itself adjusts it to the confirmed name.

Chat creation is asynchronous and does not prove registration or readiness. Wait for an actual response through the permitted channel and verify the registration/link through Bee Team before assigning work. If there is only a name, a missing ID, a mismatched link, or pending status, do not associate by similarity or assume readiness. Reconcile only the missing step, without duplicating the profile/chat. Only after confirmation, record/assign the task and send the work notification with commentID. A ready profile does not confirm understanding of the task.

## Collaborator configures its own identity

Use the corresponding skill within the received chat. Look up the identity/team and actual contracts; reuse a confirmed existing profile and preserve its instructions, history, and links. A similar name does not authorize assuming an identity. When a new profile is explicitly authorized and there is no registration to reuse, the Collaborator itself creates/configures its registration and team link using actual DTOs/versions/idempotency. Do not create another identity to bypass the team limit. Confirm persistence and read back the profile/link before returning ready.

This authorized registration setup does not require a business task and does not allow creating a task to self-authorize work. If Bee Team access, permission, an unambiguous identity, or a valid link is missing, return pending with the factual impediment and IDs only if already confirmed; do not announce a proposed name as a created registration. Timeout/retry requires checking the result before repeating creation. Do not install integrations or change permissions implicitly.

The bootstrap response is a coordination message, not a new Bee Team DTO/API. Use a structure equivalent to `name`, `agentId`, `teamId`, `readiness` (ready/pending), and `pending` (factual impediments). When ready, the name and UUIDs come from actual records; when pending, unknown fields remain null. Display the readable name alongside the structure, never only a UUID or only a name as a key. Do not include deliverables, execution instructions, or a business briefing in this response.

## Limited exception and permissions

Only the initial request and this bootstrap's setup/impediment response are exempt from task/commentID. If pending is returned, the registration details strictly necessary to resolve that impediment and the new response remain within this bootstrap, under the original authorization, without an artificial task; do not include business work or expand composition/permissions. Afterward, work interactions follow task persistence, a complete comment, confirmation, and a reference notification with commentID. Do not extend the exception to business questions/decisions, status updates, or ordinary resumptions. Without an assigned task, wait for the Leader/user; do not start work or create your own task.

The skill does not authorize a chat tool by itself. Respect harness requirements for creating, sending, and receiving. Without authorized sending, leave the response available in the chat itself for permitted reading by the Leader, without pretending a message was delivered. A persistent chat and a temporary subagent are different. Reusing the selected chat and an existing profile remains valid; do not create a duplicate merely to satisfy this new-registration sequence.

## Example initial instruction (do not execute when reading)

“Use the bee-team-collaborator skill in this chat. Configure your identity in Bee Team for the approved role/context and the provided team with a confirmed UUID. Look up and reuse the existing profile if indicated; create a new one only within the authorization received. When persistence and the link are confirmed, return your actual NAME along with agentId, teamId, and readiness. If there is an impediment, return pending with the reason. Wait for a recorded assignment before working.”

Replace references only with actual values; this example does not create a chat, profile, or task. MCP briefing/resumption/review prompts remain read-only and do not perform bootstrap or produce actual readiness confirmation.
