use crate::{dto::frontend::Asset, repositories::frontend};
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum FrontendMode {
    Embedded,
    Disabled,
}
impl Default for FrontendMode {
    fn default() -> Self {
        if cfg!(feature = "embedded-ui") {
            Self::Embedded
        } else {
            Self::Disabled
        }
    }
}
impl FrontendMode {
    pub fn parse(value: &str) -> anyhow::Result<Self> {
        match value {
            "embedded" if cfg!(feature = "embedded-ui") => Ok(Self::Embedded),
            "disabled" => Ok(Self::Disabled),
            "embedded" => {
                anyhow::bail!("BEE_FRONTEND_MODE=embedded requires a binary built with embedded-ui")
            }
            _ => anyhow::bail!("BEE_FRONTEND_MODE must be embedded or disabled"),
        }
    }
    pub fn from_env() -> anyhow::Result<Self> {
        std::env::var("BEE_FRONTEND_MODE")
            .map(|v| Self::parse(&v))
            .unwrap_or_else(|_| Ok(Self::default()))
    }
}
pub fn asset(name: &str) -> Option<Asset> {
    frontend::find(name)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn modes_are_explicit() {
        assert!(FrontendMode::parse("invalid").is_err());
        assert_eq!(
            FrontendMode::parse("disabled").unwrap(),
            FrontendMode::Disabled
        );
        assert_eq!(
            FrontendMode::parse("embedded").is_ok(),
            cfg!(feature = "embedded-ui")
        );
    }
}
