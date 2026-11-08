use super::backend::{Failure, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Session {
    #[serde(default = "external_mode")]
    pub mode: String,
    pub harness: String,
    pub installation_id: String,
    pub external_id: String,
    pub project_root: String,
}
fn external_mode() -> String {
    "external".into()
}
impl Session {
    pub fn validate(&self) -> Result<()> {
        if self.mode != "external" {
            return Err(Failure::invalid("Declared sessions must use external mode; create a Bee Team-owned session for integrated mode"));
        }
        for value in [&self.installation_id, &self.external_id, &self.project_root] {
            if value.trim().is_empty() || value.trim() != value || value.contains('\0') {
                return Err(Failure::invalid("Session identifiers must be nonblank and contain no surrounding whitespace/NUL"));
            }
        }
        let path = &self.project_root;
        let bytes = path.as_bytes();
        if !(path.starts_with('/')
            || path.starts_with("\\\\")
            || (bytes.len() > 2
                && bytes[0].is_ascii_alphabetic()
                && bytes[1] == b':'
                && matches!(bytes[2], b'/' | b'\\')))
        {
            return Err(Failure::invalid("projectRoot must be absolute"));
        }
        Ok(())
    }
}
