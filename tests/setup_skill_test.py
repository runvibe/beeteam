"""Offline release and local discovery tests. No user installation or external service."""
import hashlib
import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tarfile
import tempfile
import threading
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/setup-bee-team/scripts"))
import release
import setup


def fixture(fmt="zip", version="1.0.0", extra=False):
    data = io.BytesIO()
    content = b"test binary; never executed"
    exe = "beeteam.exe" if fmt == "zip" else "beeteam"
    if fmt == "zip":
        with zipfile.ZipFile(data, "w") as z:
            z.writestr(exe if not extra else "../" + exe, content)
            z.writestr("notes.txt", b"not an install hook")
    else:
        with tarfile.open(fileobj=data, mode="w:gz") as t:
            member = tarfile.TarInfo(exe)
            member.size = len(content)
            t.addfile(member, io.BytesIO(content))
    raw = data.getvalue()
    name = "get-bee-team-test." + fmt
    item = {"os": "windows" if fmt == "zip" else "linux", "arch": "x64", "fileName": name,
            "size": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "format": fmt,
            "url": release.REPO + "/releases/download/v" + version + "/" + name}
    return raw, {"schemaVersion": 1, "appVersion": version, "channel": "stable", "artifacts": [item],
                 "skills": {"repository": release.REPO, "ref": "v" + version, "path": "skills", "names": sorted(release.NAMES)}}


class PackageTests(unittest.TestCase):
    def test_stage_both_formats_repeat_and_preserve_customizations_and_previous_version(self):
        for fmt in ("zip", "tar.gz"):
            raw, manifest = fixture(fmt)
            target = manifest["artifacts"][0]["os"], "x64"
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                def install(raw, m):
                    return release.stage(m, m["appVersion"], root, io.BytesIO(raw), target)
                path = install(raw, manifest)
                self.assertEqual(path, install(raw, manifest))
                path.write_bytes(b"custom")
                with self.assertRaises(ValueError):
                    install(raw, manifest)
                data_file = root / "preferences"
                data_file.write_bytes(b"preserve")
                newer = install(*fixture(fmt, "1.1.0"))
                self.assertNotEqual(newer, path)
                self.assertEqual(path.read_bytes(), b"custom")
                self.assertEqual(data_file.read_bytes(), b"preserve")

    def test_release_legal_notices_survive_install_and_tampering_is_not_overwritten(self):
        for fmt in ("zip", "tar.gz"):
            raw, manifest = fixture(fmt)
            updated = io.BytesIO(raw)
            if fmt == "zip":
                with zipfile.ZipFile(updated, "a") as archive:
                    for name in release.LEGAL_FILES:
                        archive.writestr(name, b"license notice")
                    archive.writestr("../outside.txt", b"never install")
            else:
                updated = io.BytesIO()
                with tarfile.open(fileobj=updated, mode="w:gz") as archive:
                    for name in ["beeteam", *release.LEGAL_FILES, "../outside.txt"]:
                        content = b"license notice"
                        info = tarfile.TarInfo(name)
                        info.size = len(content)
                        archive.addfile(info, io.BytesIO(content))
            raw = updated.getvalue()
            item = manifest["artifacts"][0]
            item.update(size=len(raw), sha256=hashlib.sha256(raw).hexdigest())
            target = item["os"], "x64"
            with tempfile.TemporaryDirectory() as tmp:
                binary = release.stage(manifest, "1.0.0", tmp, io.BytesIO(raw), target)
                for name in release.LEGAL_FILES:
                    self.assertEqual((binary.parent / name).read_bytes(), b"license notice")
                self.assertFalse((Path(tmp) / "outside.txt").exists())
                self.assertEqual(binary, release.stage(manifest, "1.0.0", tmp, io.BytesIO(raw), target))
                (binary.parent / "LICENSE").write_bytes(b"changed")
                with self.assertRaises(ValueError):
                    release.stage(manifest, "1.0.0", tmp, io.BytesIO(raw), target)
                self.assertEqual((binary.parent / "LICENSE").read_bytes(), b"changed")

    def test_hash_size_and_missing_root_never_activate(self):
        for failure in ("hash", "size", "traversal"):
            raw, m = fixture(extra=failure == "traversal")
            if failure == "hash":
                m["artifacts"][0]["sha256"] = "0" * 64
            if failure == "size":
                m["artifacts"][0]["size"] -= 1
            with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):
                try:
                    release.stage(m, "1.0.0", tmp, io.BytesIO(raw), ("windows", "x64"))
                finally:
                    self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_manifest_contract_rejects_untrusted_sources_and_unpublished_targets(self):
        _, m = fixture()
        with self.assertRaises(ValueError):
            release.contract(m, ("macos", "arm64"))
        m["skills"]["ref"] = "main"
        with self.assertRaises(ValueError):
            release.contract(m, ("windows", "x64"))
        m["skills"]["ref"] = "v1.0.0"
        m["artifacts"][0]["url"] = "https://example.org/installer.zip"
        with self.assertRaises(ValueError):
            release.contract(m, ("windows", "x64"))

    def test_remote_precedence_is_distinct_from_panel_equality(self):
        self.assertGreater(release.precedence("1.10.0"), release.precedence("1.9.9"))
        self.assertGreater(release.precedence("1.0.0"), release.precedence("1.0.0-rc.10"))
        self.assertGreater(release.precedence("1.0.0-rc.10"), release.precedence("1.0.0-rc.2"))
        self.assertEqual(release.precedence("1.0.0+local"), release.precedence("1.0.0"))


class ProbeTests(unittest.TestCase):
    def test_foreign_listener_is_not_an_install_signal(self):
        class OtherApp(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_error(404)
            def log_message(self, *args):
                pass
        with ThreadingHTTPServer(("127.0.0.1", 0), OtherApp) as server:
            t = threading.Thread(target=server.serve_forever)
            t.start()
            try:
                with patch.object(setup.subprocess, "Popen") as spawn:
                    with self.assertRaisesRegex(ValueError, "occupied"):
                        setup.start(Path("unused"), "1.0.0", server.server_port, False)
                    spawn.assert_not_called()
            finally:
                server.shutdown()
                t.join()

    def test_running_service_is_reused_or_rejected_without_stopping(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                body = {"apiVersion": "1.0.0", "capabilities": ["tasks.work-scope"], "supportedContractVersions": ["v1"]}
                if self.path == "/health":
                    body = {"status": "ok", "version": "1.0.0"}
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(body).encode())
            def log_message(self, *args):
                pass
        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            t = threading.Thread(target=server.serve_forever)
            t.start()
            try:
                port = server.server_port
                self.assertEqual(setup.start(Path("unused"), "1.0.0", port, False)["state"], "already-running")
                with self.assertRaisesRegex(ValueError, "Another version"):
                    setup.start(Path("unused"), "1.1.0", port, False)
                self.assertEqual(setup.probe(port)["apiVersion"], "1.0.0")
            finally:
                server.shutdown()
                t.join()


if __name__ == "__main__":
    unittest.main()
