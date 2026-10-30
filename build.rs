mod build_frontend;
fn main() {
    println!("cargo:rerun-if-changed=migrations");
    println!("cargo:rerun-if-changed=docs/kanban-openapi.yaml");
    println!("cargo:rerun-if-changed=docs/ra-openapi.yaml");
    if std::env::var_os("CARGO_FEATURE_EMBEDDED_UI").is_some() {
        build_frontend::generate();
    }
}
