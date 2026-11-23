import json
import sys

replies = []
for line in sys.stdin:
    frame = json.loads(line)
    method = frame.get("method")
    if method is None:
        replies.append(frame)
        continue
    ident = frame["id"]
    if method == "test/interleaved":
        print(json.dumps({"method": "thread/realtime/sdp", "params": {"sdp": "answer"}}), flush=True)
    if method == "test/reject":
        print(json.dumps({"id": ident, "error": {"message": "private provider detail"}}), flush=True)
    else:
        result = {"replies": replies} if method == "test/replies" else {}
        print(json.dumps({"id": ident, "result": result}), flush=True)
