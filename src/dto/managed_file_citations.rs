//! Presentation-safe references to files mentioned by the integrated provider.
use pulldown_cmark::{Event, Parser, Tag};
use regex::Regex;
use sha2::{Digest, Sha256};
use std::{ops::Range, sync::OnceLock};

#[derive(Debug, Clone)]
pub struct Citation {
    pub index: usize,
    pub key: String,
    pub path: Option<String>,
    pub name: String,
}

fn pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| Regex::new(r#":codex-file-citation\{[^\r\n}]*\}"#).unwrap())
}

fn attribute() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| Regex::new(r#"([a-zA-Z_][a-zA-Z0-9_-]*)=("(?:\\.|[^"\\])*")"#).unwrap())
}

fn output_path(raw: &str) -> Option<String> {
    let attrs = raw
        .strip_prefix(":codex-file-citation{")?
        .strip_suffix('}')?;
    let mut position = 0;
    let mut path = None;
    let mut purpose = None;
    for captures in attribute().captures_iter(attrs) {
        let found = captures.get(0)?;
        let separator = &attrs[position..found.start()];
        if (position != 0 && separator.is_empty())
            || !separator.chars().all(|c| matches!(c, ' ' | '\t'))
        {
            return None;
        }
        let value = serde_json::from_str::<String>(&captures[2]).ok()?;
        match &captures[1] {
            "path" if path.is_none() => path = Some(value),
            "purpose" if purpose.is_none() => purpose = Some(value),
            "path" | "purpose" => return None,
            _ => {}
        }
        position = found.end();
    }
    if !attrs[position..].chars().all(|c| matches!(c, ' ' | '\t'))
        || purpose.as_deref() != Some("output")
    {
        return None;
    }
    path
}

fn is_code(position: usize, ranges: &[Range<usize>]) -> bool {
    ranges.iter().any(|r| r.contains(&position))
}

fn key(raw: &str) -> String {
    Sha256::digest(raw.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn filename(path: Option<&str>) -> String {
    let name = path
        .and_then(|p| p.rsplit(['/', '\\']).next())
        .filter(|s| !s.is_empty())
        .unwrap_or("file");
    let name: String = name.chars().filter(|c| !c.is_control()).take(200).collect();
    if name.is_empty() {
        "file".into()
    } else {
        name
    }
}

/// Keep the persisted source intact while removing provider-local paths from presentation.
pub fn project(source: &str) -> (String, Vec<Citation>) {
    let ranges: Vec<_> = Parser::new(source)
        .into_offset_iter()
        .filter_map(|(event, range)| match event {
            Event::Code(_) | Event::Start(Tag::CodeBlock(_)) => Some(range),
            _ => None,
        })
        .collect();
    let mut output = String::new();
    let mut citations = Vec::new();
    let mut marker_ranges = Vec::new();
    let prefix = ":codex-file-citation{";
    let mut position = 0;
    let mut search = 0;
    while let Some(offset) = source[search..].find(prefix) {
        let start = search + offset;
        if is_code(start, &ranges) {
            search = start + prefix.len();
            continue;
        }
        let candidate = pattern()
            .find_at(source, start)
            .filter(|m| m.start() == start);
        let path = candidate.and_then(|m| output_path(m.as_str()));
        let end = if path.is_some() {
            candidate.unwrap().end()
        } else {
            source[start..]
                .find('\n')
                .map_or(source.len(), |n| start + n)
        };
        let index = citations.len();
        output.push_str(&source[position..start]);
        let marker_start = output.len();
        output.push_str(&format!(":beeteam-file-citation{{index={index}}}"));
        marker_ranges.push(marker_start..output.len());
        citations.push(Citation {
            index,
            key: key(&source[start..end]),
            name: filename(path.as_deref()),
            path,
        });
        position = end;
        search = end;
    }
    output.push_str(&source[position..]);
    const NOTICE: &str = "\n[Response shortened to the 65536-byte display limit.]";
    if output.len() > 65536 {
        let mut end = 65536 - NOTICE.len();
        while !output.is_char_boundary(end) {
            end -= 1;
        }
        if let Some(marker) = marker_ranges.iter().find(|r| r.start < end && r.end > end) {
            end = marker.start;
        }
        citations.truncate(marker_ranges.iter().take_while(|r| r.end <= end).count());
        output.truncate(end);
        output.push_str(NOTICE);
    }
    (output, citations)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_output_paths_and_keeps_code_examples_unchanged() {
        let source = "A\n\n:codex-file-citation{path=\"/work/output/a.pdf\" purpose=\"output\"}\n\n`:codex-file-citation{path=\"demo\" purpose=\"output\"}`";
        let (content, refs) = project(source);
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].name, "a.pdf");
        assert_eq!(refs[0].path.as_deref(), Some("/work/output/a.pdf"));
        assert!(!content.contains("/work/output/a.pdf"));
        assert!(content.contains("`:codex-file-citation{path=\"demo\" purpose=\"output\"}`"));
    }

    #[test]
    fn decodes_json_escaped_windows_output_paths() {
        let source = r#"Download :codex-file-citation{path="C:\\Users\\Example Name\\output\\report.pdf" purpose="output"}"#;
        let (content, citations) = project(source);
        assert_eq!(citations.len(), 1);
        assert_eq!(
            citations[0].path.as_deref(),
            Some(r"C:\Users\Example Name\output\report.pdf")
        );
        assert_eq!(citations[0].name, "report.pdf");
        assert_eq!(content, "Download :beeteam-file-citation{index=0}");
    }

    #[test]
    fn hides_incomplete_references_while_streaming() {
        let (content, refs) = project("Preparing\n\n:codex-file-citation{path=\"/secret");
        assert!(!content.contains("/secret"));
        assert_eq!(refs.len(), 1);
        assert!(refs[0].path.is_none());
    }

    #[test]
    fn only_exact_unambiguous_output_attributes_are_read() {
        assert_eq!(
            output_path(r#":codex-file-citation{purpose="output" path="output/a.pdf"}"#).as_deref(),
            Some("output/a.pdf")
        );
        assert!(
            output_path(r#":codex-file-citation{path="output/a.pdf" otherpurpose="output"}"#)
                .is_none()
        );
        assert!(output_path(
            r#":codex-file-citation{path="output/a.pdf" purpose="input" purpose="output"}"#
        )
        .is_none());
        assert!(output_path(
            r#":codex-file-citation{path="output/a.pdf" extra="purpose=\"output\""}"#
        )
        .is_none());
    }

    #[test]
    fn incomplete_reference_does_not_hide_following_lines() {
        let (content, _) = project("Start\n:codex-file-citation{path=\"/secret\nNext");
        assert!(!content.contains("/secret"));
        assert!(content.ends_with("\nNext"));
    }

    #[test]
    fn incomplete_reference_before_a_complete_reference_is_redacted() {
        let source = "First :codex-file-citation{path=\"/secret\nNext :codex-file-citation{path=\"output/a.pdf\" purpose=\"output\"}";
        let (content, refs) = project(source);
        assert!(!content.contains("/secret"));
        assert!(content.contains("Next "));
        assert_eq!(refs.len(), 2);
    }

    #[test]
    fn projected_content_respects_message_byte_limit() {
        let source = format!("{}:codex-file-citation{{", "x".repeat(65536 - 21));
        assert!(source.len() <= 65536);
        let (content, _) = project(&source);
        assert!(content.len() <= 65536);
    }
}
