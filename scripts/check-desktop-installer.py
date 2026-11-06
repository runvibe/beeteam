"""Install or mount the CI candidate and exercise the server shipped inside it."""
from pathlib import Path
import json
import os
import platform
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

def run(*args):
    subprocess.run(args, check=True, timeout=180)

def check_server(binary, root):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    env = dict(os.environ, APP_HOST="127.0.0.1", APP_PORT=str(port),
               DATABASE_DRIVER="sqlite", DATABASE_URL="sqlite://" + (root / "qa.db").as_posix(),
               OTEL_ENABLED="false", BEE_DESKTOP_PARENT_PIPE="1", MCP_ENABLED="true")
    base = f"http://127.0.0.1:{port}"
    child = subprocess.Popen([binary], env=env, cwd=root, stdin=subprocess.PIPE)
    try:
        for _ in range(200):
            try:
                with urllib.request.urlopen(base + "/api/v1/info", timeout=2) as response:
                    assert "mcp" in json.load(response)["capabilities"]
                break
            except OSError:
                if child.poll() is not None:
                    raise RuntimeError("Packaged server exited before readiness")
                time.sleep(.1)
        else:
            raise RuntimeError("Packaged server startup timed out")
        with urllib.request.urlopen(base + "/app/", timeout=5) as response:
            assert response.headers.get_content_type() == "text/html"
        rpc = dict(id=1, jsonrpc="2.0", method="initialize", params=dict(
            protocolVersion="2025-11-25", capabilities={}, clientInfo=dict(name="installer-qa", version="1")))
        request = urllib.request.Request(base + "/mcp", data=json.dumps(rpc).encode(), headers={
            "Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
        with urllib.request.urlopen(request, timeout=5) as response:
            assert b"beeteam-mcp" in response.read()
        child.stdin.close()
        assert child.wait(timeout=15) == 0
    finally:
        if child.poll() is None:
            child.kill()
            child.wait()

def verify(bundle, root):
    os_name = platform.system()
    directory = root / "installed"
    if os_name == "Windows":
        installer, = bundle.glob("nsis/*.exe")
        run(installer, "/S", "/D=" + str(directory))
    elif os_name == "Darwin":
        installer, = bundle.glob("dmg/*.dmg")
        directory.mkdir()
        run("hdiutil", "attach", installer, "-readonly", "-nobrowse", "-mountpoint", directory)
    else:
        installer, = bundle.glob("deb/*.deb")
        run("sudo", "apt-get", "install", "-y", installer.resolve())
        directory = Path("/usr/bin")
    try:
        server, = directory.rglob("beeteam-server.exe" if os_name == "Windows" else "beeteam-server")
        check_server(server, root)
        desktop = server.with_name("beeteam-desktop.exe" if os_name == "Windows" else "beeteam-desktop")
        if os_name == "Darwin":
            import plistlib
            with (server.parent.parent / "Info.plist").open("rb") as stream:
                desktop = server.with_name(plistlib.load(stream)["CFBundleExecutable"])
        runner = ["dbus-run-session", "--", "xvfb-run", "-a"] if os_name == "Linux" else []
        run(*runner, sys.executable, Path(__file__).with_name("desktop-lifecycle-smoke.py"), desktop, server)
    finally:
        if os_name == "Darwin":
            run("hdiutil", "detach", directory)

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="bee-desktop-qa-") as tmp:
        verify(Path(sys.argv[1]).resolve(), Path(tmp))
