use serde::Serialize;
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Change {
    Reset,
    Invalidate,
    Heartbeat,
}
#[derive(Serialize)]
pub struct Invalidation {
    pub scope: &'static str,
}
impl Change {
    pub fn event(self) -> &'static str {
        match self {
            Self::Reset => "reset",
            Self::Invalidate => "invalidate",
            Self::Heartbeat => "heartbeat",
        }
    }
    pub fn payload(self) -> Invalidation {
        Invalidation { scope: "all" }
    }
}
