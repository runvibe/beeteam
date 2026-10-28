//! Build-time verified, immutable bytes. No runtime filesystem dependency.
use crate::dto::frontend::Asset;
#[cfg(feature = "embedded-ui")]
include!(concat!(env!("OUT_DIR"), "/frontend_assets.rs"));
#[cfg(not(feature = "embedded-ui"))]
pub static ASSETS: &[Asset] = &[];
pub fn find(path: &str) -> Option<Asset> {
    ASSETS.iter().find(|a| a.path == path).copied()
}
