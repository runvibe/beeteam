//! Read-only reconciliation never resumes or starts a provider turn.
use super::*;
impl CodexIntegratedProvider {
    pub(super) async fn reconcile_native(
        &self,
        target: &SessionDestination,
        turn: &str,
    ) -> Result<ReconciledTurn, SessionFailure> {
        if target.harness != "codex" || turn.is_empty() {
            return Err(fail(
                "invalid_request",
                "Exact Codex thread and turn are required",
                false,
            ));
        }
        let mut wire = Wire::open(&self.executable, &target.project_root).await?;
        let response = wire
            .request(
                "thread/read",
                json!({"threadId":target.external_id,"includeTurns":true}),
            )
            .await?;
        observed(&response["thread"], target, turn)
    }
}
fn observed(
    thread: &Value,
    target: &SessionDestination,
    turn_id: &str,
) -> Result<ReconciledTurn, SessionFailure> {
    if thread["id"] != target.external_id {
        return Err(fail("destination_mismatch", "Read another thread", false));
    }
    let root = std::fs::canonicalize(&target.project_root)
        .map_err(|_| fail("project_mismatch", "Bound project no longer exists", false))?;
    if thread["cwd"]
        .as_str()
        .and_then(|p| std::fs::canonicalize(p).ok())
        .as_ref()
        != Some(&root)
    {
        return Err(fail(
            "project_mismatch",
            "Thread project differs from binding",
            false,
        ));
    }
    let Some(turn) = thread["turns"]
        .as_array()
        .and_then(|turns| turns.iter().find(|turn| turn["id"] == turn_id))
    else {
        return Ok(ReconciledTurn {
            status: ReconciledStatus::Unknown,
            text: None,
        });
    };
    let status = match turn["status"].as_str() {
        Some("completed") => ReconciledStatus::Completed,
        Some("interrupted") => ReconciledStatus::Cancelled,
        Some("failed") => ReconciledStatus::Failed,
        Some("inProgress") => ReconciledStatus::Running,
        _ => ReconciledStatus::Unknown,
    };
    if turn["itemsView"].as_str().is_some_and(|v| v != "full") {
        return Ok(ReconciledTurn {
            status: ReconciledStatus::Unknown,
            text: None,
        });
    }
    let text = turn["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|item| item["type"] == "agentMessage")
        .filter_map(|item| item["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    if text.len() > 1024 * 1024 {
        return Err(fail(
            "reply_too_large",
            "Recovered response exceeds one MiB",
            false,
        ));
    }
    Ok(ReconciledTurn {
        status,
        text: (!text.is_empty()).then_some(text),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_turn_only_and_no_invented_terminal() {
        let root = std::env::temp_dir();
        let target = SessionDestination {
            harness: "codex".into(),
            installation_id: "test".into(),
            external_id: "owned".into(),
            project_root: root.to_string_lossy().into(),
        };
        let mut thread = json!({"id":"owned","cwd":root,"turns":[{"id":"old","status":"completed","items":[{"type":"agentMessage","text":"old text"}]},{"id":"current","status":"inProgress","items":[]}]});
        assert_eq!(
            observed(&thread, &target, "current").unwrap().status,
            ReconciledStatus::Running
        );
        assert_eq!(
            observed(&thread, &target, "missing").unwrap().status,
            ReconciledStatus::Unknown
        );
        let old = observed(&thread, &target, "old").unwrap();
        assert_eq!(old.status, ReconciledStatus::Completed);
        assert_eq!(old.text.as_deref(), Some("old text"));
        thread["id"] = json!("foreign");
        assert!(observed(&thread, &target, "old").is_err());
    }
}
