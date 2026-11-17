#!/usr/bin/env python3
"""Minimal App Server fixture for access-policy protocol tests."""
import json
import os
import sys

root = os.getcwd()
namespace = None
config_mode = False


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
        config_mode = True
        if params.get("cwd") != root or root.endswith("invalid"):
            error = {"code": -32603, "message": "fixture config error"}
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
        if not params.get("ephemeral") or params.get("cwd") != root or "sandbox_workspace_write.network_access" in params.get("config", {}):
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
        if config_mode and "sandbox_workspace_write.network_access" in config:
            error = {"code": -32602, "message": "configuration was overridden"}
        else:
            namespace = next(iter(config["mcp_servers"]))
            result = {"thread": {"id": "thread", "status": {"type": "idle"}}, "cwd": root,
                      "approvalPolicy": "never", "sandbox": {"type": "dangerFullAccess"}}
    elif method == "turn/start":
        policy = {"approvalPolicy": params.get("approvalPolicy"), "approvalsReviewer": params.get("approvalsReviewer"), "sandboxPolicy": params.get("sandboxPolicy")}
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
