#![cfg(feature = "mcp")]
#[test]
fn integrated_bootstrap_is_advertised_without_claiming_external_control() {
    let catalog = beeteam::routes::mcp::catalog();
    let tools = catalog["tools"].as_array().unwrap();
    for name in ["getAgentRuntime", "createIntegratedSession"] {
        let tool = tools
            .iter()
            .find(|tool| tool["name"] == name)
            .expect("integrated tool missing");
        jsonschema::validator_for(&tool["inputSchema"]).unwrap();
        jsonschema::validator_for(&tool["outputSchema"]).unwrap();
    }
}
