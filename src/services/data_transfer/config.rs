use crate::repositories::transfer::archive::Limits;
use anyhow::{ensure, Result};
use std::path::PathBuf;
#[derive(Clone)]
pub struct TransferConfig {
    pub enabled: bool,
    pub directory: PathBuf,
    pub origins: Vec<String>,
    pub limits: Limits,
    pub retention_seconds: i64,
}
impl TransferConfig {
    pub fn from_env() -> Result<Self> {
        let enabled = std::env::var("BEE_TRANSFER_ENABLED").unwrap_or_default() == "true";
        let number = |name: &str, default: u64| -> Result<u64> {
            let value = std::env::var(name)
                .ok()
                .map(|v| v.parse())
                .transpose()?
                .unwrap_or(default);
            ensure!(value > 0, "invalid_transfer_limit");
            Ok(value)
        };
        let defaults = Limits::default();
        let origins: Vec<String> = std::env::var("BEE_TRANSFER_ALLOWED_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
            .collect();
        for origin in &origins {
            let url = url::Url::parse(origin)?;
            ensure!(
                matches!(url.scheme(), "http" | "https")
                    && url.origin().ascii_serialization() == *origin,
                "invalid_transfer_origin"
            );
        }
        Ok(Self {
            enabled,
            directory: std::env::var("BEE_TRANSFER_DIR")
                .unwrap_or_else(|_| ".local/transfers".into())
                .into(),
            origins,
            limits: Limits {
                compressed: number("BEE_TRANSFER_UPLOAD_BYTES", defaults.compressed)?,
                expanded: number("BEE_TRANSFER_EXPANDED_BYTES", defaults.expanded)?,
                entries: usize::try_from(number(
                    "BEE_TRANSFER_MAX_ENTRIES",
                    defaults.entries as u64,
                )?)?,
                line: usize::try_from(number("BEE_TRANSFER_LINE_BYTES", defaults.line as u64)?)?,
                seconds: number("BEE_TRANSFER_TIMEOUT_SECONDS", defaults.seconds)?,
            },
            retention_seconds: i64::try_from(number("BEE_TRANSFER_RETENTION_SECONDS", 86400)?)?,
        })
    }
}
