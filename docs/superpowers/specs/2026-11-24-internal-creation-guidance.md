# Internal creation guidance

User approved replacing exposed creation skills with an internal function that supplies the rules/fields for creating teams, agents, boards and tasks. The chat should ask only for missing meaningful inputs and report progress/results without announcing skills. Keep existing mutation validations, declared actor semantics, access modes and idempotency. No task/agent/session is created just by consulting guidance.

Discovery: repository contains only general leader/worker/setup skills, not separate four creation skills. Remove creation's dependence on skills in managed agent routing, seed guide instructions and related first-party references. Preserve broader coordination/execution skills and external user-installed skills. Do not rewrite custom persisted agent instructions or delete global skills.

Design: typed read-only internal get_creation_guidance tool with entity enum team/agent/board/task, plus HTTP adapter using same DTO/service; response contains actual creation operation name, current schema/required fields and concise internal workflow rules. Source contracts from checked-in current OpenAPI, not hand-guessed IDs or copied drift. Guidance never executes mutations. Managed built-in instructions tell agents to consult it for creation, treat implementation detail as internal, and use existing create operations after gathering missing fields. Installed Codex remains execution engine.

Legacy default guide text recommending skills must no longer redirect creation for existing installations; prefer trusted runtime guidance that specifically selects this path and targeted handling of known default text if needed, never bulk rewriting user custom profile data. No suppression of real safety approvals, failures or tool audit evidence.
