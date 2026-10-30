use serde_json::{json, Value};
pub const NAMES: &[&str] = &[
    "exportData",
    "getDataTransfer",
    "previewDataImport",
    "restoreDataImport",
    "cancelDataTransfer",
];
pub fn tools() -> Vec<Value> {
    NAMES.iter().map(|name|{
        let mutation=matches!(*name,"exportData"|"restoreDataImport"|"cancelDataTransfer");
        let mut properties=serde_json::Map::new();let mut required=Vec::new();
        if *name!="exportData" {properties.insert("jobId".into(),json!({"type":"string","format":"uuid"}));required.push("jobId");}
        if mutation{properties.insert("idempotencyKey".into(),json!({"type":"string","format":"uuid"}));required.push("idempotencyKey");}
        if *name=="restoreDataImport"{properties.insert("confirmation".into(),json!({"type":"object","additionalProperties":false,"properties":{"confirmationToken":{"type":"string","format":"uuid"},"archiveSha256":{"type":"string","pattern":"^[a-f0-9]{64}$"},"destinationId":{"type":"string","format":"uuid"},"timestampPolicy":{"enum":["strict","truncate_to_microseconds"]}},"required":["confirmationToken","archiveSha256","destinationId"]}));required.push("confirmation");}
        json!({"name":name,"description":"Portable data transfer administration. Imports must first be uploaded through HTTP; job IDs never denote filesystem paths. Restores require an empty destination and the preview confirmation. No authentication is implied.","annotations":{"readOnlyHint":!mutation,"destructiveHint":*name=="restoreDataImport","idempotentHint":true,"openWorldHint":false},"inputSchema":{"type":"object","properties":properties,"required":required,"additionalProperties":false}})
    }).collect()
}
