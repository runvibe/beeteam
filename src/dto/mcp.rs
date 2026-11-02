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
    let mutation_output = json!({"type":"object","properties":{"task":ref_schema("Task"),"updatedTasks":{"type":"array","items":ref_schema("Task")},"createdComments":{"type":"array","items":{"type":"object","properties":{"taskId":{"type":"string","format":"uuid"},"commentId":{"type":"string","format":"uuid"}},"required":["taskId","commentId"],"additionalProperties":false}},"notice":{"type":"string"}},"required":["task","updatedTasks","notice"],"additionalProperties":false});
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
     ("close_activity","Atomically record optional block/comment and cumulative execution.currentSummary and historical execution summary, deliverables, pending work, status and optional review. Does not require task completion. Task status changes require this execution summary or createExecutionSummary; moveTask only reorders within the current status. statusObserved is a server-owned historical snapshot captured atomically. Every new execution summary requires usageReport.entries (1..32), including close_activity.execution. At work start discover permitted usage sources and the correct session; at reporting time collect fresh evidence for actual models, harnesses, surface/version and actors. Measured/estimated entries require at least one known input or output component. Report decimal-string input/output tokens; cached input and reasoning output are inclusive subsets, never added twice. Unknown model/provider/version or counters are null, not invented. period_delta is request-scoped evidence; cumulative_snapshot is session-scoped, with first snapshot a non-counted baseline and subsequent snapshots referencing the comparable latest predecessor. Never sum cumulative snapshots or duplicate sources. If measurement is impossible, send reportKind/quality unavailable, all counters null, discovery.reason and factual nonblank discovery.attempts. If session/epoch cannot be observed, explicitly use unavailable and a unique evidenceId identifying the reporting attempt; explain unknown harness/surface in discovery. Do not omit the report or fabricate zero. Historical missing reports and exact legacy idempotent replays remain valid.",close,false)].into_iter().map(|(name,description,mut input,read)|{input["components"]=doc["components"].clone();json!({"name":name,"description":description,"inputSchema":input,"outputSchema":if read{preparation_output.clone()}else{mutation_output.clone()},"annotations":{"readOnlyHint":read,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}})}).collect()
}
