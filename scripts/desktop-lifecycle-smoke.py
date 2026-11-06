"""Exercise an installed desktop and its private server on an isolated CI machine."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

def await_state(ready, timeout=35):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if ready():
            return
        time.sleep(.2)
    raise RuntimeError("Desktop lifecycle condition timed out")

def smoke(desktop, server, root):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = dict(os.environ, APP_PORT=str(port), APP_HOST="127.0.0.1", OTEL_ENABLED="false",
               DATABASE_DRIVER="sqlite", DATABASE_URL="sqlite://" + (root / "smoke.db").as_posix())
    def info():
        try:
            with urllib.request.urlopen(base + "/api/v1/info", timeout=1) as response:
                return "mcp" in json.load(response)["capabilities"]
        except OSError:
            return False
    def start(executable, *args):
        return subprocess.Popen([executable, *args], cwd=root, env=env)
    def stop(process):
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=15)
    app = start(desktop, "--hidden")
    try:
        await_state(info)
        assert app.poll() is None
        request = urllib.request.Request(base + "/api/v2/agents", data=b'{"name":"Desktop QA"}',
            headers={"Content-Type": "application/json", "X-Actor-Kind": "human", "Idempotency-Key": str(uuid.uuid4())})
        with urllib.request.urlopen(request, timeout=3) as response:
            record = json.load(response)["id"]
        second = start(desktop, "beeteam://open")
        try:
            assert second.wait(timeout=15) == 0
            assert app.poll() is None
        finally:
            stop(second)
    finally:
        stop(app)
    # Parent pipe must close even on abrupt termination.
    await_state(lambda: not info())
    external = start(server)
    try:
        await_state(info)
        app = start(desktop, "--hidden")
        try:
            time.sleep(3)
            assert app.poll() is None
            with urllib.request.urlopen(base + "/api/v2/agents/" + record, timeout=3) as response:
                assert json.load(response)["name"] == "Desktop QA"
        finally:
            stop(app)
        assert external.poll() is None and info(), "Desktop terminated the external server"
    finally:
        stop(external)

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="bee-desktop-lifecycle-") as tmp:
        smoke(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(tmp))
