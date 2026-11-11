//! Team session listing and metadata contracts for managed leader conversations.
use crate::dto::backend::{Failure, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

pub const MAX_FILTER_VALUES: usize = 50;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PatchConversation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    pub board_id: Option<Option<Uuid>>,
}

/// Distinguishes an omitted field from an explicit `null`.
fn present<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<Option<Uuid>>, D::Error> {
    let value = Option::<String>::deserialize(deserializer)?;
    value
        .map(|text| canonical(&text).map_err(serde::de::Error::custom))
        .transpose()
        .map(Some)
}

fn canonical(text: &str) -> std::result::Result<Uuid, String> {
    let id = Uuid::parse_str(text).map_err(|e| e.to_string())?;
    if !text.eq_ignore_ascii_case(&id.hyphenated().to_string())
        || id.get_version_num() != 7
        || id.get_variant() != uuid::Variant::RFC4122
    {
        return Err("Bee Team references must be canonical UUIDv7".into());
    }
    Ok(id)
}

pub fn validate_title(title: &str) -> Result<()> {
    if title.trim().is_empty() || title.contains('\0') || title.len() > 200 {
        return Err(Failure::invalid(
            "title must contain text, no NUL and at most 200 UTF-8 bytes",
        ));
    }
    Ok(())
}

impl PatchConversation {
    pub fn validate(&self) -> Result<()> {
        if self.title.is_none() && self.board_id.is_none() {
            return Err(Failure::invalid("Provide title or boardId"));
        }
        if let Some(title) = &self.title {
            validate_title(title)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionSort {
    UpdatedDesc,
    UpdatedAsc,
}

impl SessionSort {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::UpdatedDesc => "updated_desc",
            Self::UpdatedAsc => "updated_asc",
        }
    }
}

/// Board filter entry; `None` matches sessions without a board.
pub type BoardFilter = Option<Uuid>;

#[derive(Debug, Clone)]
pub struct SessionListQuery {
    pub team_ids: Vec<Uuid>,
    pub agent_ids: Vec<Uuid>,
    pub board_ids: Vec<BoardFilter>,
    pub sort: SessionSort,
    pub after: Option<(DateTime<Utc>, Uuid)>,
    pub limit: usize,
}

fn ids(raw: Option<&String>, allow_none: bool) -> Result<Vec<Option<Uuid>>> {
    let Some(raw) = raw else { return Ok(vec![]) };
    let values: Vec<_> = raw.split(',').collect();
    if values.len() > MAX_FILTER_VALUES {
        return Err(Failure::invalid("Too many filter values"));
    }
    values
        .into_iter()
        .map(|value| {
            if allow_none && value == "none" {
                Ok(None)
            } else {
                canonical(value).map(Some).map_err(Failure::invalid)
            }
        })
        .collect()
}

impl SessionListQuery {
    pub fn parse(query: &BTreeMap<String, String>) -> Result<Self> {
        for key in query.keys() {
            if !matches!(
                key.as_str(),
                "teamId" | "agentId" | "boardId" | "sort" | "cursor" | "limit"
            ) {
                return Err(Failure::invalid(format!("Unknown query parameter {key}")));
            }
        }
        let sort = match query.get("sort").map(String::as_str) {
            None | Some("updated_desc") => SessionSort::UpdatedDesc,
            Some("updated_asc") => SessionSort::UpdatedAsc,
            Some(_) => return Err(Failure::invalid("sort must be updated_desc or updated_asc")),
        };
        let limit = match query.get("limit") {
            None => 50,
            Some(raw) => raw
                .parse::<usize>()
                .ok()
                .filter(|n| (1..=100).contains(n))
                .ok_or_else(|| Failure::invalid("limit must be 1..100"))?,
        };
        let after = query
            .get("cursor")
            .map(|raw| parse_cursor(raw, sort))
            .transpose()?;
        Ok(Self {
            team_ids: ids(query.get("teamId"), false)?.into_iter().flatten().collect(),
            agent_ids: ids(query.get("agentId"), false)?.into_iter().flatten().collect(),
            board_ids: ids(query.get("boardId"), true)?,
            sort,
            after,
            limit,
        })
    }
}

pub fn session_cursor(sort: SessionSort, updated_at: DateTime<Utc>, id: Uuid) -> String {
    format!(
        "sessions:{}:{}_{id}",
        sort.as_str(),
        updated_at.to_rfc3339_opts(chrono::SecondsFormat::Nanos, true)
    )
}

fn parse_cursor(raw: &str, sort: SessionSort) -> Result<(DateTime<Utc>, Uuid)> {
    let invalid = || Failure::invalid("Invalid cursor");
    let rest = raw
        .strip_prefix("sessions:")
        .and_then(|r| r.strip_prefix(sort.as_str()))
        .and_then(|r| r.strip_prefix(':'))
        .ok_or_else(|| Failure::invalid("Cursor belongs to another collection or order"))?;
    let (time, id) = rest.rsplit_once('_').ok_or_else(invalid)?;
    let time = DateTime::parse_from_rfc3339(time)
        .map_err(|_| invalid())?
        .with_timezone(&Utc);
    Ok((time, Uuid::parse_str(id).map_err(|_| invalid())?))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn q(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }
    #[test]
    fn parses_filters_and_round_trips_cursor() {
        let id = Uuid::now_v7();
        let parsed = SessionListQuery::parse(&q(&[
            ("teamId", &id.to_string()),
            ("boardId", &format!("none,{id}")),
            ("sort", "updated_asc"),
        ]))
        .unwrap();
        assert_eq!(parsed.team_ids, vec![id]);
        assert_eq!(parsed.board_ids, vec![None, Some(id)]);
        let now = Utc::now();
        let cursor = session_cursor(SessionSort::UpdatedAsc, now, id);
        let next = SessionListQuery::parse(&q(&[("cursor", &cursor), ("sort", "updated_asc")]))
            .unwrap();
        assert_eq!(next.after, Some((now, id)));
        assert!(SessionListQuery::parse(&q(&[("cursor", &cursor)])).is_err());
    }
    #[test]
    fn rejects_unknown_and_invalid_values() {
        assert!(SessionListQuery::parse(&q(&[("teamId", "none")])).is_err());
        assert!(SessionListQuery::parse(&q(&[("sort", "title")])).is_err());
        assert!(SessionListQuery::parse(&q(&[("limit", "0")])).is_err());
        assert!(SessionListQuery::parse(&q(&[("other", "1")])).is_err());
    }
    #[test]
    fn patch_distinguishes_null_board() {
        let clear: PatchConversation = serde_json::from_str(r#"{"boardId":null}"#).unwrap();
        assert_eq!(clear.board_id, Some(None));
        clear.validate().unwrap();
        let empty: PatchConversation = serde_json::from_str("{}").unwrap();
        assert!(empty.validate().is_err());
    }
}
