//! Pure creation policy: no persistence, provider, session or mutation access.
use crate::dto::{
    backend::Result,
    contracts,
    creation_guidance::{CreationEntity, CreationGuidance, CreationGuidanceRequest},
};

#[derive(Clone, Default)]
pub struct CreationGuidanceService;

impl CreationGuidanceService {
    pub fn get(&self, request: CreationGuidanceRequest) -> Result<CreationGuidance> {
        let (operation, rules) = match request.entity {
            CreationEntity::Team => ("createTeam", vec![
                "Resolve existing leader and worker identities before creating a team; do not duplicate agents. Preserve valid role cardinalities and the required coordinationContext.",
                "Creating a team does not create a board, task or execution session. Use only catalog leaderIconId and workerIconId values when supplied.",
            ]),
            CreationEntity::Agent => ("createAgent", vec![
                "Check for an existing identity before creating another agent. Gather the name and only meaningful missing profile details; preserve supplied custom instructions.",
                "Agent creation records an identity only. Do not start an integrated session, take over an external chat or initiate execution implicitly.",
            ]),
            CreationEntity::Board => ("createBoard", vec![
                "Resolve the existing managing team for teamId. A team can manage multiple boards; tasks do not inherit team ownership.",
                "Preserve the requested valid status definitions and autonomy mode. The default board autonomy is manual; do not enable execution implicitly.",
            ]),
            CreationEntity::Task => ("createTask", vec![
                "Resolve the destination boardId path parameter and the required authorAgentId and executorAgentId. Supply workScope and coordinationContext from the actual work and role context.",
                "Tasks belong to boards, not teams. Optional parentId may refer to a task on another board; preserve hierarchy validation and do not invent workspace or team ownership.",
                "Keep specification Markdown, short description, requirements, plan content and current work summary separate. Creating a task is not authorization to start execution or a session.",
            ]),
        };
        let op = contracts::operation(operation)?;
        let body_schema = contracts::inline_schema(
            &op.document,
            &op.definition["requestBody"]["content"]["application/json"]["schema"],
        );
        let required_fields = body_schema["required"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect();
        let mut shared = vec![
            "Use this guidance internally; do not announce skills or require skill installation. Ask only for missing meaningful inputs and report progress and results plainly.",
            "This lookup makes no changes. After gathering inputs, use the named existing creation operation with its current validation, access rules and coordination requirements.",
            "For MCP creation, put resource fields in body, path values in params, and supply actor and idempotencyKey. For HTTP, use the returned path, body schema and declared header parameters. Actor metadata is not authentication; reuse the same idempotency key for retries of the same mutation.",
            "Resolve agent, team and task slugs through their typed by-slug lookup before mutation. Use UUIDv7 internal IDs, never slugs as IDs. Do not invent missing relationships or bypass approvals.",
        ].into_iter().map(str::to_owned).collect::<Vec<_>>();
        shared.extend(rules.into_iter().map(str::to_owned));
        Ok(CreationGuidance {
            entity: request.entity,
            operation_id: op.name.clone(),
            method: op.method.clone(),
            path: op.path.clone(),
            parameters: op
                .parameters
                .iter()
                .map(|p| contracts::inline_schema(&op.document, p))
                .collect(),
            body_schema,
            required_fields,
            rules: shared,
        })
    }
}
