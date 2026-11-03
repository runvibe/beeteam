use super::contracts;
use serde_json::{json, Value};
pub fn is_composite(name: &str) -> bool {
    matches!(
        name,
        "prepare_execution" | "record_progress" | "close_activity"
    )
}
pub fn composite_tools() -> Vec<Value> {
    let doc = &contracts::operation("createExecutionSummary")
        .unwrap()
        .document;
    let ref_schema =
        |name: &str| contracts::inline_schema(doc, &doc["components"]["schemas"][name]);
    let ra = &contracts::operation("getAgent").unwrap().document;
    let preparation_output = json!({"type":"object","properties":{
        "task":ref_schema("Task"),"executorProfile":contracts::inline_schema(ra,&ra["components"]["schemas"]["Agent"]),
        "plans":ref_schema("PlanRevisionPage"),"children":ref_schema("TaskPage"),"latestExecutionSummary":{"anyOf":[ref_schema("ExecutionSummary"),{"type":"null"}]},
        "pending":{"type":"array","items":{"type":"string"}},"executionContext":ref_schema("TaskExecutionContext"),"notice":{"type":"string"}
    },"required":["task","executorProfile","plans","children","latestExecutionSummary","pending","executionContext","notice"],"additionalProperties":false});
    let mutation_output = json!({"type":"object","properties":{"executionSummary":ref_schema("ExecutionSummary"),"task":ref_schema("Task"),"updatedTasks":{"type":"array","items":ref_schema("Task")},"createdComments":{"type":"array","items":{"type":"object","properties":{"taskId":{"type":"string","format":"uuid"},"commentId":{"type":"string","format":"uuid"}},"required":["taskId","commentId"],"additionalProperties":false}},"notice":{"type":"string"}},"required":["task","updatedTasks","notice"],"additionalProperties":false});
    let actor = json!({"type":"object","properties":{"kind":{"enum":["human","agent"]},"id":{"type":["string","null"],"format":"uuid"}},"required":["kind"],"additionalProperties":false});
    let task = json!({"type":"string","format":"uuid","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"});
    let mut progress = json!({"type":"object","properties":{"taskId":task,"expectedVersion":{"type":"integer","minimum":1},"progress":ref_schema("Progress"),"currentSummary":ref_schema("CurrentSummaryInput"),"block":ref_schema("Block"),"comment":{"type":"string","minLength":1,"x-maxBytes":16384}},"required":["taskId","expectedVersion"],"dependentRequired":{"progress":["currentSummary"]},"additionalProperties":false});
    let child = progress.clone();
    progress["properties"]["actor"] = actor.clone();
    progress["properties"]["idempotencyKey"] = json!({"type":"string","format":"uuid"});
    progress["properties"]["subtaskUpdates"] = json!({"type":"array","maxItems":100,"items":child});
    progress["required"] = json!(["taskId", "expectedVersion", "actor", "idempotencyKey"]);
    let close = json!({"type":"object","properties":{"taskId":task,"expectedVersion":{"type":"integer","minimum":1},"actor":actor,"idempotencyKey":{"type":"string","format":"uuid"},"execution":ref_schema("RecordExecution"),"block":ref_schema("Block"),"comment":{"type":"string","minLength":1,"x-maxBytes":16384}},"required":["taskId","expectedVersion","actor","idempotencyKey","execution"],"additionalProperties":false});
    let prepare = json!({"type":"object","properties":{"taskId":task,"offset":{"type":"integer","minimum":0,"maximum":2147483647},"limit":{"type":"integer","minimum":1,"maximum":100}},"required":["taskId"],"additionalProperties":false});
    [("prepare_execution","Read task, current executor profile, latest plan revisions page, direct children across boards, latest result/pending work and effective origin context. Does not start work.",prepare,true),
     ("record_progress","Atomically record cumulative currentSummary/comment/progress/block for task and explicitly named descendants; checklist is derived from real subtasks. All supplied versions must match. No implicit completion.",progress,false),
     ("close_activity","Optional execution.executionTracking records explicit start/checkpoint/pause/resume/finish; return IDs and consult listOpenExecutionIntervals before resumption. Boundaries and status share one transaction; paused finish has empty evidenceIds and no paused consumption. See beeteam://references/execution-intervals for success/conflict/recovery examples. Atomically record optional block/comment and cumulative execution.currentSummary and historical execution summary, deliverables, pending work, status and optional review. Does not require task completion. Task status changes require this summary or createExecutionSummary. Every new execution requires usageReport.entries measured cumulative_snapshot session/session_tree evidence with identified modelId, actor.kind=agent and persisted UUIDv7, and non-null decimal-string totalTokens equal to inclusive inputTokens+outputTokens. Cache/reasoning are subsets, never added again. This is the session/epoch/model/actor accumulation through observedAt, not task-exclusive consumption. First real snapshot is an accepted baseline with previousEvidenceId null and delta null. Subsequent comparable snapshots reference the latest checkpoint; repeated evidence is deduplicated. Never sum snapshots or overlapping tree/child totals. Collect fresh counters from actual permitted harnesses: Codex App Server/exec, Copilot SDK/CLI/VS Code telemetry, Claude SDK/OTel or authorized Cursor usage exports; verify models and surface/version semantics. Kiro credits/context do not establish tokens. No unavailable, estimated, null model or fabricated zero for new summaries; use a comment to report collection failure. Historical records, late evidence and exact legacy replays remain valid. statusObserved is server-owned. unknown metadata and discovery.attempts cannot replace the required measurement.",close,false)].into_iter().map(|(name,description,mut input,read)|{input["components"]=doc["components"].clone();json!({"name":name,"description":description,"inputSchema":input,"outputSchema":if read{preparation_output.clone()}else{mutation_output.clone()},"annotations":{"readOnlyHint":read,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}})}).collect()
}
