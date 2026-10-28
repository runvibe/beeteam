fn main() {
    println!("cargo:rerun-if-changed=migrations");
    println!("cargo:rerun-if-changed=docs/kanban-openapi.yaml");
    println!("cargo:rerun-if-changed=docs/ra-openapi.yaml");
}
