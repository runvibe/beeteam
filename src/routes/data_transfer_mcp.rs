use crate::{
    dto::{
        backend::{Failure, Result},
        data_transfer::RestoreRequest,
    },
    services::data_transfer::service::public_error,
    state::AppState,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Arguments {
    job_id: Option<Uuid>,
    idempotency_key: Option<Uuid>,
    confirmation: Option<RestoreRequest>,
}
pub async fn call(state: &AppState, name: &str, args: Value) -> Result<Value> {
    let args: Arguments =
        serde_json::from_value(args).map_err(|_| Failure::invalid("Invalid transfer arguments"))?;
    let service = state
        .transfers()
        .ok_or_else(|| Failure::new("transfer_disabled", "transfer_disabled"))?;
    let id = || {
        args.job_id
            .ok_or_else(|| Failure::invalid("jobId required"))
    };
    let key = || {
        args.idempotency_key
            .ok_or_else(|| Failure::invalid("idempotencyKey required"))
    };
    let result = match name {
        "exportData" => service.export(key()?).await.map(|v| json!(v)),
        "getDataTransfer" => service.status(id()?).await.map(|v| json!(v)),
        "previewDataImport" => service.status(id()?).await.and_then(|v| {
            v.preview
                .map(|p| json!(p))
                .ok_or_else(|| anyhow::anyhow!("preview_missing"))
        }),
        "restoreDataImport" => service
            .restore(
                id()?,
                key()?,
                args.confirmation
                    .ok_or_else(|| Failure::invalid("confirmation required"))?,
            )
            .await
            .map(|v| json!(v)),
        "cancelDataTransfer" => service.cancel(id()?, key()?).await.map(|v| json!(v)),
        _ => return Err(Failure::missing()),
    };
    result.map_err(|e| {
        let code = public_error(&e);
        let mut failure = Failure::new(&code, code.clone());
        if let Some(busy) = e.downcast_ref::<crate::repositories::transfer::jobs::Busy>() {
            failure.details = json!({"activeJobId":busy.active_job});
        }
        failure
    })
}
