use crate::dto::frontend::Asset;
use axum::{
    body::Body,
    http::{header, HeaderMap, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
};
pub async fn respond(method: Method, uri: Uri, headers: HeaderMap, mcp_path: String) -> Response {
    let Some(asset) = select(uri.path(), &mcp_path) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if method != Method::GET && method != Method::HEAD {
        return (
            StatusCode::METHOD_NOT_ALLOWED,
            [(header::ALLOW, "GET, HEAD")],
        )
            .into_response();
    }
    let not_modified = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|h| h.to_str().ok())
        .is_some_and(|s| {
            s.split(',').any(|v| {
                let v = v.trim();
                v == "*" || v.strip_prefix("W/").unwrap_or(v) == asset.etag
            })
        });
    let mut response = Response::new(if method == Method::HEAD || not_modified {
        Body::empty()
    } else {
        Body::from(asset.bytes)
    });
    *response.status_mut() = if not_modified {
        StatusCode::NOT_MODIFIED
    } else {
        StatusCode::OK
    };
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, mime(asset.path).parse().unwrap());
    headers.insert(header::ETAG, asset.etag.parse().unwrap());
    headers.insert(
        header::CACHE_CONTROL,
        if asset.immutable {
            "public, max-age=31536000, immutable"
        } else {
            "no-cache"
        }
        .parse()
        .unwrap(),
    );
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
    if !not_modified {
        headers.insert(
            header::CONTENT_LENGTH,
            asset.bytes.len().to_string().parse().unwrap(),
        );
    }
    response
}
fn mime(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "txt" => "text/plain; charset=utf-8",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn prefix(path: &str, root: &str) -> bool {
    path == root
        || path
            .strip_prefix(root)
            .is_some_and(|tail| tail.starts_with('/'))
}
fn select(path: &str, mcp_path: &str) -> Option<Asset> {
    // Protocol namespaces win even when a configurable MCP path overlaps a UI path.
    if ["/api", "/mcp", "/docs", "/openapi", "/health"]
        .iter()
        .any(|p| prefix(path, p))
        || prefix(path, mcp_path)
    {
        return None;
    }
    if path.contains('%') || path.contains('\\') || path.split('/').any(|s| s == "." || s == "..") {
        return None;
    }
    if let Some(asset) = crate::services::frontend::asset(path) {
        return Some(asset);
    }
    if path == "/" {
        return crate::services::frontend::asset("/index.html");
    }
    let parts: Vec<_> = path
        .trim_end_matches('/')
        .strip_prefix('/')?
        .split('/')
        .collect();
    let known = match parts.as_slice() {
        ["boards" | "agents" | "teams"] => true,
        ["boards" | "agents" | "teams" | "tasks", id] => alias(id),
        ["boards" | "agents" | "teams", id, "settings"] => alias(id),
        _ => false,
    };
    known
        .then(|| crate::services::frontend::asset("/index.html"))
        .flatten()
}
fn alias(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
}
