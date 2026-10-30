//! JSON with duplicate-key rejection at every nesting level.
use serde::{
    de::{self, MapAccess, SeqAccess, Visitor},
    Deserialize, Deserializer,
};
use serde_json::{Map, Value};
use std::fmt;
struct Unique(Value);
impl<'de> Deserialize<'de> for Unique {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        d.deserialize_any(V)
    }
}
struct V;
impl<'de> Visitor<'de> for V {
    type Value = Unique;
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "unique-key JSON")
    }
    fn visit_bool<E: de::Error>(self, v: bool) -> Result<Unique, E> {
        Ok(Unique(v.into()))
    }
    fn visit_i64<E: de::Error>(self, v: i64) -> Result<Unique, E> {
        Ok(Unique(v.into()))
    }
    fn visit_u64<E: de::Error>(self, v: u64) -> Result<Unique, E> {
        Ok(Unique(v.into()))
    }
    fn visit_f64<E: de::Error>(self, v: f64) -> Result<Unique, E> {
        serde_json::Number::from_f64(v)
            .map(|n| Unique(n.into()))
            .ok_or_else(|| E::custom("invalid number"))
    }
    fn visit_str<E: de::Error>(self, v: &str) -> Result<Unique, E> {
        Ok(Unique(v.into()))
    }
    fn visit_string<E: de::Error>(self, v: String) -> Result<Unique, E> {
        Ok(Unique(v.into()))
    }
    fn visit_unit<E: de::Error>(self) -> Result<Unique, E> {
        Ok(Unique(Value::Null))
    }
    fn visit_none<E: de::Error>(self) -> Result<Unique, E> {
        self.visit_unit()
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Unique, A::Error> {
        let mut out = Vec::new();
        while let Some(Unique(v)) = a.next_element()? {
            out.push(v)
        }
        Ok(Unique(out.into()))
    }
    fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<Unique, A::Error> {
        let mut out = Map::new();
        while let Some(k) = a.next_key::<String>()? {
            if out.contains_key(&k) {
                return Err(de::Error::custom("duplicate key"));
            }
            let Unique(v) = a.next_value()?;
            out.insert(k, v);
        }
        Ok(Unique(out.into()))
    }
}
pub fn parse(bytes: &[u8]) -> anyhow::Result<Value> {
    let mut d = serde_json::Deserializer::from_slice(bytes);
    let v = Unique::deserialize(&mut d)?;
    d.end()?;
    Ok(v.0)
}
