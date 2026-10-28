#[cfg(feature = "mcp")]
fn main() {
    println!(
        "{}",
        serde_json::to_string_pretty(&beeteam::routes::mcp::catalog()).unwrap()
    );
}
#[cfg(not(feature = "mcp"))]
fn main() {
    eprintln!("Use cargo run --features mcp --example mcp_catalog");
    std::process::exit(1);
}
