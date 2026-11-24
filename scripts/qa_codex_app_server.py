"""Small official JSONL client for opt-in owned-session acceptance; no SDK or credentials."""
import json
import os
import queue
import subprocess
import threading
import time


class AppServer:
    def __init__(self, executable, cwd, output):
        self.q = queue.Queue()
        self.seq = 0
        self.events = []
        self.err = open(output / "app-server.log", "a", encoding="utf8")
        environment = os.environ.copy()
        environment["RUST_LOG"] = "error"
        self.p = subprocess.Popen(
            [str(executable), "app-server", "--listen", "stdio://", "-c", "analytics.enabled=false"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.err,
            text=True, encoding="utf8", cwd=cwd, env=environment,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        threading.Thread(target=self.reader, daemon=True).start()

    def reader(self):
        for line in self.p.stdout:
            self.q.put(json.loads(line))

    def send(self, message):
        self.p.stdin.write(json.dumps(message) + "\n")
        self.p.stdin.flush()

    def request(self, method, params, timeout=45):
        self.seq += 1
        identifier = self.seq
        self.send({"id": identifier, "method": method, "params": params})
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            message = self.q.get(timeout=max(.01, deadline - time.monotonic()))
            if message.get("id") == identifier:
                if "error" in message:
                    raise RuntimeError(json.dumps(message["error"]))
                return message["result"]
            self.events.append(message)
            if "id" in message and "method" in message:
                self.send({"id": message["id"], "error": {
                    "code": -32601, "message": "Owned proof client does not grant approvals"}})
        raise TimeoutError(method)

    def init(self):
        result = self.request("initialize", {"clientInfo": {
            "name": "beeteam_integration_proof", "title": "Bee Team owned acceptance", "version": "0.1.4"}})
        self.send({"method": "initialized", "params": {}})
        return result

    def close(self):
        self.p.stdin.close()
        try:
            self.p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            self.p.terminate()
            self.p.wait(timeout=8)
        self.err.close()
