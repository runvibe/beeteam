use super::*;
pub fn cursor(owner: Uuid, raw: &str) -> Result<String> {
    let (scope, id) = raw
        .split_once(':')
        .ok_or_else(|| Failure::invalid("Invalid cursor"))?;
    if scope != owner.to_string() {
        return Err(Failure::invalid("Foreign cursor"));
    }
    Ok(crate::dto::backend::parse_id(id)?.to_string())
}
fn page(rows: Vec<&Record>, limit: usize, owner: Uuid, kind: &str, ascending: bool) -> Value {
    let mut rows = rows;
    rows.sort_by_key(|r| std::cmp::Reverse(r.id));
    let more = rows.len() > limit;
    rows.truncate(limit);
    let next = if more {
        rows.last().map(|r| format!("{kind}:{owner}:{}", r.id))
    } else {
        None
    };
    if ascending {
        rows.reverse();
    }
    json!({"items":rows.iter().map(|r|public(r)).collect::<Vec<_>>(),"nextCursor":next})
}
impl ManagedAgentService {
    pub async fn read(&self, mut c: Command) -> Result<Value> {
        self.recover().await?;
        if c.operation == "managed:team-approvals" {
            if let Some(value) = c.query.get("limit") {
                if !value.as_u64().is_some_and(|n| (1..=100).contains(&n)) {
                    return Err(Failure::invalid("limit must be 1..100"));
                }
            }
        }
        let owner = c
            .params
            .values()
            .next()
            .ok_or_else(Failure::missing)
            .and_then(|s| crate::dto::backend::parse_id(s))?;
        if let Some(raw) = c.q("cursor").as_str() {
            let kind = c.operation.strip_prefix("managed:").unwrap();
            let raw = raw
                .strip_prefix(&format!("{kind}:"))
                .ok_or_else(|| Failure::invalid("Cursor belongs to another collection"))?;
            let parsed = cursor(owner, raw)?;
            c.query.insert("before".into(), json!(parsed));
        }
        if let Some(raw) = c.q("after").as_str() {
            let parsed = cursor(owner, raw)?;
            c.query.insert("afterId".into(), json!(parsed));
        }
        let u = self.store.read(&c).await?;
        let r = &u.records;
        let limit = c.q("limit").as_u64().unwrap_or(50).clamp(1, 100) as usize;
        let out = match c.operation.as_str() {
            "managed:config" => configuration(r, c.id("agentId")?)?,
            "managed:team-approvals" => {
                r.get("teams", owner)?;
                let mut approvals = r.list("managed_approvals");
                approvals.sort_by_key(|row| std::cmp::Reverse(row.id));
                let more = approvals.len() > limit;
                approvals.truncate(limit);
                let next = if more {
                    approvals
                        .last()
                        .map(|row| format!("team-approvals:{owner}:{}", row.id))
                } else {
                    None
                };
                let items = approvals
                    .into_iter()
                    .map(|approval| {
                        let request = r.get(
                            "managed_requests",
                            approval
                                .reference("requestId")
                                .ok_or_else(Failure::missing)?,
                        )?;
                        let agent = r.get(
                            "agents",
                            approval.reference("agentId").ok_or_else(Failure::missing)?,
                        )?;
                        Ok(TeamManagedApproval {
                            approval: public(approval),
                            request: public(request),
                            agent: ManagedApprovalAgent {
                                id: agent.id,
                                name: agent.data["name"]
                                    .as_str()
                                    .ok_or_else(Failure::missing)?
                                    .to_owned(),
                            },
                        })
                    })
                    .collect::<Result<Vec<_>>>()?;
                json!({"items":items, "nextCursor":next})
            }
            "managed:requests" => {
                r.get("agents", owner)?;
                page(r.list("managed_requests"), limit, owner, "requests", false)
            }
            "managed:conversations" => {
                r.get("agents", owner)?;
                page(
                    r.list("managed_conversations"),
                    limit,
                    owner,
                    "conversations",
                    false,
                )
            }
            "managed:messages" => {
                r.get("managed_conversations", owner)?;
                page(r.list("managed_messages"), limit, owner, "messages", true)
            }
            "managed:snapshot" => {
                let request = r.get("managed_requests", owner)?;
                let latest = r
                    .list("managed_events")
                    .iter()
                    .map(|r| r.id)
                    .max()
                    .unwrap_or_default();
                json!({"request":public(request),"messages":page(r.list("managed_messages"),50,request.reference("conversationId").unwrap(),"messages",true),"approvals":r.list("managed_approvals").iter().map(|r|public(r)).collect::<Vec<_>>(),"eventCursor":format!("{owner}:{latest}")})
            }
            "managed:events" => {
                r.get("managed_requests", owner)?;
                let mut events = r.list("managed_events");
                events.sort_by_key(|r| r.id);
                json!(events
                    .iter()
                    .map(|r| {
                        let mut v = r.data.clone();
                        v.as_object_mut().unwrap().remove("requestId");
                        v
                    })
                    .collect::<Vec<_>>())
            }
            _ => return Err(Failure::invalid("Unknown managed query")),
        };
        u.rollback().await?;
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn collection_cursor_carries_its_kind() {
        let owner = Uuid::now_v7();
        let rows = vec![
            Record::new("managed_requests", json!({})),
            Record::new("managed_requests", json!({})),
        ];
        let requests = page(rows.iter().collect(), 1, owner, "requests", false);
        assert!(requests["nextCursor"]
            .as_str()
            .unwrap()
            .starts_with(&format!("requests:{owner}:")));
        assert!(!requests["nextCursor"]
            .as_str()
            .unwrap()
            .starts_with("conversations:"));
    }
}
