//! Direct-local transport policy for process-executing integrations, not authentication.
use crate::{
    config::{AppConfig, CorsConfig},
    dto::backend::Failure,
};
use axum::{
    extract::{ConnectInfo, Request, State},
    http::{uri::Authority, HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::net::{IpAddr, SocketAddr};
#[derive(Clone)]
pub(super) struct Policy {
    bound_local: bool,
    api_origins: Vec<String>,
    mcp_origins: Vec<String>,
    mcp_path: String,
    only_api: bool,
}
impl Policy {
    pub(super) fn new(config: &AppConfig, only_api: bool) -> Self {
        fn exact(cors: &CorsConfig) -> Vec<String> {
            match cors {
                CorsConfig::Restricted(origins) => origins
                    .iter()
                    .filter(|o| o.as_str() != "*")
                    .cloned()
                    .collect(),
                CorsConfig::Permissive => vec![],
            }
        }
        Self {
            bound_local: config.host.is_loopback(),
            api_origins: exact(&config.cors),
            mcp_origins: exact(&config.mcp.cors),
            mcp_path: config.mcp.path.clone(),
            only_api,
        }
    }
    fn mcp(&self, path: &str) -> bool {
        path == self.mcp_path || path.starts_with(&format!("{}/", self.mcp_path))
    }
}
fn local_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host
            .trim_matches(['[', ']'])
            .parse::<IpAddr>()
            .is_ok_and(|ip| ip.is_loopback())
}
pub(super) fn allowed(
    bound_local: bool,
    peer: Option<SocketAddr>,
    headers: &HeaderMap,
    trusted_origins: &[String],
) -> bool {
    if !bound_local
        || !peer.is_some_and(|p| p.ip().is_loopback())
        || headers
            .keys()
            .any(|k| k == "forwarded" || k.as_str().starts_with("x-forwarded-") || k == "x-real-ip")
        || headers.get_all("host").iter().count() != 1
        || headers.get_all("origin").iter().count() > 1
    {
        return false;
    }
    let host_ok = headers
        .get("host")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.parse::<Authority>().ok())
        .is_some_and(|a| local_host(a.host()));
    let origin_ok = headers.get("origin").is_none_or(|origin| {
        origin.to_str().ok().is_some_and(|raw| {
            url::Url::parse(raw).ok().is_some_and(|o| {
                matches!(o.scheme(), "http" | "https")
                    && o.username().is_empty()
                    && o.password().is_none()
                    && o.query().is_none()
                    && o.fragment().is_none()
                    && o.path() == "/"
                    && (o.host_str().is_some_and(local_host)
                        || trusted_origins.iter().any(|trusted| trusted == raw))
            })
        })
    });
    host_ok && origin_ok
}
pub(super) async fn enforce(
    State(policy): State<Policy>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path();
    let is_mcp = policy.mcp(path);
    if policy.only_api && !path.starts_with("/api/") && !is_mcp {
        return next.run(request).await;
    }
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|p| p.0);
    let origins = if is_mcp {
        &policy.mcp_origins
    } else {
        &policy.api_origins
    };
    if !allowed(policy.bound_local, peer, request.headers(), origins) {
        return (
            StatusCode::FORBIDDEN,
            Json(Failure::new(
                "local_action_forbidden",
                "Integrated execution requires direct local access from a trusted origin.",
            )),
        )
            .into_response();
    }
    next.run(request).await
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_untrusted_origin_rebinding_forwarding_public_listener_and_missing_peer() {
        let peer = Some("127.0.0.1:40000".parse().unwrap());
        let mut h = HeaderMap::new();
        h.insert("host", "127.0.0.1:59865".parse().unwrap());
        assert!(allowed(true, peer, &h, &[]));
        assert!(!allowed(false, peer, &h, &[]));
        assert!(!allowed(true, None, &h, &[]));
        assert!(!allowed(
            true,
            Some("192.0.2.1:9".parse().unwrap()),
            &h,
            &[]
        ));
        h.insert("origin", "https://evil.example".parse().unwrap());
        assert!(!allowed(true, peer, &h, &[]));
        assert!(!allowed(true, peer, &h, &["*".into()]));
        assert!(allowed(true, peer, &h, &["https://evil.example".into()]));
        h.insert("origin", "http://localhost:5176".parse().unwrap());
        assert!(allowed(true, peer, &h, &[]));
        h.insert("host", "attacker.example:59865".parse().unwrap());
        assert!(!allowed(true, peer, &h, &[]));
        h.insert("host", "[::1]:59865".parse().unwrap());
        assert!(allowed(true, peer, &h, &[]));
        h.insert("x-forwarded-for", "127.0.0.1".parse().unwrap());
        assert!(!allowed(true, peer, &h, &[]));
        h.remove("x-forwarded-for");
        h.append("origin", "http://localhost:5177".parse().unwrap());
        assert!(!allowed(true, peer, &h, &[]));
    }
}
