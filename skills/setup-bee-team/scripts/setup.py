"""Inspect, stage or start Bee Team without changing a harness or database."""
import argparse
import json
import os
import socket
import subprocess
import sys
import tarfile
import time
import zipfile
from pathlib import Path
from urllib import request
from urllib.error import URLError

sys.dont_write_bytecode = True  # Keep the installed skill file manifest unchanged.
from release import MANIFEST, contract, digest, machine, manifest, precedence, remote, require, stage


ROOT = Path.home() / ".local" / "share" / "get-bee-team" / "versions"


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError("Local service redirected unexpectedly")


def probe(port):
    require(0 < port <= 65535, "Invalid local port")
    opener = request.build_opener(request.ProxyHandler({}), NoRedirect)
    def read(path):
        with opener.open(f"http://127.0.0.1:{port}{path}", timeout=2) as response:
            require(response.headers.get_content_type() == "application/json", "Expected JSON from the local API")
            raw = response.read(65537)
        require(len(raw) <= 65536, "Oversized API response")
        return json.loads(raw)
    health, info = read("/health"), read("/api/v1/info")
    require(isinstance(health, dict) and isinstance(info, dict), "Unexpected local service")
    version = info.get("apiVersion")
    precedence(version)
    require(health.get("status") == "ok" and health.get("version") == version and
            isinstance(info.get("supportedContractVersions"), list) and "v1" in info["supportedContractVersions"] and
            isinstance(info.get("capabilities"), list) and "tasks.work-scope" in info["capabilities"], "Not the expected Bee Team service")
    return info


def start(root, version, port, embedded):
    precedence(version)
    require(0 < port <= 65535, "Invalid local port")
    try:
        info = probe(port)
    except (URLError, TimeoutError):
        # Windows can time out before reporting ECONNREFUSED on an unused port.
        # Check actual bindability; a timeout alone is not proof of absence.
        with socket.socket() as check:
            if os.name == "nt":
                check.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            try:
                check.bind(("127.0.0.1", port))
            except OSError as exc:
                raise ValueError("Endpoint unavailable or occupied; inspect the service first") from exc
    else:
        require(info["apiVersion"] == version, "Another version is running; coordinate a normal service stop first")
        return {"state": "already-running", "info": info, "mode": "unchanged"}
    target = root.expanduser().absolute() / version
    exe = target / ("beeteam.exe" if os.name == "nt" else "beeteam")
    receipt = json.loads((target / "receipt.json").read_bytes())
    require(receipt.get("version") == version and not exe.is_symlink() and digest(exe) == receipt.get("binarySha256"), "Installed executable differs from its receipt")
    env = {**os.environ, "APP_HOST": "127.0.0.1", "APP_PORT": str(port), "BEE_FRONTEND_MODE": "embedded" if embedded else "disabled"}
    log = target.parent / f"start-{time.time_ns()}.log"
    with log.open("xb") as output:
        proc = subprocess.Popen([str(exe)], env=env, cwd=target, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                                start_new_session=os.name != "nt", creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    for _ in range(30):
        if proc.poll() is not None:
            raise ValueError(f"Process exited ({proc.returncode}); see {log}")
        try:
            info = probe(port)
        except (URLError, TimeoutError):
            time.sleep(0.4)
            continue
        require(info["apiVersion"] == version and proc.poll() is None, f"Unexpected service/version; inspect PID {proc.pid} and {log}")
        return {"state": "started", "pid": proc.pid, "log": str(log), "info": info}
    raise ValueError(f"Readiness not confirmed; inspect PID {proc.pid} and {log} before retrying")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    for name in ("probe", "plan", "stage", "start"):
        cmd = sub.add_parser(name)
        if name in ("probe", "start"):
            cmd.add_argument("--port", type=int, default=59865)
        if name in ("plan", "stage"):
            cmd.add_argument("--manifest", default=MANIFEST)
            cmd.add_argument("--local-version", help="actual installed API version; never stage a downgrade")
        if name in ("stage", "start"):
            cmd.add_argument("--root", type=Path, default=ROOT)
            cmd.add_argument("--version", required=True)
        if name == "start":
            cmd.add_argument("--embedded", action="store_true")
        if name == "probe":
            cmd.add_argument("--panel-version", help="exact version of the open panel build")
        if name == "stage":
            cmd.add_argument("--archive", type=Path, help="already downloaded package; same mandatory size/hash checks")
    args = p.parse_args()
    if args.command == "start":
        return start(args.root, args.version, args.port, args.embedded)
    if args.command == "probe":
        info = probe(args.port)
        if args.panel_version:
            info["panelCompatible"] = args.panel_version == info["apiVersion"]
        return info
    data = manifest(args.manifest)
    target = machine()
    item = contract(data, target)
    comparison = None
    if args.local_version:
        local, release = precedence(args.local_version), precedence(data["appVersion"])
        comparison = "newer" if release > local else "older" if release < local else "same-precedence"
    if args.command == "plan":
        return {"appVersion": data["appVersion"], "releaseComparedToLocal": comparison, "artifact": item, "skills": data["skills"]}
    require(args.version == data["appVersion"] and comparison != "older", "Requested version mismatch or downgrade; do not install")
    with (args.archive.open("rb") if args.archive else remote(item["url"])) as source:
        path = stage(data, args.version, args.root, source, target)
    return {"state": "staged", "executable": str(path), "version": args.version}


if __name__ == "__main__":
    try:
        print(json.dumps(main(), indent=2))
    except (ValueError, OSError, KeyError, TypeError, EOFError, tarfile.TarError, zipfile.BadZipFile) as e:
        sys.exit(f"Setup did not complete: {e}")
