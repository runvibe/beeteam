"""Smoke a locally built binary through the setup package on a temporary DB and port.

Pass a binary from the current checkout (default: target/debug/beeteam[.exe]).
The test does not publish the synthetic release or start/stop an installed service.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import tomllib
from urllib import request
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/setup-bee-team/scripts"))
import release
import setup


def run(binary, candidate=None, validator=None):
    version = tomllib.loads(Path("Cargo.toml").read_text(encoding="utf-8"))["package"]["version"]
    target = release.machine()
    children = []
    real_popen = subprocess.Popen

    def track(*args, **kwargs):
        child = real_popen(*args, **kwargs)
        children.append(child)
        return child

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        exe = "beeteam.exe" if target[0] == "windows" else "beeteam"
        fmt = "zip" if target[0] == "windows" else "tar.gz"
        if candidate:
            item = json.loads(candidate.read_bytes())
            archive = candidate.with_suffix("")
        else:
            archive = root / ("get-bee-team-preview." + fmt)
            if fmt == "zip":
                with zipfile.ZipFile(archive, "w") as z:
                    z.write(binary, exe)
            else:
                with tarfile.open(archive, "w:gz") as t:
                    t.add(binary, arcname=exe)
            item = {"os": target[0], "arch": target[1], "format": fmt, "fileName": archive.name,
                    "url": release.REPO + "/releases/download/v" + version + "/" + archive.name,
                    "sha256": release.digest(archive), "size": archive.stat().st_size}
        data = {"schemaVersion": 1, "channel": "stable", "appVersion": version, "artifacts": [item],
                "skills": {"repository": release.REPO, "ref": "v" + version, "path": "skills", "names": sorted(release.NAMES)}}
        if validator:
            # Exercise the producer and consumer with the very same candidate,
            # without invoking the producer's live publication checks.
            program = ("import {readFileSync} from 'node:fs';"
                       "const {validateManifest}=await import(process.argv[1]);"
                       "validateManifest(JSON.parse(readFileSync(0,'utf8')));")
            subprocess.run(["node", "--input-type=module", "-e", program, validator.resolve().as_uri()],
                           input=json.dumps(data), text=True, check=True)
        class Preview(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path != "/install.json":
                    return self.send_error(404)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            def log_message(self, *args):
                pass
        helper = [sys.executable, str(Path(setup.__file__).resolve())]
        with ThreadingHTTPServer(("127.0.0.1", 0), Preview) as preview:
            t = threading.Thread(target=preview.serve_forever)
            t.start()
            try:
                args = ["--manifest", f"http://127.0.0.1:{preview.server_port}/install.json"]
                plan = json.loads(subprocess.check_output(helper + ["plan", *args, "--local-version", version]))
                assert plan["artifact"] == item and plan["releaseComparedToLocal"] == "same-precedence"
                staged = json.loads(subprocess.check_output(helper + ["stage", *args, "--version", version,
                                   "--root", str(root / "versions"), "--archive", str(archive)]))
                installed = Path(staged["executable"])
                assert staged["state"] == "staged" and installed.is_file()
            finally:
                preview.shutdown()
                t.join()
        if not candidate:
            assert release.digest(installed) == release.digest(binary)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {"DATABASE_URL": "sqlite://" + (root / "isolated.sqlite").as_posix(),
               "DATABASE_DRIVER": "sqlite", "OTEL_ENABLED": "false", "MCP_ENABLED": "true"}
        try:
            with patch.dict(os.environ, env), patch.object(setup.subprocess, "Popen", side_effect=track):
                result = setup.start(root / "versions", version, port, False)
                assert result["state"] == "started" and result["info"]["apiVersion"] == version
                assert setup.start(root / "versions", version, port, False)["state"] == "already-running"
                assert len(children) == 1 and (root / "isolated.sqlite").is_file()
                assert "mcp" in setup.probe(port)["capabilities"]
                def rpc(method, params):
                    msg = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
                    req = request.Request(f"http://127.0.0.1:{port}/mcp", data=json.dumps(msg).encode(),
                                          headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                                                   "mcp-protocol-version": "2025-11-25"})
                    with request.urlopen(req, timeout=5) as res:
                        return json.load(res)["result"]
                assert rpc("initialize", {"protocolVersion": "2025-11-25", "capabilities": {},
                                         "clientInfo": {"name": "setup-preview", "version": "1"}})["serverInfo"]["name"] == "beeteam-mcp"
                assert rpc("tools/call", {"name": "listBoards", "arguments": {}})["isError"] is False
                print("Verified", item["fileName"], item["sha256"], "health/info", version, "and actual MCP listBoards")
        finally:
            for child in children:
                if child.poll() is None:
                    child.terminate()
                child.wait(timeout=10)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    default = "target/debug/beeteam.exe" if os.name == "nt" else "target/debug/beeteam"
    parser.add_argument("--binary", type=Path, default=Path(default))
    parser.add_argument("--candidate", type=Path, help="Backend package-release.py .zip.json or .tar.gz.json sidecar")
    parser.add_argument("--validator", type=Path, help="Backend install-manifest.mjs from the integration checkout")
    args = parser.parse_args()
    run(args.binary, args.candidate, args.validator)
