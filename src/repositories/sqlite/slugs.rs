use unicode_normalization::UnicodeNormalization;
pub(super) fn base(label: &str, fallback: &str) -> String {
    let normalized = label
        .nfkd()
        .collect::<String>()
        .to_lowercase()
        .replace('\u{00df}', "ss")
        .replace('\u{00e6}', "ae")
        .replace('\u{0153}', "oe");
    let mut base = String::new();
    for ch in normalized
        .chars()
        .filter(|c| !(('\u{0300}'..='\u{036f}').contains(c)))
    {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            base.push(ch);
        } else if !base.is_empty() && !base.ends_with('-') {
            base.push('-');
        }
    }
    let mut base = base.trim_end_matches('-').to_owned();
    if base.is_empty() {
        base = fallback.into();
    }
    if [
        "new", "edit", "create", "by-slug", "resolve", "search", "archive", "settings", "api",
        "mcp", "agents", "teams", "tasks",
    ]
    .contains(&base.as_str())
        || (base.len() == 36 && uuid::Uuid::parse_str(&base).is_ok())
    {
        base = format!("{fallback}-{base}");
    }
    base.truncate(base.len().min(80));
    base.trim_end_matches('-').to_owned()
}
