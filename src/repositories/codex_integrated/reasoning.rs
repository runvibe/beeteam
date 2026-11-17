//! Accumulates Codex reasoning *summaries* for a single turn.
//!
//! Raw reasoning text (`item/reasoning/textDelta`) is intentionally never stored or
//! surfaced here; only the human-facing summary items are accumulated.

/// Cumulative Codex reasoning *summaries* for one turn; raw reasoning is never stored here.
#[derive(Default)]
pub(super) struct ReasoningSummary {
    items: Vec<(String, Vec<String>)>,
}

impl ReasoningSummary {
    fn parts(&mut self, item: &str, index: usize) -> &mut String {
        let pos = match self.items.iter().position(|(id, _)| id == item) {
            Some(pos) => pos,
            None => {
                self.items.push((item.to_owned(), Vec::new()));
                self.items.len() - 1
            }
        };
        let parts = &mut self.items[pos].1;
        if parts.len() <= index {
            parts.resize(index + 1, String::new());
        }
        &mut parts[index]
    }
    pub(super) fn delta(&mut self, item: &str, index: usize, delta: &str) {
        self.parts(item, index).push_str(delta);
    }
    pub(super) fn part(&mut self, item: &str, index: usize) {
        self.parts(item, index);
    }
    pub(super) fn complete(&mut self, item: &str, summary: Vec<String>) {
        match self.items.iter_mut().find(|(id, _)| id == item) {
            Some((_, parts)) => *parts = summary,
            None => self.items.push((item.to_owned(), summary)),
        }
    }
    pub(super) fn text(&self) -> String {
        self.items
            .iter()
            .flat_map(|(_, parts)| parts.iter())
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n")
    }
    pub(super) fn is_empty(&self) -> bool {
        self.text().is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::ReasoningSummary;

    #[test]
    fn joins_parts_and_items_in_arrival_order() {
        let mut s = ReasoningSummary::default();
        assert!(s.is_empty());
        s.delta("a", 0, "**Plan** ");
        s.delta("a", 0, "steps");
        s.part("a", 1);
        s.delta("a", 1, "Check files");
        s.delta("b", 0, "Next item");
        assert_eq!(s.text(), "**Plan** steps\n\nCheck files\n\nNext item");
    }

    #[test]
    fn completed_item_replaces_streamed_parts() {
        let mut s = ReasoningSummary::default();
        s.delta("a", 0, "partial");
        s.complete("a", vec!["Final one".into(), "Final two".into()]);
        assert_eq!(s.text(), "Final one\n\nFinal two");
    }

    #[test]
    fn empty_parts_are_skipped() {
        let mut s = ReasoningSummary::default();
        s.part("a", 0);
        s.complete("b", vec![String::new()]);
        assert!(s.is_empty());
        assert_eq!(s.text(), "");
    }
}
