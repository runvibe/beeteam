//! MCP contracts reuse the same integrated chat JSON Schema as HTTP.
use serde_json::{json, Value};
pub const NAMES: &[&str] = &["getAgentRuntime", "createIntegratedSession"];
pub fn tools() -> Vec<Value> {
    let spec: Value = serde_json::from_str(include_str!(
        "../../docs/proposals/integrated-chat-openapi.json"
    ))
    .expect("checked-in chat contract");
    NAMES.iter().map(|name| {
   let write=*name=="createIntegratedSession";
   let mut properties=json!({"params":{"type":"object","properties":{"agentId":{"type":"string","format":"uuid"}},"required":["agentId"],"additionalProperties":false}});
   let required=if write {
     properties["body"]=super::contracts::inline_schema(&spec,&spec["components"]["schemas"]["CreateIntegratedSession"]);
     properties["actor"]=json!({"type":"object","properties":{"kind":{"enum":["human","agent"]},"id":{"type":["string","null"],"format":"uuid"}},"required":["kind"],"additionalProperties":false});
     properties["expectedVersion"]=json!({"type":"integer","minimum":1});
     properties["idempotencyKey"]=json!({"type":"string","format":"uuid"});
     json!(["params","body","actor","expectedVersion","idempotencyKey"])
   } else {json!(["params"])};
   let data=super::contracts::inline_schema(&spec,&spec["components"]["schemas"][if write {"IntegratedSession"}else{"AgentRuntime"}]);
   json!({"name":name,"description":if write {"Create a Bee Team-owned Codex session for an existing agent. Uses the same version, observed binding and idempotency rules as HTTP. Never takes over an external Desktop chat; active work must finish before replacement. Local runtime must be configured."} else {"Observe an agent's external or integrated mode, active binding and local Codex readiness. Readiness is not proof of end-to-end tool execution."},"annotations":{"readOnlyHint":!write,"destructiveHint":false,"idempotentHint":true,"openWorldHint":write},"inputSchema":{"type":"object","properties":properties,"required":required,"additionalProperties":false},"outputSchema":{"type":"object","properties":{"data":data,"version":{"type":["integer","null"]},"createdId":{"type":["string","null"],"format":"uuid"}},"required":["data","version","createdId"],"additionalProperties":false}})
 }).collect()
}
