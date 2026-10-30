use crate::dto::backend::Failure;
impl From<sqlx::Error> for Failure {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(%error,"storage operation failed");
        let code = match &error {
            sqlx::Error::Database(e)
                if matches!(
                    e.code().as_deref(),
                    Some(
                        "23505"
                            | "23503"
                            | "23514"
                            | "19"
                            | "787"
                            | "1555"
                            | "2067"
                            | "275"
                            | "1299"
                            | "1811"
                    )
                ) =>
            {
                "constraint_conflict"
            }
            _ => "storage_unavailable",
        };
        Self::new(code, "Storage operation could not be completed")
    }
}
