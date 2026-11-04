//! English editorial metadata for MCP only. Shared HTTP contracts and user data stay intact.
use serde_json::Value;
use std::{collections::BTreeMap, sync::LazyLock};

static ENGLISH: LazyLock<BTreeMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("mcp_english.json")).expect("valid MCP editorial translations")
});

pub fn translate_metadata(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, value) in map {
                // Contract literals are not editorial metadata, even when they contain prose keys.
                if matches!(key.as_str(), "enum" | "const" | "default" | "example" | "examples") {
                    continue;
                }
                if matches!(key.as_str(), "description" | "title") {
                    if let Some(english) = value.as_str().and_then(|text| ENGLISH.get(text)) {
                        *value = Value::String(english.clone());
                        continue;
                    }
                }
                translate_metadata(value);
            }
        }
        Value::Array(items) => items.iter_mut().for_each(translate_metadata),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn translates_only_editorial_text_and_preserves_contract_literals() {
        let original = json!({"description":"Autoria declarada; sem autenticação ou prova de identidade.","type":"object","properties":{"description":{"type":"string","maxLength":10}},"required":["description"],"const":{"description":"Autoria declarada; sem autenticação ou prova de identidade."},"default":{"title":"Não traduzir"},"examples":[{"description":"Não traduzir"}],"enum":["Não traduzir"]});
        let mut translated = original.clone();
        translate_metadata(&mut translated);
        assert_eq!(translated["description"], "Declared authorship; no authentication or proof of identity.");
        translated["description"] = original["description"].clone();
        assert_eq!(translated, original);
    }
}
