#!/usr/bin/env python3
"""Minimal App Server fixture for access-policy protocol tests."""
import json
import os
import sys

root = os.getcwd()
namespace = None
developer_instructions = None
resume_config = None


def send(value):
    print(json.dumps(value), flush=True)


for line in sys.stdin:
    request = json.loads(line)
    method = request.get("method")
    if "id" not in request:
        continue
    ident = request["id"]
    params = request.get("params", {})
    result = {}
    error = None
    if method == "config/read":
        if params.get("cwd") != root or root.endswith("invalid"):
            error = {"code": -32603, "message": "fixture config error"}
        elif root.endswith("guidance"):
            result = {"config": {"developer_instructions": "Existing user instructions"}}
        elif root.endswith("summary"):
            result = {"config": {"model_reasoning_summary": "concise"}}
        elif root.endswith("malformed"):
            result = {"config": {"developer_instructions": ["invalid"]}}
        else:
            result = {"config": {"sandbox_mode": None, "approval_policy": None}} if root.endswith("defaults") else {"config": {}}
    elif method == "account/read":
        result = {"account": {}, "requiresOpenaiAuth": False}
    elif method == "mcpServerStatus/list":
        servers = []
        if "threadId" in params:
            servers.append({
                "name": namespace, "httpOrigin": "http://127.0.0.1:59869",
                "runtimeStatus": "connected", "toolsError": None,
                "tools": {"getTask": {}, "createComment": {}, "createExecutionSummary": {}},
            })
        result = {"data": servers, "nextCursor": None}
    elif method == "thread/start":
        if root.endswith("legacy"):
            error = {"code": -32602, "message": "legacy execution must not start a helper thread"}
        elif not params.get("ephemeral") or params.get("cwd") != root or "sandbox_workspace_write.network_access" in params.get("config", {}):
            error = {"code": -32602, "message": "configuration was overridden"}
        else:
            result = {
                "cwd": root, "approvalPolicy": "never", "approvalsReviewer": "auto_review",
                "sandbox": {"type": "workspaceWrite", "writableRoots": [root],
                            "networkAccess": True, "excludeTmpdirEnvVar": True,
                            "excludeSlashTmp": True},
            }
            if root.endswith("defaults"):
                result.update({"approvalPolicy": "on-request", "approvalsReviewer": "user", "sandbox": {"type": "readOnly", "networkAccess": False}})
            if root.endswith("removed"):
                os.rmdir(root)
    elif method == "thread/resume":
        config = params.get("config", {})
        developer_instructions = params.get("developerInstructions")
        resume_config = config
        namespace = next(iter(config["mcp_servers"]))
        result = {"thread": {"id": "thread", "status": {"type": "idle"}}, "cwd": root,
                  "approvalPolicy": "never", "sandbox": {"type": "dangerFullAccess"}}
    elif method == "turn/start":
        if root.endswith("legacy") and any(k in params for k in ("sandboxPolicy", "approvalPolicy", "approvalsReviewer")):
            send({"id": ident, "error": {"code": -32602, "message": "legacy policy must not be overridden"}})
            continue
        policy = {"approvalPolicy": params.get("approvalPolicy"), "approvalsReviewer": params.get("approvalsReviewer"), "sandboxPolicy": params.get("sandboxPolicy"), "developerInstructions": developer_instructions, "resumeConfig": resume_config, "summary": params.get("summary")}
        send({"id": ident, "result": {"turn": {"id": "turn"}}})
        send({"method": "item/completed", "params": {"threadId": "thread", "turnId": "turn",
            "item": {"id": "answer", "type": "agentMessage", "text": json.dumps(policy)}}})
        send({"method": "turn/completed", "params": {"threadId": "thread",
            "turn": {"id": "turn", "status": "completed"}}})
        continue
    if error:
        send({"id": ident, "error": error})
    else:
        send({"id": ident, "result": result})
