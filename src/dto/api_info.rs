//! Public compatibility discovery. No host configuration or persisted data.
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ApiInfo {
    /// Installed software version; does not imply availability of any feature.
    pub api_version: String,
    /// Supported HTTP contract versions, independent of software version.
    pub supported_contract_versions: Vec<String>,
    /// Stable enabled capability identifiers. Clients must ignore unknown identifiers.
    pub capabilities: Vec<String>,
}
