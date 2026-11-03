//! Validation of structured scope and declared Git evidence; never accesses paths or remotes.
use super::backend::{Failure, Result};
use serde_json::Value;
use std::collections::BTreeSet;
use url::Url;
fn invalid(message: &str) -> Failure {
    Failure::invalid(message)
}
fn nonblank(v: &Value) -> bool {
    v.as_str()
        .is_some_and(|s| !s.trim().is_empty() && !s.chars().any(char::is_control))
}
pub fn web_url(value: &str) -> Result<Url> {
    if value.chars().any(char::is_control) || value.trim() != value {
        return Err(invalid("URLs cannot contain whitespace/control characters"));
    }
    let url = Url::parse(value).map_err(|_| invalid("Expected absolute HTTP(S) URL"))?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(invalid(
            "Web URLs require HTTP(S), host, no credentials, query or fragment",
        ));
    }
    Ok(url)
}
fn remote_url(value: &str) -> Result<()> {
    if value.chars().any(char::is_control) || value.trim() != value {
        return Err(invalid("Invalid remote URL"));
    }
    if value.starts_with("http://") || value.starts_with("https://") {
        web_url(value)?;
        return Ok(());
    }
    if let Ok(url) = Url::parse(value) {
        if url.scheme() == "ssh"
            && url.host_str().is_some()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none()
        {
            return Ok(());
        }
    }
    if regex::Regex::new(r"^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$")
        .unwrap()
        .is_match(value)
    {
        return Ok(());
    }
    Err(invalid("Remote must be credential-free HTTP(S), password-free SSH or scp-style SSH; use null for a local repository without remote"))
}
pub fn repository(v: &Value) -> Result<()> {
    if !nonblank(&v["name"]) {
        return Err(invalid("Repository name cannot be blank"));
    }
    if let Some(url) = v["remoteUrl"].as_str() {
        remote_url(url)?;
    }
    if let Some(url) = v["webUrl"].as_str() {
        web_url(url)?;
    }
    Ok(())
}
pub fn scope(v: &Value) -> Result<()> {
    let projects = v["projects"]
        .as_array()
        .ok_or_else(|| invalid("workScope.projects required"))?;
    let repos = v["repositories"]
        .as_array()
        .ok_or_else(|| invalid("workScope.repositories required"))?;
    if v["status"] == "not_applicable" && (!projects.is_empty() || !repos.is_empty()) {
        return Err(invalid(
            "not_applicable scope must have empty projects and repositories",
        ));
    }
    if v["status"] == "identified" && projects.is_empty() {
        return Err(invalid("identified scope needs at least one project"));
    }
    let mut keys = BTreeSet::new();
    for p in projects {
        if !nonblank(&p["name"])
            || !nonblank(&p["rootPath"])
            || !keys.insert(p["key"].as_str().unwrap_or(""))
        {
            return Err(invalid(
                "Projects need distinct keys, names and absolute checkout roots",
            ));
        }
        let path = p["rootPath"].as_str().unwrap();
        let bytes = path.as_bytes();
        if !(path.starts_with('/')
            || path.starts_with("\\\\")
            || (bytes.len() > 2
                && bytes[0].is_ascii_alphabetic()
                && bytes[1] == b':'
                && matches!(bytes[2], b'/' | b'\\')))
        {
            return Err(invalid(
                "rootPath must be an absolute checkout root, not a changed file list",
            ));
        }
    }
    let mut repo_keys = BTreeSet::new();
    for r in repos {
        repository(r)?;
        if !repo_keys.insert(r["key"].as_str().unwrap_or("")) {
            return Err(invalid("Repository keys must be distinct"));
        }
        for key in r["projectKeys"]
            .as_array()
            .ok_or_else(|| invalid("Repository projectKeys required"))?
        {
            if !keys.contains(key.as_str().unwrap_or("")) {
                return Err(invalid(
                    "Repository projectKeys must resolve in workScope.projects",
                ));
            }
        }
    }
    Ok(())
}
/// Invoked after replay lookup; absence in old stored summaries is never rewritten as false.
pub fn require_commit_report(body: &Value) -> Result<()> {
    let r = &body["commitReport"];
    let has=r["hasCommits"].as_bool().ok_or_else(||invalid("Every new summary requires commitReport.hasCommits boolean and commits array; false means no commits, not missing evidence"))?;
    let commits = r["commits"]
        .as_array()
        .ok_or_else(|| invalid("commitReport.commits is required"))?;
    if has == commits.is_empty() {
        return Err(invalid(
            "hasCommits=true requires references; false requires an empty commits array",
        ));
    }
    Ok(())
}
pub fn commit(v: &Value, repository: &Value) -> Result<()> {
    self::repository(repository)?;
    match v["branch"]["state"].as_str() {
        Some("named") if nonblank(&v["branch"]["name"]) => {}
        Some("detached" | "unknown") if v["branch"]["name"].is_null() => {}
        _ => {
            return Err(invalid(
                "Named branch requires its historical name; detached/unknown requires name=null",
            ))
        }
    }
    let published = v["availability"] == "published";
    if published {
        chrono::DateTime::parse_from_rfc3339(v["remoteVerifiedAt"].as_str().unwrap_or(""))
            .map_err(|_| {
                invalid(
                    "Published availability requires remoteVerifiedAt from an actual verification",
                )
            })?;
    } else if !v["remoteVerifiedAt"].is_null() || !v["commitUrl"].is_null() {
        return Err(invalid(
            "Local/unknown commits cannot claim remote verification or expose a commit link",
        ));
    }
    if let Some(link) = v["commitUrl"].as_str() {
        let actual = web_url(link)?;
        let mut expected = web_url(
            repository["webUrl"]
                .as_str()
                .ok_or_else(|| invalid("Commit link requires explicit repository webUrl"))?,
        )?;
        let suffix = match repository["provider"].as_str() {
            Some("github") => "commit",
            Some("gitlab") => "-/commit",
            _ => {
                return Err(invalid(
                    "Commit links require an explicitly identified GitHub or GitLab provider",
                ))
            }
        };
        let hash = v["hash"].as_str().unwrap_or("").to_ascii_lowercase();
        expected.set_path(&format!(
            "{}/{suffix}/{hash}",
            expected.path().trim_end_matches('/')
        ));
        if actual != expected {
            return Err(invalid(
                "Commit URL must match the configured repository host/path and full commit hash",
            ));
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn unsafe_web_and_remote_urls_are_rejected() {
        for u in [
            "javascript:alert(1)",
            "https://token@github.com/a/b",
            "https://git:secret@host/a",
            "https://host/a?token=x",
            "https://host/a#fragment",
            "https://ho\nst/a",
        ] {
            assert!(web_url(u).is_err(), "{u}");
        }
        for u in [
            "ssh://git:secret@host/a",
            "ext::sh command",
            "file:///private/repo",
        ] {
            assert!(remote_url(u).is_err(), "{u}");
        }
        for u in [
            "git@github.com:a/b.git",
            "ssh://git@git.example:2222/a/b.git",
            "https://github.com/a/b.git",
        ] {
            assert!(remote_url(u).is_ok(), "{u}");
        }
    }
    #[test]
    fn local_detached_and_self_hosted_published_links_remain_distinct() {
        let r = json!({"name":"Repo","provider":"gitlab","remoteUrl":"git@git.example:group/repo.git","webUrl":"https://git.example/group/repo"});
        let mut c = json!({"branch":{"state":"detached","name":null},"hash":"a".repeat(40),"availability":"local","remoteVerifiedAt":null,"commitUrl":null});
        assert!(commit(&c, &r).is_ok());
        c["commitUrl"] = json!(format!(
            "https://git.example/group/repo/-/commit/{}",
            "a".repeat(40)
        ));
        assert!(commit(&c, &r).is_err());
        c["availability"] = json!("published");
        c["remoteVerifiedAt"] = json!("2026-11-03T00:00:00Z");
        assert!(commit(&c, &r).is_ok());
        c["commitUrl"] = json!(format!(
            "https://evil.example/group/repo/-/commit/{}",
            "a".repeat(40)
        ));
        assert!(commit(&c, &r).is_err());
    }
    #[test]
    fn github_links_require_exact_repository_hash_and_no_credentials() {
        let repo = json!({"name":"GitHub","provider":"github","remoteUrl":"git@github.com:org/repo.git","webUrl":"https://github.com/org/repo"});
        let hash = "a".repeat(40);
        let mut c = json!({"branch":{"state":"named","name":"main"},"hash":hash,"availability":"published","remoteVerifiedAt":"2026-11-03T00:00:00Z","commitUrl":format!("https://github.com/org/repo/commit/{hash}")});
        assert!(commit(&c, &repo).is_ok());
        for url in [
            format!("https://github.com/other/repo/commit/{hash}"),
            format!("https://github.com/org/repo/commit/{}", "b".repeat(40)),
            format!("https://token@github.com/org/repo/commit/{hash}"),
            format!("https://github.com/org/repo/commit/{hash}?token=secret"),
            format!("https://github.com/org/repo/commit/{hash}#fragment"),
        ] {
            c["commitUrl"] = json!(url);
            assert!(commit(&c, &repo).is_err());
        }
        c["commitUrl"] = Value::Null;
        assert!(commit(&c, &repo).is_ok());
    }
}
